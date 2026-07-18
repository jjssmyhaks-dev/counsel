/**
 * Background job worker — polls the DB for pending jobs and processes them.
 *
 * Falls back to in-process setInterval polling when Redis/BullMQ is unavailable.
 * BullMQ is lazy-loaded — no import cost or crashes if Redis isn't ready.
 *
 * Job types handled:
 *   DOCUMENT_PARSE  — parse → chunk → embed → index → mark READY
 *   ANALYSIS_RUN    — run document analysis via AI service
 *   MEETING_PROCESS — process meeting transcript
 */
import { prisma } from '@counsel/database';
import { aiClient } from '../lib/ai-client';
import fs from 'fs';
import path from 'path';

// ── Start workers ───────────────────────────────────────────────

export async function startWorkers() {
  let redisOk = false;

  // Try Redis + BullMQ first
  try {
    const IORedis = (await import('ioredis')).default;
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    const connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    await connection.connect();
    await connection.ping();

    // Check Redis version — BullMQ requires >=5.0
    const info = await connection.info('server') as string;
    const versionMatch = info.match(/redis_version:(\d+\.\d+)/);
    const redisVersion = versionMatch ? parseFloat(versionMatch[1]) : 0;

    if (redisVersion < 5.0) {
      throw new Error(`Redis ${redisVersion} too old for BullMQ (needs >=5.0)`);
    }

    // Only import BullMQ if Redis is confirmed working and version-compatible
    const { Queue, Worker } = await import('bullmq');

    console.log('[Worker] Redis connected — starting BullMQ workers');

    const docQueue = new Queue('document-parse', { connection });
    const analysisQueue = new Queue('analysis-run', { connection });
    const meetingQueue = new Queue('meeting-process', { connection });

    const docWorker = new Worker('document-parse', async (job: any) => {
      await processDocumentJobImpl(job.data.documentId, job.data.firmId);
    }, { connection, concurrency: 2 });

    const analysisWorker = new Worker('analysis-run', async (job: any) => {
      await processAnalysisJobImpl(job.data.analysisId, job.data.documentId, job.data.firmId);
    }, { connection, concurrency: 1 });

    const meetingWorker = new Worker('meeting-process', async (job: any) => {
      await processMeetingJobImpl(job.data.meetingId, job.data.firmId);
    }, { connection, concurrency: 3 });

    docWorker.on('completed', (job: any) => console.log(`[Worker] ${job.id} completed`));
    docWorker.on('failed', (job: any, err: Error) => console.error(`[Worker] ${job?.id} failed:`, err.message));

    redisOk = true;
  } catch (err: any) {
    console.warn('[Worker] Redis/BullMQ unavailable (' + (err.message || err) + ') — using in-process polling');
  }

  // Always start polling as fallback (or to handle legacy jobs)
  startPolling();
}

// ── Job processing implementations ──────────────────────────────

export async function processDocumentJobImpl(documentId: string, firmId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error(`Document ${documentId} not found`);

  const filePath = path.resolve(process.cwd(), 'uploads', document.filename);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const fileBytes = fs.readFileSync(filePath);
  const parseResult = await aiClient.parseDocument(document.id, document.mimeType, fileBytes);
  const texts = parseResult.chunks.map((c: any) => c.text);
  const embedResult = await aiClient.embedTexts(texts);

  await aiClient.indexDocument(document.id, firmId, parseResult.chunks, embedResult.embeddings, document.matterId || undefined);

  await prisma.document.update({
    where: { id: document.id },
    data: { status: 'READY' as any },
  });

  return { chunks: parseResult.chunks.length, pages: parseResult.total_pages };
}

export async function processAnalysisJobImpl(analysisId: string, documentId: string, firmId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error(`Document ${documentId} not found`);

  const filePath = path.resolve(process.cwd(), 'uploads', document.filename);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const fileBytes = fs.readFileSync(filePath);

  const aiResp = await fetch(
    `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/agents/analyze/contract`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_text: fileBytes.toString('utf-8').substring(0, 30000),
        firm_id: firmId,
        user_id: 'worker',
      }),
      signal: AbortSignal.timeout(300_000),
    },
  );

  if (!aiResp.ok) {
    const err = await aiResp.json().catch(() => ({}));
    throw new Error(err.detail || `AI service returned ${aiResp.status}`);
  }

  const aiResult = await aiResp.json();

  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: 'COMPLETED', result: aiResult, modelUsed: 'cloudflare-crewai', completedAt: new Date() },
  });

  return aiResult;
}

export async function processMeetingJobImpl(meetingId: string, _firmId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, transcript: true },
  });
  if (!meeting || !meeting.transcript) throw new Error('Meeting or transcript not found');

  const aiResp = await fetch(
    `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/process/meeting`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_id: meetingId, transcript: meeting.transcript }),
      signal: AbortSignal.timeout(120_000),
    },
  );

  if (aiResp.ok) {
    const result = await aiResp.json();
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: 'COMPLETED' } });
    if (result.action_items) {
      for (const item of result.action_items) {
        await prisma.meetingActionItem.create({
          data: { meetingId, text: item.text || item, status: 'OPEN' },
        });
      }
    }
    return result;
  }

  throw new Error(`AI meeting processing failed: ${aiResp.status}`);
}

// ── In-process polling fallback ─────────────────────────────────

let pollingInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollingInterval) return;
  pollingInterval = setInterval(pollPendingJobs, 5000);
  console.log('[Worker] Polling for pending jobs every 5s');
}

async function pollPendingJobs() {
  try {
    const pendingJobs = await prisma.job.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });

    for (const job of pendingJobs) {
      try {
        await prisma.job.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

        let result: any = {};
        if (job.type === 'DOCUMENT_PARSE') {
          const documentId = (job.result as any)?.documentId;
          if (documentId) result = await processDocumentJobImpl(documentId, job.firmId);
        } else if (job.type === 'ANALYSIS_RUN') {
          const analysisId = (job.result as any)?.analysisId;
          const documentId = (job.result as any)?.documentId;
          if (analysisId && documentId) result = await processAnalysisJobImpl(analysisId, documentId, job.firmId);
        } else if (job.type === 'MEETING_PROCESS') {
          const meetingId = (job.result as any)?.meetingId;
          if (meetingId) result = await processMeetingJobImpl(meetingId, job.firmId);
        }

        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'COMPLETED', result: { ...job.result as any, ...result }, completedAt: new Date() },
        });
        console.log(`[Worker] Job ${job.id} (${job.type}) completed`);
      } catch (err: any) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'FAILED', error: err.message?.substring(0, 500) || 'Unknown error', completedAt: new Date() },
        });
        console.error(`[Worker] Job ${job.id} (${job.type}) failed:`, err.message);
      }
    }
  } catch {
    // Silently ignore — retry next interval
  }
}

export function stopWorkers() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

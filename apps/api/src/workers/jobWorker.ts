/**
 * Background job worker — polls the DB for pending jobs and processes them.
 *
 * Uses BullMQ (Redis-backed) for reliable job processing with retries.
 * Falls back to in-process polling if Redis is unavailable.
 *
 * Job types handled:
 *   DOCUMENT_PARSE  — parse → chunk → embed → index → mark READY
 *   ANALYSIS_RUN    — run document analysis via AI service
 *   MEETING_PROCESS — process meeting transcript
 */
import { prisma } from '@counsel/database';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { aiClient } from './ai-client';
import fs from 'fs';
import path from 'path';

// ── Redis connection ────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;
try {
  connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
} catch {
  console.warn('[Worker] Redis unavailable — using in-process fallback');
}

let documentQueue: Queue | null = null;
let analysisQueue: Queue | null = null;
let meetingQueue: Queue | null = null;
let docWorker: Worker | null = null;
let analysisWorker: Worker | null = null;
let meetingWorker: Worker | null = null;

// ── Start workers ───────────────────────────────────────────────

export async function startWorkers() {
  if (!connection) {
    console.log('[Worker] Starting in-process polling fallback (no Redis)');
    startPolling();
    return;
  }

  try {
    await connection.connect();
    console.log('[Worker] Redis connected — starting BullMQ workers');

    documentQueue = new Queue('document-parse', { connection });
    analysisQueue = new Queue('analysis-run', { connection });
    meetingQueue = new Queue('meeting-process', { connection });

    docWorker = new Worker('document-parse', processDocumentJob, {
      connection,
      concurrency: 2,
      limiter: { max: 5, duration: 60000 },
    });

    analysisWorker = new Worker('analysis-run', processAnalysisJob, {
      connection,
      concurrency: 1,
      limiter: { max: 3, duration: 300000 }, // 3 analysis jobs per 5 min
    });

    meetingWorker = new Worker('meeting-process', processMeetingJob, {
      connection,
      concurrency: 3,
      limiter: { max: 10, duration: 60000 },
    });

    docWorker.on('completed', (job) => console.log(`[Worker] DOCUMENT_PARSE completed: job ${job.id}`));
    docWorker.on('failed', (job, err) => console.error(`[Worker] DOCUMENT_PARSE failed: job ${job?.id}`, err.message));

    analysisWorker.on('completed', (job) => console.log(`[Worker] ANALYSIS_RUN completed: job ${job.id}`));
    analysisWorker.on('failed', (job, err) => console.error(`[Worker] ANALYSIS_RUN failed: job ${job?.id}`, err.message));

    meetingWorker.on('completed', (job) => console.log(`[Worker] MEETING_PROCESS completed: job ${job.id}`));
    meetingWorker.on('failed', (job, err) => console.error(`[Worker] MEETING_PROCESS failed: job ${job?.id}`, err.message));

    // Also start polling for legacy jobs created before workers were active
    startPolling();
  } catch (err) {
    console.warn('[Worker] Redis connect failed, using in-process fallback:', (err as Error).message);
    connection = null;
    startPolling();
  }
}

// ── BullMQ job handlers ─────────────────────────────────────────

async function processDocumentJob(job: Job) {
  const { documentId, firmId } = job.data;
  await processDocumentJobImpl(documentId, firmId);
}

async function processAnalysisJob(job: Job) {
  const { analysisId, documentId, firmId } = job.data;
  await processAnalysisJobImpl(analysisId, documentId, firmId);
}

async function processMeetingJob(job: Job) {
  const { meetingId, firmId } = job.data;
  await processMeetingJobImpl(meetingId, firmId);
}

// ── Job processing implementations ──────────────────────────────

export async function processDocumentJobImpl(documentId: string, firmId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error(`Document ${documentId} not found`);

  const filePath = path.resolve(process.cwd(), 'uploads', document.filename);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const fileBytes = fs.readFileSync(filePath);

  // Step 1: Parse (extract text)
  const parseResult = await aiClient.parseDocument(document.id, document.mimeType, fileBytes);

  // Step 2: Embed chunks
  const texts = parseResult.chunks.map((c: any) => c.text);
  const embedResult = await aiClient.embedTexts(texts);

  // Step 3: Index into pgvector
  await aiClient.indexDocument(
    document.id,
    firmId,
    parseResult.chunks,
    embedResult.embeddings,
    document.matterId || undefined,
  );

  // Step 4: Update document status to READY
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

  // Send to AI service for CrewAI analysis
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
    data: {
      status: 'COMPLETED',
      result: aiResult,
      modelUsed: 'cloudflare-crewai',
      completedAt: new Date(),
    },
  });

  return aiResult;
}

export async function processMeetingJobImpl(meetingId: string, firmId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, transcript: true, title: true },
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
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'COMPLETED' },
    });

    // Create action items from AI output
    if (result.action_items) {
      for (const item of result.action_items) {
        await prisma.meetingActionItem.create({
          data: {
            meetingId,
            text: item.text || item,
            status: 'OPEN',
          },
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
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'PROCESSING' },
        });

        let result: any = {};
        if (job.type === 'DOCUMENT_PARSE') {
          const documentId = (job.result as any)?.documentId;
          if (documentId) {
            result = await processDocumentJobImpl(documentId, job.firmId);
          }
        } else if (job.type === 'ANALYSIS_RUN') {
          const analysisId = (job.result as any)?.analysisId;
          const documentId = (job.result as any)?.documentId;
          if (analysisId && documentId) {
            result = await processAnalysisJobImpl(analysisId, documentId, job.firmId);
          }
        } else if (job.type === 'MEETING_PROCESS') {
          const meetingId = (job.result as any)?.meetingId;
          if (meetingId) {
            result = await processMeetingJobImpl(meetingId, job.firmId);
          }
        }

        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            result: { ...job.result as any, ...result },
            completedAt: new Date(),
          },
        });

        console.log(`[Worker] Job ${job.id} (${job.type}) completed`);
      } catch (err: any) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: err.message?.substring(0, 500) || 'Unknown error',
            completedAt: new Date(),
          },
        });
        console.error(`[Worker] Job ${job.id} (${job.type}) failed:`, err.message);
      }
    }
  } catch (err: any) {
    // Silently ignore polling errors — will retry next interval
  }
}

export function stopWorkers() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (docWorker) docWorker.close();
  if (analysisWorker) analysisWorker.close();
  if (meetingWorker) meetingWorker.close();
}

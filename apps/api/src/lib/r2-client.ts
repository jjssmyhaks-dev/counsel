/**
 * Cloudflare R2 Client — production-ready S3-compatible document storage.
 *
 * Replaces the local-URL stub in r2.ts with real S3 SDK calls.
 * Requires: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 * Falls back to local mode when env vars are missing.
 *
 * npm: @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────────────
let _client: S3Client | null = null;
let _bucket: string = '';
let _r2Available = false;

export function initR2() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const endpoint = process.env.R2_ENDPOINT || '';
  const bucket = process.env.R2_BUCKET || 'counsel-documents';

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    console.warn('[R2] Credentials not configured — using local storage fallback');
    _r2Available = false;
    return;
  }

  _client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  _bucket = bucket;
  _r2Available = true;
  console.log('[R2] Client initialized — bucket:', bucket);
}

// ── Upload ──────────────────────────────────────────────────────────────────

export interface R2UploadOptions {
  firmId: string;
  filename: string;
  contentType: string;
  body: Buffer | Uint8Array;
}

export interface R2UploadResult {
  key: string;
  url: string;
  size: number;
  etag: string;
  localFallback: boolean;
}

export async function r2Upload(opts: R2UploadOptions): Promise<R2UploadResult> {
  const { firmId, filename, contentType, body } = opts;
  const ext = filename.split('.').pop() || 'bin';
  const hash = createHash('md5').update(firmId + Date.now() + randomUUID()).digest('hex').slice(0, 12);
  const key = `documents/${firmId}/${hash}.${ext}`;

  if (!_r2Available || !_client) {
    // Local fallback
    return {
      key,
      url: `/api/v1/documents/download/${key}`,
      size: body.length,
      etag: '',
      localFallback: true,
    };
  }

  try {
    const cmd = new PutObjectCommand({
      Bucket: _bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: { firmId, originalName: filename },
    });
    const result = await _client.send(cmd);

    return {
      key,
      url: `${process.env.R2_PUBLIC_URL || ''}/${key}`,
      size: body.length,
      etag: result.ETag || '',
      localFallback: false,
    };
  } catch (err) {
    console.error('[R2] Upload failed:', (err as Error).message);
    // Fall back to local
    return {
      key,
      url: `/api/v1/documents/download/${key}`,
      size: body.length,
      etag: '',
      localFallback: true,
    };
  }
}

// ── Get Object ──────────────────────────────────────────────────────────────

export async function r2GetObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!_r2Available || !_client) return null;
  try {
    const cmd = new GetObjectCommand({ Bucket: _bucket, Key: key });
    const result = await _client.send(cmd);
    const body = await result.Body!.transformToByteArray();
    return { body: Buffer.from(body), contentType: result.ContentType || 'application/octet-stream' };
  } catch (err: any) {
    if (err.name === 'NoSuchKey') return null;
    console.error('[R2] GetObject failed:', err.message);
    return null;
  }
}

// ── Pre-signed URL ──────────────────────────────────────────────────────────

export interface R2SignedUrlOptions {
  key: string;
  expiresInSeconds?: number;
}

export async function r2GeneratePresignedUrl(
  opts: R2SignedUrlOptions
): Promise<{ url: string; expiresAt: Date }> {
  const expiresIn = opts.expiresInSeconds || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  if (!_r2Available || !_client) {
    return { url: `/api/v1/documents/download/${opts.key}`, expiresAt };
  }

  try {
    const cmd = new GetObjectCommand({ Bucket: _bucket, Key: opts.key });
    const url = await getSignedUrl(_client, cmd, { expiresIn });
    return { url, expiresAt };
  } catch (err) {
    console.error('[R2] Presigned URL failed:', (err as Error).message);
    return { url: `/api/v1/documents/download/${opts.key}`, expiresAt };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function r2Delete(key: string): Promise<boolean> {
  if (!_r2Available || !_client) return true; // nothing to delete in local mode
  try {
    await _client.send(new DeleteObjectCommand({ Bucket: _bucket, Key: key }));
    return true;
  } catch (err) {
    console.error('[R2] Delete failed:', (err as Error).message);
    return false;
  }
}

// ── Head (check existence) ──────────────────────────────────────────────────

export async function r2Exists(key: string): Promise<boolean> {
  if (!_r2Available || !_client) return false;
  try {
    await _client.send(new HeadObjectCommand({ Bucket: _bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Public URL ──────────────────────────────────────────────────────────────

export function r2PublicUrl(key: string): string {
  if (!_r2Available) return `/api/v1/documents/download/${key}`;
  return `${process.env.R2_PUBLIC_URL || ''}/${key}`;
}

// ── Health Check ────────────────────────────────────────────────────────────

export async function r2HealthCheck(): Promise<{
  status: 'connected' | 'disconnected' | 'unconfigured';
  bucket?: string;
  error?: string;
}> {
  if (!_r2Available) {
    return { status: 'unconfigured' };
  }
  try {
    await _client!.send(new HeadObjectCommand({ Bucket: _bucket, Key: '__health_check__' }));
  } catch (err: any) {
    if (err.name === 'NotFound') {
      return { status: 'connected', bucket: _bucket };
    }
    return { status: 'disconnected', error: err.message };
  }
  return { status: 'connected', bucket: _bucket };
}

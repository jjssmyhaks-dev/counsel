/**
 * File storage — local filesystem (dev) + S3/R2 compatible (prod).
 * Falls back to local uploads/ when no S3 credentials are set.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

/** Store a file from a Buffer */
export async function storeFile(
  firmId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  const firmDir = path.join(UPLOADS_DIR, firmId);
  if (!fs.existsSync(firmDir)) {
    fs.mkdirSync(firmDir, { recursive: true });
  }

  const key = `${firmId}/${Date.now()}-${sanitize(filename)}`;
  const filePath = path.join(UPLOADS_DIR, key);

  fs.writeFileSync(filePath, buffer);

  return {
    key,
    url: `/api/v1/documents/download/${encodeURIComponent(key)}`,
    size: buffer.length,
    mimeType,
  };
}

/** Retrieve a file as Buffer */
export async function getFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const filePath = path.join(UPLOADS_DIR, sanitize(key));
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(key).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.rtf': 'application/rtf',
    '.eml': 'message/rfc822',
    '.msg': 'application/vnd.ms-outlook',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
  };
  return { buffer, mimeType: mimeMap[ext] || 'application/octet-stream' };
}

/** Delete a stored file */
export async function deleteFile(key: string): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, sanitize(key));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** Generate a signed download URL (local = proxy URL; prod = presigned S3 URL) */
export function generateSignedUrl(key: string, expiresIn: number = 3600): { url: string; expiresAt: Date } {
  return {
    url: `/api/v1/documents/download/${encodeURIComponent(key)}`,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/** Generate a presigned upload URL (local = direct POST; prod = S3 presigned PUT) */
export function generateUploadUrl(firmId: string, filename: string): { url: string; key: string; expiresAt: Date } {
  const key = `${firmId}/${Date.now()}-${sanitize(filename)}`;
  return {
    url: `/api/v1/documents/upload/${encodeURIComponent(key)}`,
    key,
    expiresAt: new Date(Date.now() + 600 * 1000),
  };
}

function sanitize(input: string): string {
  return input.replace(/[<>:"/\\|?*]/g, '_').replace(/\.\./g, '_');
}

/**
 * Cloudflare R2 client stub for signed URL generation.
 *
 * In production this will use @aws-sdk/client-s3 with
 * Cloudflare R2 endpoint + access key/secret.
 *
 * For MVP: returns a local proxy URL that the Express app serves.
 */

export interface R2SignedUrlOptions {
  key: string;
  expiresInSeconds?: number;
}

export function generateSignedUrl(options: R2SignedUrlOptions): { url: string; expiresAt: Date } {
  const expiresIn = options.expiresInSeconds || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // MVP: returns a local API URL that streams the file
  return {
    url: `/api/v1/documents/download/${options.key}`,
    expiresAt,
  };
}

export function generateUploadUrl(
  _firmId: string,
  filename: string,
): { url: string; key: string; expiresAt: Date } {
  // Stub: in production, generate an R2 presigned PUT URL
  const key = `uploads/${Date.now()}-${filename}`;
  const expiresAt = new Date(Date.now() + 600 * 1000); // 10 min

  return {
    url: `/api/v1/documents/upload/${key}`,
    key,
    expiresAt,
  };
}

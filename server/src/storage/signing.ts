import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedObjectParams {
  bucket: string;
  objectKey: string;
  expiresAt: number;
}

function payload(params: SignedObjectParams): string {
  return `${params.bucket}:${params.objectKey}:${params.expiresAt}`;
}

export function signObjectAccess(
  secret: string,
  params: SignedObjectParams
): string {
  return createHmac('sha256', secret).update(payload(params)).digest('hex');
}

export function verifyObjectAccess(
  secret: string,
  params: SignedObjectParams,
  signature: string
): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Date.now() / 1000 > params.expiresAt) return false;
  const expected = signObjectAccess(secret, params);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function buildSignedUrl(
  apiBaseUrl: string,
  secret: string,
  bucket: string,
  objectKey: string,
  expiresInSeconds: number
): { signedUrl: string; expiresAt: number; token: string } {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = signObjectAccess(secret, { bucket, objectKey, expiresAt });
  const base = apiBaseUrl.replace(/\/$/, '');
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const signedUrl = `${base}/storage/v1/object/sign/${bucket}/${encodedKey}?token=${token}&expires=${expiresAt}`;
  return { signedUrl, expiresAt, token };
}

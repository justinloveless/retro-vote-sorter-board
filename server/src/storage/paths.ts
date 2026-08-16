import path from 'node:path';
import { STORAGE_BUCKET_PREFIXES, type StorageBucketPrefix } from '../routes/storageBuckets.js';

export function isBucketPrefix(value: string): value is StorageBucketPrefix {
  return (STORAGE_BUCKET_PREFIXES as readonly string[]).includes(value);
}

/** Normalize object key: strip leading slashes, reject traversal. */
export function normalizeObjectKey(raw: string): string | null {
  const cleaned = raw.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!cleaned || cleaned.includes('\0')) return null;
  const parts = cleaned.split('/').filter((p) => p.length > 0);
  if (parts.some((p) => p === '.' || p === '..')) return null;
  return parts.join('/');
}

export function absoluteObjectPath(
  uploadsDir: string,
  bucket: StorageBucketPrefix,
  objectKey: string
): string {
  return path.join(uploadsDir, bucket, objectKey);
}

export function publicObjectUrl(
  apiBaseUrl: string,
  bucket: StorageBucketPrefix,
  objectKey: string
): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/storage/v1/object/public/${bucket}/${encodedKey}`;
}

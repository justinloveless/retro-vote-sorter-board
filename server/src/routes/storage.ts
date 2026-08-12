import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';

/** Bucket prefixes under the retroscope_uploads volume (Phase 1 stubs). */
export const STORAGE_BUCKET_PREFIXES = [
  'avatars',
  'poker-session-chat-images',
  'retro-audio',
  'tts-audio-cache',
] as const;

export type StorageBucketPrefix = (typeof STORAGE_BUCKET_PREFIXES)[number];

function isBucketPrefix(value: string): value is StorageBucketPrefix {
  return (STORAGE_BUCKET_PREFIXES as readonly string[]).includes(value);
}

export async function ensureUploadDirs(uploadsDir: string): Promise<void> {
  await mkdir(uploadsDir, { recursive: true });
  await Promise.all(
    STORAGE_BUCKET_PREFIXES.map((prefix) => mkdir(path.join(uploadsDir, prefix), { recursive: true }))
  );
}

export async function registerStorageRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  await ensureUploadDirs(config.UPLOADS_DIR);

  app.get('/api/storage/buckets', async () => ({
    buckets: STORAGE_BUCKET_PREFIXES.map((name) => ({
      name,
      path: path.posix.join('/data/uploads', name),
    })),
  }));

  app.get<{ Params: { bucket: string; '*': string } }>(
    '/api/storage/:bucket/*',
    async (request, reply) => {
      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }

      // Phase 1 stub — object serving lands in Phase 4.
      return reply.status(501).send({
        error: 'Storage object serving not implemented yet',
        bucket,
        objectPath: request.params['*'] || '',
        phase: 4,
      });
    }
  );

  app.put<{ Params: { bucket: string; '*': string } }>(
    '/api/storage/:bucket/*',
    async (request, reply) => {
      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }

      return reply.status(501).send({
        error: 'Storage uploads not implemented yet',
        bucket,
        objectPath: request.params['*'] || '',
        phase: 4,
      });
    }
  );
}

import { createReadStream } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { requireUser } from '../lib/requestAuth.js';
import {
  absoluteObjectPath,
  isBucketPrefix,
  normalizeObjectKey,
  publicObjectUrl,
} from '../storage/paths.js';
import { buildSignedUrl, verifyObjectAccess } from '../storage/signing.js';
import {
  PUBLIC_STORAGE_BUCKETS,
  STORAGE_BUCKET_PREFIXES,
} from './storageBuckets.js';

export { STORAGE_BUCKET_PREFIXES, type StorageBucketPrefix } from './storageBuckets.js';

function parseJsonBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Buffer.isBuffer(body) && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    const text = Buffer.from(body).toString('utf8').trim();
    if (!text) return {};
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

const STORAGE_BODY_LIMIT = 25 * 1024 * 1024;

export async function ensureUploadDirs(uploadsDir: string): Promise<void> {
  await mkdir(uploadsDir, { recursive: true });
  await Promise.all(
    STORAGE_BUCKET_PREFIXES.map((prefix) => mkdir(path.join(uploadsDir, prefix), { recursive: true }))
  );
}

function apiPublicBase(config: AppConfig, request: FastifyRequest): string {
  if (config.SELF_HOSTED_API_BASE_URL) {
    return config.SELF_HOSTED_API_BASE_URL.replace(/\/$/, '');
  }
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const proto = (request.headers['x-forwarded-proto'] as string) || 'http';
  if (host) return `${proto}://${host}`;
  return `http://${config.HOST}:${config.PORT}`;
}

function resolveObjectKey(raw: string | undefined): string | null {
  return normalizeObjectKey(raw || '');
}

async function sendObjectFile(
  reply: FastifyReply,
  filePath: string,
  contentType?: string
): Promise<void> {
  try {
    await access(filePath);
  } catch {
    await reply.status(404).send({ error: 'Object not found' });
    return;
  }

  const stream = createReadStream(filePath);
  if (contentType) {
    reply.header('Content-Type', contentType);
  }
  reply.header('Cache-Control', 'public, max-age=3600');
  return reply.send(stream);
}

async function writeObjectFromBody(
  request: FastifyRequest,
  filePath: string,
  upsert: boolean
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const body = request.body;
  if (!Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
    return { ok: false, status: 400, error: 'Expected binary body' };
  }

  await mkdir(path.dirname(filePath), { recursive: true });

  if (!upsert) {
    try {
      await access(filePath);
      return { ok: false, status: 409, error: 'Object already exists' };
    } catch {
      // does not exist — ok
    }
  }

  await writeFile(filePath, Buffer.from(body));
  return { ok: true };
}

type BucketParams = { bucket: string; '*': string };

export async function registerStorageRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  await ensureUploadDirs(config.UPLOADS_DIR);

  app.get('/api/storage/buckets', async () => ({
    buckets: STORAGE_BUCKET_PREFIXES.map((name) => ({
      name,
      path: path.posix.join('/data/uploads', name),
      public: PUBLIC_STORAGE_BUCKETS.has(name),
    })),
  }));

  await app.register(async (scoped) => {
    scoped.addContentTypeParser(
      '*',
      { parseAs: 'buffer' },
      (_request, body, done) => {
        done(null, body);
      }
    );

    const putOrPostObject = async (
      request: FastifyRequest<{ Params: BucketParams; Querystring: { upsert?: string } }>,
      reply: FastifyReply
    ) => {
      const claims = await requireUser(request, reply, config);
      if (!claims) return;

      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }

      const objectKey = resolveObjectKey(request.params['*']);
      if (!objectKey) {
        return reply.status(400).send({ error: 'Invalid object path' });
      }

      const upsertHeader = String(request.headers['x-upsert'] ?? '').toLowerCase();
      const upsert =
        upsertHeader === 'true' ||
        request.query.upsert === 'true' ||
        request.query.upsert === '1';

      const filePath = absoluteObjectPath(config.UPLOADS_DIR, bucket, objectKey);
      const result = await writeObjectFromBody(request, filePath, upsert);
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error });
      }

      const base = apiPublicBase(config, request);
      return reply.status(200).send({
        Key: `${bucket}/${objectKey}`,
        Id: objectKey,
        publicUrl: publicObjectUrl(base, bucket, objectKey),
      });
    };

    const getPublicObject = async (
      request: FastifyRequest<{ Params: BucketParams }>,
      reply: FastifyReply
    ) => {
      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }
      if (!PUBLIC_STORAGE_BUCKETS.has(bucket)) {
        return reply.status(403).send({ error: 'Bucket is not public' });
      }

      const objectKey = resolveObjectKey(request.params['*']);
      if (!objectKey) {
        return reply.status(400).send({ error: 'Invalid object path' });
      }

      const filePath = absoluteObjectPath(config.UPLOADS_DIR, bucket, objectKey);
      return sendObjectFile(reply, filePath, request.headers.accept?.includes('application/json') ? undefined : undefined);
    };

    const getSignedObject = async (
      request: FastifyRequest<{
        Params: BucketParams;
        Querystring: { token?: string; expires?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }

      const objectKey = resolveObjectKey(request.params['*']);
      if (!objectKey) {
        return reply.status(400).send({ error: 'Invalid object path' });
      }

      const token = request.query.token;
      const expires = Number(request.query.expires);
      if (!token || !Number.isFinite(expires)) {
        return reply.status(400).send({ error: 'token and expires query params required' });
      }

      const secret = config.JWT_SECRET;
      if (!secret) {
        return reply.status(503).send({ error: 'JWT_SECRET not configured' });
      }

      if (!verifyObjectAccess(secret, { bucket, objectKey, expiresAt: expires }, token)) {
        return reply.status(403).send({ error: 'Invalid or expired signature' });
      }

      const filePath = absoluteObjectPath(config.UPLOADS_DIR, bucket, objectKey);
      return sendObjectFile(reply, filePath);
    };

    const deleteObject = async (
      request: FastifyRequest<{ Params: BucketParams }>,
      reply: FastifyReply
    ) => {
      const claims = await requireUser(request, reply, config);
      if (!claims) return;

      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }

      const objectKey = resolveObjectKey(request.params['*']);
      if (!objectKey) {
        return reply.status(400).send({ error: 'Invalid object path' });
      }

      const filePath = absoluteObjectPath(config.UPLOADS_DIR, bucket, objectKey);
      try {
        await unlink(filePath);
      } catch {
        return reply.status(404).send({ error: 'Object not found' });
      }

      return reply.status(200).send({ message: 'Deleted' });
    };

    const createSignedUrlHandler = async (
      request: FastifyRequest<{ Params: BucketParams }>,
      reply: FastifyReply
    ) => {
      const claims = await requireUser(request, reply, config);
      if (!claims) return;

      const { bucket } = request.params;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }

      const objectKey = resolveObjectKey(request.params['*']);
      if (!objectKey) {
        return reply.status(400).send({ error: 'Invalid object path' });
      }

      const secret = config.JWT_SECRET;
      if (!secret) {
        return reply.status(503).send({ error: 'JWT_SECRET not configured' });
      }

      let body: Record<string, unknown> = {};
      try {
        body = parseJsonBody(request.body);
      } catch {
        return reply.status(400).send({ error: 'Invalid JSON body' });
      }

      const rawExpires = body.expiresIn;
      const expiresIn =
        typeof rawExpires === 'number' && rawExpires > 0
          ? Math.min(rawExpires, 60 * 60 * 24 * 7)
          : 3600;

      const base = apiPublicBase(config, request);
      const signed = buildSignedUrl(base, secret, bucket, objectKey, expiresIn);
      return reply.send({
        signedURL: signed.signedUrl,
        signedUrl: signed.signedUrl,
        token: signed.token,
        expiresAt: signed.expiresAt,
      });
    };

    const routeOpts = { bodyLimit: STORAGE_BODY_LIMIT };

    // Supabase-compatible paths
    scoped.put('/storage/v1/object/:bucket/*', routeOpts, putOrPostObject);
    scoped.post('/storage/v1/object/:bucket/*', routeOpts, putOrPostObject);
    scoped.get('/storage/v1/object/public/:bucket/*', getPublicObject);
    scoped.get('/storage/v1/object/sign/:bucket/*', getSignedObject);
    scoped.delete('/storage/v1/object/:bucket/*', deleteObject);
    scoped.post('/storage/v1/object/sign/:bucket/*', routeOpts, createSignedUrlHandler);

    // Phase 1 aliases under /api/storage
    scoped.put('/api/storage/:bucket/*', routeOpts, putOrPostObject);
    scoped.post('/api/storage/:bucket/*', routeOpts, putOrPostObject);
    scoped.get('/api/storage/:bucket/*', async (request, reply) => {
      const { bucket } = request.params as BucketParams;
      if (isBucketPrefix(bucket) && PUBLIC_STORAGE_BUCKETS.has(bucket)) {
        return getPublicObject(request as FastifyRequest<{ Params: BucketParams }>, reply);
      }
      const claims = await requireUser(request, reply, config);
      if (!claims) return;
      if (!isBucketPrefix(bucket)) {
        return reply.status(404).send({ error: 'Unknown storage bucket' });
      }
      const objectKey = resolveObjectKey((request.params as BucketParams)['*']);
      if (!objectKey) {
        return reply.status(400).send({ error: 'Invalid object path' });
      }
      const filePath = absoluteObjectPath(config.UPLOADS_DIR, bucket, objectKey);
      return sendObjectFile(reply, filePath);
    });
    scoped.delete('/api/storage/:bucket/*', deleteObject);
  });
}

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import Fastify from 'fastify';
import { SignJWT } from 'jose';
import { registerStorageRoutes } from '../routes/storage.js';
import type { AppConfig } from '../config.js';

const JWT_SECRET = 'phase4-storage-test-secret-32chars!!';

async function mintToken(userId: string): Promise<string> {
  return new SignJWT({ role: 'authenticated', email: 'qa@example.com' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('retroscope-auth')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

describe('storage routes', () => {
  let uploadsDir = '';
  let app: ReturnType<typeof Fastify>;
  let token = '';

  before(async () => {
    uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'retroscope-uploads-'));
    token = await mintToken('11111111-1111-1111-1111-111111111111');
    const config = {
      NODE_ENV: 'test',
      PORT: 3000,
      HOST: '127.0.0.1',
      UPLOADS_DIR: uploadsDir,
      JWT_SECRET,
      SELF_HOSTED_API_BASE_URL: 'http://127.0.0.1:3000',
      JWT_ISSUER: 'retroscope-auth',
      JWT_ACCESS_TTL_SECONDS: 3600,
      ALLOW_ORIGINS: '*',
      POSTGREST_URL: 'http://postgrest:3000',
      SMTP_PORT: 587,
      allowOrigins: ['*'],
    } as AppConfig;

    app = Fastify({ bodyLimit: 25 * 1024 * 1024 });
    await registerStorageRoutes(app, config);
    await app.ready();
  });

  after(async () => {
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('lists bucket prefixes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/storage/buckets' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { buckets: Array<{ name: string }> };
    assert.ok(body.buckets.some((b) => b.name === 'avatars'));
  });

  it('uploads and serves a public avatar object', async () => {
    const bytes = Buffer.from('fake-png-bytes');
    const put = await app.inject({
      method: 'POST',
      url: '/storage/v1/object/avatars/qa/avatar.png',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'image/png',
        'x-upsert': 'true',
      },
      payload: bytes,
    });
    assert.equal(put.statusCode, 200, put.body);

    const onDisk = await readFile(path.join(uploadsDir, 'avatars', 'qa', 'avatar.png'));
    assert.deepEqual(onDisk, bytes);

    const get = await app.inject({
      method: 'GET',
      url: '/storage/v1/object/public/avatars/qa/avatar.png',
    });
    assert.equal(get.statusCode, 200);
    assert.deepEqual(Buffer.from(get.rawPayload), bytes);
  });

  it('creates and consumes a signed URL', async () => {
    await writeFile(path.join(uploadsDir, 'retro-audio', 'clip.mp3'), Buffer.from('audio'));
    const sign = await app.inject({
      method: 'POST',
      url: '/storage/v1/object/sign/retro-audio/clip.mp3',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { expiresIn: 300 },
    });
    assert.equal(sign.statusCode, 200, sign.body);
    const { signedUrl } = sign.json() as { signedUrl: string };
    const pathAndQuery = signedUrl.replace('http://127.0.0.1:3000', '');
    const get = await app.inject({ method: 'GET', url: pathAndQuery });
    assert.equal(get.statusCode, 200);
    assert.equal(get.body, 'audio');
  });

  it('rejects unknown buckets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/storage/v1/object/public/not-a-bucket/x',
    });
    assert.equal(res.statusCode, 404);
  });
});

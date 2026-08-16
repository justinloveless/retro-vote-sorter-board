import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { SignJWT } from 'jose';
import { requireAdminForMigrate } from './migrateAuth.js';
import type { AppConfig } from '../config.js';

const LOCAL_SECRET = 'local-jwt-secret-at-least-32-characters!!';

async function mintLocalToken(userId: string): Promise<string> {
  return new SignJWT({ role: 'authenticated', email: 'admin@example.com' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('retroscope-auth')
    .sign(new TextEncoder().encode(LOCAL_SECRET));
}

describe('requireAdminForMigrate', () => {
  it('returns 401 with hint when Authorization is missing', async () => {
    const app = Fastify();
    app.get('/t', async (request, reply) => {
      const claims = await requireAdminForMigrate(request, reply, {} as AppConfig);
      if (!claims) return reply;
      return { ok: true };
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/t' });
    assert.equal(res.statusCode, 401);
    assert.match(res.json().hint || '', /Missing Bearer/i);
    await app.close();
  });

  it('returns 401 with dual-path hint when local JWT fails and no Supabase URL', async () => {
    const app = Fastify();
    const config = {
      JWT_SECRET: LOCAL_SECRET,
    } as AppConfig;
    app.get('/t', async (request, reply) => {
      const claims = await requireAdminForMigrate(request, reply, config);
      if (!claims) return reply;
      return { ok: true };
    });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/t',
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    });
    assert.equal(res.statusCode, 401);
    assert.match(res.json().hint || '', /hosted Supabase/i);
    await app.close();
  });

  it('accepts a valid local JWT then 403s when no admin profile sources exist', async () => {
    const app = Fastify();
    const userId = '11111111-1111-1111-1111-111111111111';
    const config = {
      JWT_SECRET: LOCAL_SECRET,
      // no DATABASE_URL / migrate source → admin check fails closed
    } as AppConfig;
    app.get('/t', async (request, reply) => {
      const claims = await requireAdminForMigrate(request, reply, config);
      if (!claims) return reply;
      return { ok: true, sub: claims.sub };
    });
    await app.ready();
    const token = await mintLocalToken(userId);
    const res = await app.inject({
      method: 'GET',
      url: '/t',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
    assert.match(res.json().hint || '', /admin profile/i);
    await app.close();
  });
});

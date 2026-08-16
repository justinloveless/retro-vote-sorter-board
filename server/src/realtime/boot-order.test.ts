import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { attachRealtimeGateway } from './gateway.js';
import type { AppConfig } from '../config.js';

/**
 * Regression for FST_ERR_INSTANCE_ALREADY_LISTENING:
 * Socket.IO must attach after listen; hooks/routes must be registered before.
 */
describe('realtime Fastify boot order', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  after(async () => {
    for (const app of apps) {
      await app.close().catch(() => undefined);
    }
  });

  it('boots like production: routes → onClose hook → listen → attach Socket.IO', async () => {
    const app = Fastify({ logger: false });
    apps.push(app);

    await app.register(cors, { origin: true });
    app.get('/healthz', async () => ({ status: 'healthy' }));
    app.get('/', async () => ({ phase: 5 }));

    let closed = false;
    let gatewayClose: (() => Promise<void>) | null = null;
    app.addHook('onClose', async () => {
      closed = true;
      await gatewayClose?.();
    });

    await app.listen({ port: 0, host: '127.0.0.1' });

    const gateway = await attachRealtimeGateway(app, {
      NODE_ENV: 'test',
      PORT: 0,
      HOST: '127.0.0.1',
      allowOrigins: ['*'],
      JWT_SECRET: 'test-secret-key-with-at-least-32-chars!!',
      JWT_ISSUER: 'retroscope-auth',
      JWT_ACCESS_TTL_SECONDS: 3600,
      POSTGREST_URL: 'http://localhost:3000',
      UPLOADS_DIR: '/tmp',
      ALLOW_ORIGINS: '*',
      SMTP_PORT: 587,
    } as AppConfig);
    gatewayClose = () => gateway.close();

    const address = app.server.address();
    assert.ok(address && typeof address !== 'string');
    const res = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(res.status, 200);

    await app.close();
    assert.equal(closed, true);
  });
});

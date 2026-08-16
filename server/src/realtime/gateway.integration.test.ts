import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Fastify from 'fastify';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { signAccessToken } from '../auth/jwt.js';
import { attachRealtimeGateway, type RealtimeGateway } from './gateway.js';
import type { AppConfig } from '../config.js';

const SECRET = 'test-secret-key-with-at-least-32-chars!!';

describe('realtime gateway socket protocol', () => {
  let gateway: RealtimeGateway;
  let baseUrl: string;
  let token: string;
  const clients: ClientSocket[] = [];

  before(async () => {
    const app = Fastify({ logger: false });
    const config = {
      NODE_ENV: 'test',
      PORT: 0,
      HOST: '127.0.0.1',
      allowOrigins: ['*'],
      JWT_SECRET: SECRET,
      JWT_ISSUER: 'retroscope-auth',
      JWT_ACCESS_TTL_SECONDS: 3600,
      POSTGREST_URL: 'http://localhost:3000',
      UPLOADS_DIR: '/tmp',
      ALLOW_ORIGINS: '*',
      SMTP_PORT: 587,
      // No DATABASE_URL → LISTEN skipped
    } as AppConfig;

    gateway = await attachRealtimeGateway(app, config);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    const signed = await signAccessToken({
      secret: SECRET,
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'qa@example.com',
      expiresInSeconds: 3600,
    });
    token = signed.token;

    // keep app open via gateway; close in after()
    (globalThis as { __rtApp?: typeof app }).__rtApp = app;
  });

  after(async () => {
    for (const c of clients) c.disconnect();
    await gateway.close();
    const app = (globalThis as { __rtApp?: { close: () => Promise<void> } }).__rtApp;
    if (app) await app.close();
  });

  function connectClient(): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioc(baseUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token },
      });
      clients.push(socket);
      const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  it('subscribes and relays broadcast + presence', async () => {
    const a = await connectClient();
    const b = await connectClient();

    await new Promise<void>((resolve, reject) => {
      a.emit(
        'channel:subscribe',
        {
          topic: 'poker_session:s1',
          config: { presence: { key: 'user-a' } },
          bindings: [],
        },
        (status: string) => (status === 'SUBSCRIBED' ? resolve() : reject(new Error(status)))
      );
    });
    await new Promise<void>((resolve, reject) => {
      b.emit(
        'channel:subscribe',
        {
          topic: 'poker_session:s1',
          config: { presence: { key: 'user-b' } },
          bindings: [],
        },
        (status: string) => (status === 'SUBSCRIBED' ? resolve() : reject(new Error(status)))
      );
    });

    const broadcastSeen = new Promise<unknown>((resolve) => {
      b.on('broadcast', (msg) => {
        if (msg.event === 'round_updated') resolve(msg.payload);
      });
    });

    a.emit('broadcast:send', {
      topic: 'poker_session:s1',
      event: 'round_updated',
      payload: { round_number: 2 },
    });

    assert.deepEqual(await broadcastSeen, { round_number: 2 });

    const presenceSync = new Promise<Record<string, unknown>>((resolve) => {
      b.on('presence', (msg) => {
        if (msg.event === 'sync' && msg.state?.['user-a']) resolve(msg.state);
      });
    });

    a.emit('presence:track', {
      topic: 'poker_session:s1',
      key: 'user-a',
      payload: { user_id: 'user-a' },
    });

    const state = await presenceSync;
    assert.ok(state['user-a']);
  });
});

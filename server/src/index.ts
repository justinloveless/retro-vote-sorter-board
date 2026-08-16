import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';
import { closePool } from './lib/db.js';
import { getRealtimeGateway, registerRealtime } from './realtime/index.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFunctionRoutes } from './routes/functions.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerRestProxyRoutes } from './routes/restProxy.js';
import { registerStorageRoutes } from './routes/storage.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, {
    origin: config.allowOrigins.includes('*')
      ? true
      : (origin, cb) => {
          if (!origin) {
            // Non-browser / same-origin tooling
            cb(null, true);
            return;
          }
          const allowed = config.allowOrigins.some(
            (entry) => entry === origin || entry.replace(/\/$/, '') === origin.replace(/\/$/, '')
          );
          cb(null, allowed);
        },
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'Prefer',
      'Range',
      'apikey',
      'x-client-info',
      'accept-profile',
      'content-profile',
      'x-supabase-client-platform',
      'x-supabase-client-platform-version',
      'x-supabase-client-runtime',
      'x-supabase-client-runtime-version',
    ],
    exposedHeaders: ['Content-Range', 'Prefer'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  });

  app.log.info(
    {
      allowOrigins: config.allowOrigins,
      publicSiteUrl: config.PUBLIC_SITE_URL ?? null,
    },
    'CORS configured'
  );

  await registerHealthRoutes(app, config);
  await registerAdminRoutes(app, config);
  await registerStorageRoutes(app, config);
  await registerFunctionRoutes(app, config);
  await registerAuthRoutes(app, config);
  await registerRestProxyRoutes(app, config);

  app.get('/', async () => ({
    name: 'retroscope-api',
    phase: 5,
    endpoints: [
      '/healthz',
      '/readyz',
      '/rest/v1/*',
      '/auth/v1/signup',
      '/auth/v1/token',
      '/auth/v1/user',
      '/auth/v1/logout',
      '/auth/v1/authorize',
      '/auth/v1/callback',
      '/auth/v1/recover',
      '/api/admin/backend-status',
      '/api/admin/migrate-from-supabase',
      '/api/storage/buckets',
      '/storage/v1/object/*',
      '/functions/v1/*',
      '/socket.io',
    ],
    stripe: {
      decision: 'keep_on_supabase',
      note: 'Billing edge functions stay on hosted Supabase until a later cutover',
    },
  }));

  // Register before listen/ready — Fastify rejects addHook after the instance has started.
  app.addHook('onClose', async () => {
    await getRealtimeGateway()?.close();
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`Retroscope API listening on ${config.HOST}:${config.PORT}`);

  // Attach Socket.IO to the listening HTTP server (WebSocket upgrade on /socket.io).
  await registerRealtime(app, config);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

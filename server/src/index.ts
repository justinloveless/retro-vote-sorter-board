import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';
import { closePool } from './lib/db.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
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
    origin: config.allowOrigins.includes('*') ? true : config.allowOrigins,
    credentials: true,
  });

  await registerHealthRoutes(app, config);
  await registerAdminRoutes(app, config);
  await registerStorageRoutes(app, config);
  await registerAuthRoutes(app, config);
  await registerRestProxyRoutes(app, config);

  app.get('/', async () => ({
    name: 'retroscope-api',
    phase: 3,
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
      '/api/storage/buckets',
    ],
  }));

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

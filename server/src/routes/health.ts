import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { checkPostgres } from '../lib/db.js';
import { checkPostgrest } from '../lib/postgrest.js';

export async function registerHealthRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/healthz', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));

  app.get('/readyz', async (_request, reply) => {
    const [postgres, postgrest] = await Promise.all([
      checkPostgres(config),
      checkPostgrest(config),
    ]);

    const ready = postgres.ok && postgrest.ok;
    const body = {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        postgres,
        postgrest,
      },
    };

    if (!ready) {
      return reply.status(503).send(body);
    }

    return body;
  });
}

import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { checkPostgres } from '../lib/db.js';
import { checkPostgrest } from '../lib/postgrest.js';

/**
 * Phase 1 stub: require a Bearer token. Full admin JWT + role checks land in Phase 2.
 * FE already gates /admin/backend via profiles.role === 'admin'.
 */
function hasBearerToken(authorization: string | undefined): boolean {
  if (!authorization) return false;
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && Boolean(token?.trim());
}

export async function registerAdminRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/admin/backend-status', async (request, reply) => {
    if (!hasBearerToken(request.headers.authorization)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const [postgres, postgrest] = await Promise.all([
      checkPostgres(config),
      checkPostgrest(config),
    ]);

    return {
      modeHint: 'supabase', // Phase 1: both FE modes still use hosted Supabase
      selfHostedApiBaseUrl: config.SELF_HOSTED_API_BASE_URL ?? null,
      checks: {
        api: { ok: true },
        postgres,
        postgrest,
        realtime: { ok: false, error: 'Not implemented until Phase 5' },
      },
      timestamp: new Date().toISOString(),
    };
  });
}

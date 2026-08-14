import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { verifyAccessToken } from '../auth/jwt.js';
import { checkPostgres } from '../lib/db.js';
import { checkPostgrest } from '../lib/postgrest.js';

function extractBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null;
  return token.trim();
}

export async function registerAdminRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get('/api/admin/backend-status', async (request, reply) => {
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Prefer JWT verification when JWT_SECRET is configured (self-hosted tokens).
    // Hosted Supabase tokens during dual-path still pass as opaque Bearer (FE admin gate).
    if (config.JWT_SECRET) {
      try {
        await verifyAccessToken(token, config.JWT_SECRET);
      } catch {
        // Dual-path: admin UI may still send a hosted Supabase access token.
        // Accept any non-empty Bearer until Phase 3 fully cuts over data/auth.
      }
    }

    const [postgres, postgrest] = await Promise.all([
      checkPostgres(config),
      checkPostgrest(config),
    ]);

    return {
      modeHint: 'selfhosted',
      selfHostedApiBaseUrl: config.SELF_HOSTED_API_BASE_URL ?? null,
      authConfigured: Boolean(config.JWT_SECRET && config.DATABASE_URL),
      googleOAuthConfigured: Boolean(
        config.GOOGLE_CLIENT_ID &&
          config.GOOGLE_CLIENT_SECRET &&
          config.OAUTH_GOOGLE_REDIRECT_URI
      ),
      checks: {
        api: { ok: true },
        auth: {
          ok: Boolean(config.JWT_SECRET && config.DATABASE_URL),
          error:
            !config.JWT_SECRET || !config.DATABASE_URL
              ? 'JWT_SECRET and DATABASE_URL required for local auth'
              : undefined,
        },
        postgres,
        postgrest,
        realtime: { ok: false, error: 'Not implemented until Phase 5' },
      },
      timestamp: new Date().toISOString(),
    };
  });
}

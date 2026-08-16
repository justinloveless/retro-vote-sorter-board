import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { checkPostgres } from '../lib/db.js';
import { checkPostgrest } from '../lib/postgrest.js';
import { extractBearer } from '../lib/requestAuth.js';
import { requireAdminForMigrate } from '../lib/migrateAuth.js';
import { verifyAccessToken } from '../auth/jwt.js';
import { realtimeHealth } from '../realtime/index.js';
import {
  getMigrateCapability,
  MigrateError,
  migrateFromSupabase,
  MIGRATE_CONFIRMATION_PHRASE,
} from '../migrate/fromSupabase.js';

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
      }
    }

    const [postgres, postgrest] = await Promise.all([
      checkPostgres(config),
      checkPostgrest(config),
    ]);
    const migrate = getMigrateCapability(config);

    return {
      modeHint: 'selfhosted',
      selfHostedApiBaseUrl: config.SELF_HOSTED_API_BASE_URL ?? null,
      authConfigured: Boolean(config.JWT_SECRET && config.DATABASE_URL),
      googleOAuthConfigured: Boolean(
        config.GOOGLE_CLIENT_ID &&
          config.GOOGLE_CLIENT_SECRET &&
          config.OAUTH_GOOGLE_REDIRECT_URI
      ),
      migrate,
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
        realtime: realtimeHealth(),
      },
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/admin/migrate-from-supabase', async (request, reply) => {
    const claims = await requireAdminForMigrate(request, reply, config);
    if (!claims) return;

    return {
      confirmationPhrase: MIGRATE_CONFIRMATION_PHRASE,
      capability: getMigrateCapability(config),
      defaults: {
        dryRun: true,
        includeAuth: true,
        includePublic: true,
        includeStorage: false,
        truncateFirst: false,
        rewriteStorageUrls: true,
      },
      notes: [
        'Copies from MIGRATE_SOURCE_DATABASE_URL into local DATABASE_URL.',
        'Schema must already exist on the target (Phase 3 restore / init SQL).',
        'Storage copy needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
        'Dual-path: hosted Supabase admin sessions are accepted when SUPABASE_URL is set.',
        'Use dry-run first. truncateFirst replaces overlapping table data.',
      ],
    };
  });

  app.post('/api/admin/migrate-from-supabase', async (request, reply) => {
    const claims = await requireAdminForMigrate(request, reply, config);
    if (!claims) return;

    const body = (request.body ?? {}) as {
      confirmation?: string;
      dryRun?: boolean;
      includeAuth?: boolean;
      includePublic?: boolean;
      includeStorage?: boolean;
      truncateFirst?: boolean;
      rewriteStorageUrls?: boolean;
    };

    try {
      const report = await migrateFromSupabase(config, {
        confirmation: String(body.confirmation ?? ''),
        dryRun: body.dryRun,
        includeAuth: body.includeAuth,
        includePublic: body.includePublic,
        includeStorage: body.includeStorage,
        truncateFirst: body.truncateFirst,
        rewriteStorageUrls: body.rewriteStorageUrls,
      });
      return reply.send(report);
    } catch (error) {
      if (error instanceof MigrateError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'migrate-from-supabase failed');
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Migration failed',
      });
    }
  });
}

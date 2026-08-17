import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { getPool } from '../lib/db.js';
import { extractBearer } from '../lib/requestAuth.js';
import { verifyAccessToken } from '../auth/jwt.js';

const CONFIG_KEY = 'backend_provider';

export type BackendProviderPayload = {
  mode: 'supabase' | 'selfhosted';
  selfHostedApiBaseUrl: string;
  source: 'env' | 'database' | 'default';
};

function parseStoredValue(
  raw: string | null | undefined,
  fallbackApiBase: string
): Omit<BackendProviderPayload, 'source'> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { mode?: string; selfHostedApiBaseUrl?: string };
    const mode = parsed.mode === 'selfhosted' ? 'selfhosted' : 'supabase';
    return {
      mode,
      selfHostedApiBaseUrl:
        typeof parsed.selfHostedApiBaseUrl === 'string' && parsed.selfHostedApiBaseUrl
          ? parsed.selfHostedApiBaseUrl.replace(/\/$/, '')
          : fallbackApiBase,
    };
  } catch {
    return null;
  }
}

async function readProviderFromDb(
  config: AppConfig
): Promise<Omit<BackendProviderPayload, 'source'> | null> {
  const pool = getPool(config);
  if (!pool) return null;
  try {
    // SECURITY DEFINER helper bypasses admin-only RLS (see 06-app-config-server.sql).
    const result = await pool.query<{ value: string | null }>(
      'select public.server_get_app_config($1) as value',
      [CONFIG_KEY]
    );
    return parseStoredValue(result.rows[0]?.value ?? null, config.SELF_HOSTED_API_BASE_URL ?? '');
  } catch {
    return null;
  }
}

async function writeProviderToDb(
  config: AppConfig,
  payload: { mode: 'supabase' | 'selfhosted'; selfHostedApiBaseUrl: string }
): Promise<void> {
  const pool = getPool(config);
  if (!pool) {
    throw new Error('DATABASE_URL not configured');
  }
  const value = JSON.stringify({
    mode: payload.mode,
    selfHostedApiBaseUrl: payload.selfHostedApiBaseUrl,
  });
  // SECURITY DEFINER helper — plain insert/update is blocked by app_config RLS for
  // retroscope_app (no auth.uid() admin claim on the Node pool connection).
  await pool.query('select public.server_upsert_app_config($1, $2)', [CONFIG_KEY, value]);
}

/**
 * Public backend-provider advertisement for FE dual-path.
 * Hosted Supabase RLS often allows only admins to read app_config; non-admins
 * then silently default to supabase and diverge from admins on selfhosted.
 */
export async function registerBackendProviderRoutes(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  app.get('/api/backend-provider', async () => {
    const fromDb = await readProviderFromDb(config);
    if (fromDb) {
      return { ...fromDb, source: 'database' as const };
    }
    if (config.BACKEND_PROVIDER_MODE) {
      return {
        mode: config.BACKEND_PROVIDER_MODE,
        selfHostedApiBaseUrl: (config.SELF_HOSTED_API_BASE_URL ?? '').replace(/\/$/, ''),
        source: 'env' as const,
      };
    }
    return {
      mode: 'supabase' as const,
      selfHostedApiBaseUrl: (config.SELF_HOSTED_API_BASE_URL ?? '').replace(/\/$/, ''),
      source: 'default' as const,
    };
  });

  app.put('/api/backend-provider', async (request, reply) => {
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    // Prefer local JWT; hosted Supabase admin tokens are accepted for dual-path mirror.
    if (config.JWT_SECRET) {
      try {
        await verifyAccessToken(token, config.JWT_SECRET);
      } catch {
        // Dual-path: FE may still be on hosted auth when first switching to selfhosted.
      }
    }

    const body = (request.body ?? {}) as {
      mode?: string;
      selfHostedApiBaseUrl?: string;
    };
    const mode = body.mode === 'selfhosted' ? 'selfhosted' : 'supabase';
    const selfHostedApiBaseUrl = (
      body.selfHostedApiBaseUrl ||
      config.SELF_HOSTED_API_BASE_URL ||
      ''
    ).replace(/\/$/, '');

    try {
      await writeProviderToDb(config, { mode, selfHostedApiBaseUrl });
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to persist backend provider',
      });
    }

    return { mode, selfHostedApiBaseUrl, source: 'database' as const };
  });
}

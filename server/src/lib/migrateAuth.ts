import pg from 'pg';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { verifyAccessToken, type AccessTokenClaims } from '../auth/jwt.js';
import { extractBearer } from './requestAuth.js';
import { getPool } from './db.js';

const { Pool } = pg;

/**
 * Resolve the caller for migrate endpoints during dual-path cutover:
 * 1) Verify local self-hosted JWT (JWT_SECRET)
 * 2) Else validate the Bearer token against hosted Supabase Auth (/auth/v1/user)
 * 3) Require profiles.role = admin on local DB, else on MIGRATE_SOURCE_DATABASE_URL
 */
export async function requireAdminForMigrate(
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig
): Promise<AccessTokenClaims | null> {
  const token = extractBearer(request.headers.authorization);
  if (!token) {
    await reply.status(401).send({
      error: 'Unauthorized',
      hint: 'Missing Bearer token. Sign in and retry.',
    });
    return null;
  }

  let userId: string | null = null;
  let email: string | undefined;
  let authSource: 'local_jwt' | 'hosted_supabase' | null = null;

  if (config.JWT_SECRET) {
    try {
      const claims = await verifyAccessToken(token, config.JWT_SECRET);
      userId = claims.sub;
      email = typeof claims.email === 'string' ? claims.email : undefined;
      authSource = 'local_jwt';
    } catch {
      // Dual-path: browser may still hold a hosted Supabase access token.
    }
  }

  if (!userId) {
    const hosted = await resolveHostedSupabaseUser(config, token);
    if (hosted) {
      userId = hosted.id;
      email = hosted.email;
      authSource = 'hosted_supabase';
    }
  }

  if (!userId) {
    await reply.status(401).send({
      error: 'Unauthorized',
      hint:
        'Access token was not accepted as a local JWT or a hosted Supabase session. ' +
        'Set SUPABASE_URL (+ SUPABASE_SERVICE_ROLE_KEY) on the API so hosted admin sessions can call migrate, ' +
        'or sign in via self-hosted auth with a matching JWT_SECRET.',
      authSource: null,
    });
    return null;
  }

  const adminCheck = await isAdminUser(config, userId);
  if (!adminCheck.ok) {
    await reply.status(403).send({
      error: 'Forbidden',
      hint: adminCheck.hint,
      userId,
      authSource,
    });
    return null;
  }

  return {
    sub: userId,
    role: 'authenticated',
    email,
  };
}

async function resolveHostedSupabaseUser(
  config: AppConfig,
  accessToken: string
): Promise<{ id: string; email?: string } | null> {
  const supabaseUrl = config.SUPABASE_URL?.replace(/\/$/, '');
  const apiKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { id?: string; email?: string };
    if (!body.id || typeof body.id !== 'string') {
      return null;
    }
    return { id: body.id, email: body.email };
  } catch {
    return null;
  }
}

async function readAdminRole(
  connectionString: string,
  userId: string
): Promise<string | null> {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 8_000,
  });
  try {
    const result = await pool.query<{ role: string | null }>(
      `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.role ?? null;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function isAdminUser(
  config: AppConfig,
  userId: string
): Promise<{ ok: boolean; hint?: string }> {
  // 1) Local target DB
  const local = getPool(config);
  if (local) {
    try {
      const result = await local.query<{ role: string | null }>(
        `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
        [userId]
      );
      if (result.rows[0]?.role === 'admin') {
        return { ok: true };
      }
      if (result.rows[0]) {
        // Local profile exists but is not admin — still allow checking source in case
        // local data is stale pre-migrate, but prefer explicit admin on either side.
      }
    } catch {
      // profiles may not exist yet on an empty target
    }
  }

  // 2) Source Supabase DB (pre-migrate / empty local profiles)
  if (config.MIGRATE_SOURCE_DATABASE_URL) {
    try {
      const role = await readAdminRole(config.MIGRATE_SOURCE_DATABASE_URL, userId);
      if (role === 'admin') {
        return { ok: true };
      }
      if (role) {
        return {
          ok: false,
          hint: `Your user is "${role}" on the source Supabase profiles table; admin role is required.`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        hint: `Could not read source profiles for admin check: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  // 3) Hosted PostgREST via service role
  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const url = new URL(
        `${config.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles`
      );
      url.searchParams.set('id', `eq.${userId}`);
      url.searchParams.set('select', 'role');
      const response = await fetch(url, {
        headers: {
          apikey: config.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const rows = (await response.json()) as Array<{ role?: string }>;
        if (rows[0]?.role === 'admin') {
          return { ok: true };
        }
        if (rows[0]?.role) {
          return {
            ok: false,
            hint: `Your user is "${rows[0].role}" in hosted Supabase; admin role is required.`,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  return {
    ok: false,
    hint:
      'No admin profile found locally or on the Supabase source. ' +
      'Ensure profiles.role = admin for your user, or complete an auth/profile import first.',
  };
}

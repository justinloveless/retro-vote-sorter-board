import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { verifyAccessToken, type AccessTokenClaims } from '../auth/jwt.js';
import { getPool } from './db.js';

export function extractBearer(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) return null;
  return token.trim();
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig
): Promise<AccessTokenClaims | null> {
  const token = extractBearer(request.headers.authorization);
  if (!token) {
    await reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  if (!config.JWT_SECRET) {
    await reply.status(503).send({ error: 'JWT_SECRET not configured' });
    return null;
  }

  try {
    return await verifyAccessToken(token, config.JWT_SECRET);
  } catch {
    await reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig
): Promise<AccessTokenClaims | null> {
  const claims = await requireUser(request, reply, config);
  if (!claims) return null;

  const pool = getPool(config);
  if (!pool) {
    await reply.status(503).send({ error: 'DATABASE_URL not configured' });
    return null;
  }

  const result = await pool.query<{ role: string | null }>(
    `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
    [claims.sub]
  );
  if (result.rows[0]?.role !== 'admin') {
    await reply.status(403).send({ error: 'Forbidden' });
    return null;
  }

  return claims;
}

import type pg from 'pg';
import type { AccessTokenClaims } from '../auth/jwt.js';

type Queryable = Pick<pg.Pool, 'query'>;

export async function getProfileRole(
  db: Queryable,
  userId: string
): Promise<string | null> {
  const result = await db.query<{ role: string | null }>(
    `SELECT role FROM public.profiles WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.role ?? null;
}

export async function findUserIdByEmail(
  db: Queryable,
  email: string
): Promise<string | null> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM auth.users
     WHERE lower(email) = lower($1)
       AND deleted_at IS NULL
     LIMIT 1`,
    [email]
  );
  return result.rows[0]?.id ?? null;
}

export async function listUsersMatchingEmail(
  db: Queryable,
  query: string
): Promise<Array<{ id: string; email: string | null }>> {
  const result = await db.query<{ id: string; email: string | null }>(
    `SELECT id, email FROM auth.users
     WHERE deleted_at IS NULL
       AND email IS NOT NULL
       AND lower(email) LIKE lower($1)
     LIMIT 100`,
    [`%${query}%`]
  );
  return result.rows;
}

export async function getEmailsByIds(
  db: Queryable,
  ids: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;
  const result = await db.query<{ id: string; email: string | null }>(
    `SELECT id, email FROM auth.users
     WHERE id = ANY($1::uuid[])
       AND deleted_at IS NULL`,
    [ids]
  );
  for (const row of result.rows) {
    map.set(row.id, row.email);
  }
  return map;
}

export type FunctionResult = {
  status: number;
  body: unknown;
};

export type FunctionContext = {
  db: Queryable;
  claims: AccessTokenClaims;
  origin: string | null;
};

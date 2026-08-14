#!/usr/bin/env tsx
/**
 * Import Supabase auth.users + auth.identities into local auth schema,
 * preserving UUIDs for FK continuity (profiles, teams, votes, etc.).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run import-auth-users -- \
 *     --users ./export/users.json \
 *     --identities ./export/identities.json
 *
 * Export from hosted Supabase SQL editor:
 *   select id, email, encrypted_password, email_confirmed_at,
 *          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
 *          last_sign_in_at, aud, role, banned_until, is_sso_user, is_anonymous, deleted_at
 *   from auth.users;
 *
 *   select id, user_id, provider, provider_id, identity_data, email,
 *          created_at, updated_at, last_sign_in_at
 *   from auth.identities;
 *
 * Save each result set as a JSON array.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

interface ImportUser {
  id: string;
  email?: string | null;
  encrypted_password?: string | null;
  email_confirmed_at?: string | null;
  raw_app_meta_data?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
  aud?: string | null;
  role?: string | null;
  banned_until?: string | null;
  is_sso_user?: boolean | null;
  is_anonymous?: boolean | null;
  deleted_at?: string | null;
}

interface ImportIdentity {
  id: string;
  user_id: string;
  provider: string;
  provider_id: string;
  identity_data?: Record<string, unknown> | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
}

function parseArgs(argv: string[]): {
  usersPath: string;
  identitiesPath: string;
  dryRun: boolean;
} {
  let usersPath = '';
  let identitiesPath = '';
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--users') usersPath = argv[++i] ?? '';
    else if (arg === '--identities') identitiesPath = argv[++i] ?? '';
    else if (arg === '--dry-run') dryRun = true;
  }

  if (!usersPath || !identitiesPath) {
    console.error(
      'Usage: import-auth-users --users users.json --identities identities.json [--dry-run]'
    );
    process.exit(1);
  }

  return {
    usersPath: resolve(usersPath),
    identitiesPath: resolve(identitiesPath),
    dryRun,
  };
}

function loadJsonArray<T>(path: string): T[] {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON array`);
  }
  return parsed as T[];
}

async function main(): Promise<void> {
  const { usersPath, identitiesPath, dryRun } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const users = loadJsonArray<ImportUser>(usersPath);
  const identities = loadJsonArray<ImportIdentity>(identitiesPath);

  console.log(`Loaded ${users.length} users and ${identities.length} identities`);
  if (dryRun) {
    console.log('Dry run — no writes performed');
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  let usersUpserted = 0;
  let identitiesUpserted = 0;

  try {
    await client.query('BEGIN');

    for (const user of users) {
      if (!user.id) {
        throw new Error('User row missing id');
      }

      await client.query(
        `INSERT INTO auth.users (
           id, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at, last_sign_in_at,
           aud, role, banned_until, is_sso_user, is_anonymous, deleted_at
         ) VALUES (
           $1, $2, $3, $4,
           $5::jsonb, $6::jsonb,
           COALESCE($7::timestamptz, NOW()), COALESCE($8::timestamptz, NOW()), $9::timestamptz,
           COALESCE($10, 'authenticated'), COALESCE($11, 'authenticated'),
           $12::timestamptz, COALESCE($13, FALSE), COALESCE($14, FALSE), $15::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           encrypted_password = EXCLUDED.encrypted_password,
           email_confirmed_at = EXCLUDED.email_confirmed_at,
           raw_app_meta_data = EXCLUDED.raw_app_meta_data,
           raw_user_meta_data = EXCLUDED.raw_user_meta_data,
           updated_at = EXCLUDED.updated_at,
           last_sign_in_at = EXCLUDED.last_sign_in_at,
           aud = EXCLUDED.aud,
           role = EXCLUDED.role,
           banned_until = EXCLUDED.banned_until,
           is_sso_user = EXCLUDED.is_sso_user,
           is_anonymous = EXCLUDED.is_anonymous,
           deleted_at = EXCLUDED.deleted_at`,
        [
          user.id,
          user.email ?? null,
          user.encrypted_password ?? null,
          user.email_confirmed_at ?? null,
          JSON.stringify(user.raw_app_meta_data ?? {}),
          JSON.stringify(user.raw_user_meta_data ?? {}),
          user.created_at ?? null,
          user.updated_at ?? null,
          user.last_sign_in_at ?? null,
          user.aud ?? null,
          user.role ?? null,
          user.banned_until ?? null,
          user.is_sso_user ?? null,
          user.is_anonymous ?? null,
          user.deleted_at ?? null,
        ]
      );
      usersUpserted += 1;
    }

    for (const identity of identities) {
      if (!identity.id || !identity.user_id || !identity.provider || !identity.provider_id) {
        throw new Error(`Identity row incomplete: ${JSON.stringify(identity)}`);
      }

      await client.query(
        `INSERT INTO auth.identities (
           id, user_id, provider, provider_id, identity_data, email,
           created_at, updated_at, last_sign_in_at
         ) VALUES (
           $1, $2, $3, $4, $5::jsonb, $6,
           COALESCE($7::timestamptz, NOW()), COALESCE($8::timestamptz, NOW()), $9::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           provider = EXCLUDED.provider,
           provider_id = EXCLUDED.provider_id,
           identity_data = EXCLUDED.identity_data,
           email = EXCLUDED.email,
           updated_at = EXCLUDED.updated_at,
           last_sign_in_at = EXCLUDED.last_sign_in_at`,
        [
          identity.id,
          identity.user_id,
          identity.provider,
          identity.provider_id,
          JSON.stringify(identity.identity_data ?? {}),
          identity.email ?? null,
          identity.created_at ?? null,
          identity.updated_at ?? null,
          identity.last_sign_in_at ?? null,
        ]
      );
      identitiesUpserted += 1;
    }

    await client.query('COMMIT');
    console.log(
      `Import complete: ${usersUpserted} users, ${identitiesUpserted} identities upserted`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

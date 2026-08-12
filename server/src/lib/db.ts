import pg from 'pg';
import type { AppConfig } from '../config.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(config: AppConfig): pg.Pool | null {
  if (!config.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 3_000,
    });
  }

  return pool;
}

export async function checkPostgres(config: AppConfig): Promise<{ ok: boolean; error?: string }> {
  const db = getPool(config);
  if (!db) {
    return { ok: false, error: 'DATABASE_URL not configured' };
  }

  try {
    await db.query('select 1 as ok');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Postgres check failed',
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

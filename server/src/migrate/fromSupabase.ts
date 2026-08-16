import pg from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../config.js';
import { STORAGE_BUCKET_PREFIXES } from '../routes/storageBuckets.js';
import { absoluteObjectPath } from '../storage/paths.js';

const { Pool } = pg;

export const MIGRATE_CONFIRMATION_PHRASE = 'COPY FROM SUPABASE';

export type MigrateRequest = {
  confirmation: string;
  dryRun?: boolean;
  includeAuth?: boolean;
  includePublic?: boolean;
  includeStorage?: boolean;
  truncateFirst?: boolean;
  rewriteStorageUrls?: boolean;
};

export type TableCopyStat = {
  schema: string;
  table: string;
  rows: number;
  action: 'copied' | 'would_copy' | 'skipped';
  reason?: string;
};

export type StorageCopyStat = {
  bucket: string;
  objects: number;
  errors: number;
  action: 'copied' | 'would_copy' | 'skipped';
  reason?: string;
};

export type MigrateReport = {
  dryRun: boolean;
  includeAuth: boolean;
  includePublic: boolean;
  includeStorage: boolean;
  truncateFirst: boolean;
  tables: TableCopyStat[];
  storage: StorageCopyStat[];
  urlRewrite?: { updated: number };
  warnings: string[];
  durationMs: number;
};

let migrateInFlight = false;

const AUTH_TABLES = ['users', 'identities'] as const;
const SKIP_PUBLIC_TABLES = new Set([
  // Spatial / extension junk if present
  'spatial_ref_sys',
]);

function assertConfirmation(confirmation: string): void {
  if (confirmation.trim() !== MIGRATE_CONFIRMATION_PHRASE) {
    throw new MigrateError(
      `Confirmation must be exactly "${MIGRATE_CONFIRMATION_PHRASE}"`,
      400
    );
  }
}

export class MigrateError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'MigrateError';
  }
}

export function getMigrateCapability(config: AppConfig): {
  dataConfigured: boolean;
  storageConfigured: boolean;
  targetConfigured: boolean;
} {
  return {
    dataConfigured: Boolean(config.MIGRATE_SOURCE_DATABASE_URL),
    storageConfigured: Boolean(
      config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
    ),
    targetConfigured: Boolean(config.DATABASE_URL),
  };
}

function sameDatabaseTarget(sourceUrl: string, targetUrl: string): boolean {
  try {
    const a = new URL(sourceUrl);
    const b = new URL(targetUrl);
    return (
      a.hostname === b.hostname &&
      a.port === b.port &&
      a.pathname === b.pathname
    );
  } catch {
    return sourceUrl === targetUrl;
  }
}

async function listBaseTables(
  client: pg.PoolClient,
  schema: string
): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema]
  );
  return result.rows.map((r) => r.table_name);
}

async function listCopyableColumns(
  client: pg.PoolClient,
  schema: string,
  table: string
): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2
       AND is_generated <> 'ALWAYS'
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return result.rows.map((r) => r.column_name);
}

async function tableExists(
  client: pg.PoolClient,
  schema: string,
  table: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name = $2
       AND table_type = 'BASE TABLE'
     LIMIT 1`,
    [schema, table]
  );
  return result.rowCount === 1;
}

async function countRows(
  client: pg.PoolClient,
  schema: string,
  table: string
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${quoteIdent(schema)}.${quoteIdent(table)}`
  );
  return Number(result.rows[0]?.count ?? 0);
}

function quoteIdent(ident: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new MigrateError(`Invalid identifier: ${ident}`, 400);
  }
  return `"${ident}"`;
}

async function copyTable(
  source: pg.PoolClient,
  target: pg.PoolClient,
  schema: string,
  table: string,
  truncateFirst: boolean,
  dryRun: boolean
): Promise<TableCopyStat> {
  const sourceCols = await listCopyableColumns(source, schema, table);
  const targetCols = await listCopyableColumns(target, schema, table);
  const columns = sourceCols.filter((c) => targetCols.includes(c));
  if (columns.length === 0) {
    return {
      schema,
      table,
      rows: 0,
      action: 'skipped',
      reason: 'No overlapping columns',
    };
  }

  const sourceCount = await countRows(source, schema, table);
  if (dryRun) {
    return {
      schema,
      table,
      rows: sourceCount,
      action: 'would_copy',
    };
  }

  const colList = columns.map(quoteIdent).join(', ');
  const qualified = `${quoteIdent(schema)}.${quoteIdent(table)}`;

  if (truncateFirst) {
    await target.query(`TRUNCATE TABLE ${qualified} CASCADE`);
  }

  const batchSize = 500;
  let copied = 0;
  let lastCtid: string | null = null;

  while (true) {
    const page: pg.QueryResult<Record<string, unknown>> = lastCtid
      ? await source.query<Record<string, unknown>>(
          `SELECT ctid::text AS __ctid, ${colList}
           FROM ${qualified}
           WHERE ctid > $1::tid
           ORDER BY ctid
           LIMIT $2`,
          [lastCtid, batchSize]
        )
      : await source.query<Record<string, unknown>>(
          `SELECT ctid::text AS __ctid, ${colList}
           FROM ${qualified}
           ORDER BY ctid
           LIMIT $1`,
          [batchSize]
        );
    if (page.rows.length === 0) break;

    for (const row of page.rows) {
      lastCtid = String(row.__ctid);
      const values = columns.map((c) => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      if (truncateFirst) {
        await target.query(
          `INSERT INTO ${qualified} (${colList}) VALUES (${placeholders})`,
          values
        );
      } else {
        await target.query(
          `INSERT INTO ${qualified} (${colList}) VALUES (${placeholders})
           ON CONFLICT DO NOTHING`,
          values
        );
      }
      copied += 1;
    }

    if (page.rows.length < batchSize) break;
  }

  return { schema, table, rows: copied, action: 'copied' };
}

async function copySchemaTables(params: {
  source: pg.PoolClient;
  target: pg.PoolClient;
  schema: string;
  tables: string[];
  truncateFirst: boolean;
  dryRun: boolean;
  warnings: string[];
}): Promise<TableCopyStat[]> {
  const stats: TableCopyStat[] = [];
  for (const table of params.tables) {
    if (params.schema === 'public' && SKIP_PUBLIC_TABLES.has(table)) {
      stats.push({
        schema: params.schema,
        table,
        rows: 0,
        action: 'skipped',
        reason: 'Skipped system/extension table',
      });
      continue;
    }

    const existsOnTarget = await tableExists(params.target, params.schema, table);
    if (!existsOnTarget) {
      stats.push({
        schema: params.schema,
        table,
        rows: 0,
        action: 'skipped',
        reason: 'Table missing on target (restore schema first)',
      });
      params.warnings.push(
        `${params.schema}.${table} exists on source but not target — run schema restore first`
      );
      continue;
    }

    try {
      const stat = await copyTable(
        params.source,
        params.target,
        params.schema,
        table,
        params.truncateFirst,
        params.dryRun
      );
      stats.push(stat);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      params.warnings.push(`${params.schema}.${table}: ${message}`);
      stats.push({
        schema: params.schema,
        table,
        rows: 0,
        action: 'skipped',
        reason: message,
      });
    }
  }
  return stats;
}

async function listStorageObjects(
  supabaseUrl: string,
  serviceKey: string,
  bucket: string
): Promise<string[]> {
  const names: string[] = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/list/${bucket}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: '', limit, offset }),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new MigrateError(
        `Storage list failed for ${bucket}: ${response.status} ${text}`,
        502
      );
    }
    const page = (await response.json()) as Array<{ name?: string }>;
    if (!Array.isArray(page) || page.length === 0) break;
    for (const item of page) {
      if (item.name && !item.name.endsWith('/')) names.push(item.name);
    }
    if (page.length < limit) break;
    offset += limit;
  }
  return names;
}

async function downloadStorageObject(
  supabaseUrl: string,
  serviceKey: string,
  bucket: string,
  objectKey: string
): Promise<Buffer> {
  const base = supabaseUrl.replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  };
  const urls = [
    `${base}/storage/v1/object/authenticated/${bucket}/${objectKey}`,
    `${base}/storage/v1/object/public/${bucket}/${objectKey}`,
  ];
  let lastError = 'download failed';
  for (const url of urls) {
    const response = await fetch(url, { headers });
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
    lastError = `${response.status} ${await response.text()}`;
  }
  throw new Error(lastError);
}

async function copyStorage(params: {
  config: AppConfig;
  dryRun: boolean;
  warnings: string[];
}): Promise<StorageCopyStat[]> {
  const supabaseUrl = params.config.SUPABASE_URL;
  const serviceKey = params.config.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return STORAGE_BUCKET_PREFIXES.map((bucket) => ({
      bucket,
      objects: 0,
      errors: 0,
      action: 'skipped' as const,
      reason: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured',
    }));
  }

  const stats: StorageCopyStat[] = [];
  for (const bucket of STORAGE_BUCKET_PREFIXES) {
    try {
      const objects = await listStorageObjects(supabaseUrl, serviceKey, bucket);
      if (params.dryRun) {
        stats.push({
          bucket,
          objects: objects.length,
          errors: 0,
          action: 'would_copy',
        });
        continue;
      }

      let copied = 0;
      let errors = 0;
      for (const objectKey of objects) {
        try {
          const bytes = await downloadStorageObject(
            supabaseUrl,
            serviceKey,
            bucket,
            objectKey
          );
          const dest = absoluteObjectPath(params.config.UPLOADS_DIR, bucket, objectKey);
          await mkdir(path.dirname(dest), { recursive: true });
          await writeFile(dest, bytes);
          copied += 1;
        } catch (error) {
          errors += 1;
          params.warnings.push(
            `storage ${bucket}/${objectKey}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      stats.push({ bucket, objects: copied, errors, action: 'copied' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      params.warnings.push(`storage ${bucket}: ${message}`);
      stats.push({
        bucket,
        objects: 0,
        errors: 1,
        action: 'skipped',
        reason: message,
      });
    }
  }
  return stats;
}

async function rewriteAvatarUrls(
  target: pg.PoolClient,
  config: AppConfig
): Promise<number> {
  const supabaseUrl = config.SUPABASE_URL?.replace(/\/$/, '');
  const apiBase = config.SELF_HOSTED_API_BASE_URL?.replace(/\/$/, '');
  if (!supabaseUrl || !apiBase) return 0;

  const result = await target.query(
    `UPDATE public.profiles
     SET avatar_url = replace(
       avatar_url,
       $1,
       $2
     )
     WHERE avatar_url LIKE $3
     RETURNING id`,
    [
      `${supabaseUrl}/storage/v1/object/public/`,
      `${apiBase}/storage/v1/object/public/`,
      `${supabaseUrl}/storage/v1/object/public/%`,
    ]
  );
  return result.rowCount ?? 0;
}

export async function migrateFromSupabase(
  config: AppConfig,
  request: MigrateRequest
): Promise<MigrateReport> {
  assertConfirmation(request.confirmation);

  if (migrateInFlight) {
    throw new MigrateError('A migration is already running', 409);
  }

  const dryRun = Boolean(request.dryRun);
  const includeAuth = request.includeAuth !== false;
  const includePublic = request.includePublic !== false;
  const includeStorage = Boolean(request.includeStorage);
  const truncateFirst = Boolean(request.truncateFirst);
  const rewriteStorageUrls = Boolean(request.rewriteStorageUrls);

  if (!includeAuth && !includePublic && !includeStorage) {
    throw new MigrateError('Select at least one of auth, public data, or storage', 400);
  }

  if ((includeAuth || includePublic) && !config.MIGRATE_SOURCE_DATABASE_URL) {
    throw new MigrateError(
      'MIGRATE_SOURCE_DATABASE_URL is not configured on the API',
      503
    );
  }
  if ((includeAuth || includePublic) && !config.DATABASE_URL) {
    throw new MigrateError('DATABASE_URL is not configured on the API', 503);
  }
  if (
    includeStorage &&
    (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new MigrateError(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for storage copy',
      503
    );
  }

  if (
    config.MIGRATE_SOURCE_DATABASE_URL &&
    config.DATABASE_URL &&
    sameDatabaseTarget(config.MIGRATE_SOURCE_DATABASE_URL, config.DATABASE_URL)
  ) {
    throw new MigrateError(
      'Source and target DATABASE_URL appear to be the same database',
      400
    );
  }

  migrateInFlight = true;
  const started = Date.now();
  const warnings: string[] = [];
  const tables: TableCopyStat[] = [];
  let storage: StorageCopyStat[] = [];
  let urlRewrite: { updated: number } | undefined;

  let sourcePool: pg.Pool | null = null;
  let targetPool: pg.Pool | null = null;

  try {
    if (includeAuth || includePublic) {
      sourcePool = new Pool({
        connectionString: config.MIGRATE_SOURCE_DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 10_000,
      });
      targetPool = new Pool({
        connectionString: config.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 10_000,
      });

      const source = await sourcePool.connect();
      const target = await targetPool.connect();
      try {
        if (!dryRun) {
          await target.query(`SET session_replication_role = replica`);
        }

        if (includeAuth) {
          const available: string[] = [];
          for (const table of AUTH_TABLES) {
            if (await tableExists(source, 'auth', table)) available.push(table);
          }
          const authStats = await copySchemaTables({
            source,
            target,
            schema: 'auth',
            tables: available,
            truncateFirst,
            dryRun,
            warnings,
          });
          tables.push(...authStats);
        }

        if (includePublic) {
          const publicTables = await listBaseTables(source, 'public');
          const publicStats = await copySchemaTables({
            source,
            target,
            schema: 'public',
            tables: publicTables,
            truncateFirst,
            dryRun,
            warnings,
          });
          tables.push(...publicStats);
        }

        if (!dryRun && rewriteStorageUrls) {
          urlRewrite = { updated: await rewriteAvatarUrls(target, config) };
        }

        if (!dryRun) {
          await target.query(`SET session_replication_role = DEFAULT`);
        }
      } finally {
        source.release();
        target.release();
      }
    }

    if (includeStorage) {
      storage = await copyStorage({ config, dryRun, warnings });
    }

    return {
      dryRun,
      includeAuth,
      includePublic,
      includeStorage,
      truncateFirst,
      tables,
      storage,
      urlRewrite,
      warnings,
      durationMs: Date.now() - started,
    };
  } finally {
    migrateInFlight = false;
    await sourcePool?.end().catch(() => undefined);
    await targetPool?.end().catch(() => undefined);
  }
}

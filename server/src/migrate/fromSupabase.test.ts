import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MIGRATE_CONFIRMATION_PHRASE,
  MigrateError,
  getMigrateCapability,
  migrateFromSupabase,
} from './fromSupabase.js';
import type { AppConfig } from '../config.js';

describe('migrateFromSupabase guards', () => {
  it('exposes confirmation phrase', () => {
    assert.equal(MIGRATE_CONFIRMATION_PHRASE, 'COPY FROM SUPABASE');
  });

  it('reports capability flags without secrets', () => {
    const capability = getMigrateCapability({
      MIGRATE_SOURCE_DATABASE_URL: 'postgresql://source',
      DATABASE_URL: 'postgresql://target',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    } as AppConfig);
    assert.deepEqual(capability, {
      dataConfigured: true,
      storageConfigured: true,
      targetConfigured: true,
    });
  });

  it('rejects wrong confirmation phrase', async () => {
    await assert.rejects(
      () =>
        migrateFromSupabase({} as AppConfig, {
          confirmation: 'please copy',
          dryRun: true,
        }),
      (error: unknown) =>
        error instanceof MigrateError && error.statusCode === 400
    );
  });

  it('rejects when nothing is selected', async () => {
    await assert.rejects(
      () =>
        migrateFromSupabase({} as AppConfig, {
          confirmation: MIGRATE_CONFIRMATION_PHRASE,
          includeAuth: false,
          includePublic: false,
          includeStorage: false,
        }),
      (error: unknown) =>
        error instanceof MigrateError && /at least one/i.test(error.message)
    );
  });

  it('requires source DB URL for data copy', async () => {
    await assert.rejects(
      () =>
        migrateFromSupabase(
          { DATABASE_URL: 'postgresql://target' } as AppConfig,
          {
            confirmation: MIGRATE_CONFIRMATION_PHRASE,
            dryRun: true,
            includeAuth: true,
            includePublic: false,
            includeStorage: false,
          }
        ),
      (error: unknown) =>
        error instanceof MigrateError && error.statusCode === 503
    );
  });
});

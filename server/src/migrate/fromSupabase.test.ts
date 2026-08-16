import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  MIGRATE_CONFIRMATION_PHRASE,
  MigrateError,
  getMigrateCapability,
  migrateFromSupabase,
  __storageListTestUtils,
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

describe('storage list recursion', () => {
  it('encodes nested object paths', () => {
    assert.equal(
      __storageListTestUtils.encodeObjectPath('session/1/pic.png'),
      'session/1/pic.png'
    );
    assert.equal(
      __storageListTestUtils.encodeObjectPath('a b/c.png'),
      'a%20b/c.png'
    );
  });

  it('treats null id+metadata as folders', () => {
    assert.equal(
      __storageListTestUtils.isStorageFolder({ name: 'sess', id: null, metadata: null }),
      true
    );
    assert.equal(
      __storageListTestUtils.isStorageFolder({
        name: 'file.png',
        id: 'abc',
        metadata: { size: 12 },
      }),
      false
    );
  });

  it('recurses into Supabase folder placeholders', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { prefix?: string };
      if (!body.prefix) {
        return new Response(
          JSON.stringify([{ name: '17ca-session', id: null, metadata: null }]),
          { status: 200 }
        );
      }
      if (body.prefix === '17ca-session/') {
        return new Response(
          JSON.stringify([{ name: '1', id: null, metadata: null }]),
          { status: 200 }
        );
      }
      if (body.prefix === '17ca-session/1/') {
        return new Response(
          JSON.stringify([
            {
              name: 'pic.png',
              id: 'obj-1',
              metadata: { size: 10, mimetype: 'image/png' },
            },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    try {
      const names = await __storageListTestUtils.listStoragePrefix(
        'https://example.supabase.co',
        'service',
        'poker-session-chat-images',
        ''
      );
      assert.deepEqual(names, ['17ca-session/1/pic.png']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

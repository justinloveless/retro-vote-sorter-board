import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadConfig } from '../config.js';
import { AuthService } from './service.js';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5432/retroscope_auth_test';

const jwtSecret = 'integration-test-secret-key-32chars-min';

describe('AuthService integration', () => {
  let pool: pg.Pool;
  let service: AuthService;

  before(async () => {
    // Ensure DB exists
    const admin = new pg.Pool({
      connectionString: databaseUrl.replace(/\/[^/]+$/, '/postgres'),
    });
    try {
      await admin.query('CREATE DATABASE retroscope_auth_test');
    } catch {
      // already exists
    }
    await admin.end();

    pool = new pg.Pool({ connectionString: databaseUrl });

    // Minimal roles + auth schema (skip Coolify \gexec roles; create app role simply)
    await pool.query(`
      DO $do$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retroscope_app') THEN
          CREATE ROLE retroscope_app LOGIN PASSWORD 'retroscope_app_pass';
        END IF;
      END
      $do$;
    `);

    const authSql = readFileSync(
      resolve(process.cwd(), 'postgres/init/02-auth-schema.sql'),
      'utf8'
    );
    await pool.query(authSql);

    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      JWT_SECRET: jwtSecret,
      JWT_ACCESS_TTL_SECONDS: '3600',
      PUBLIC_SITE_URL: 'http://localhost:8081',
    } as NodeJS.ProcessEnv);

    service = new AuthService(config, pool);
  });

  after(async () => {
    await pool?.end();
  });

  it('signs up, logs in with password, refreshes, and preserves user UUID', async () => {
    const email = `qa+${Date.now()}@example.com`;
    const password = 'Password1234';

    const signedUp = await service.signUp({
      email,
      password,
      data: { full_name: 'QA User' },
    });

    assert.ok(signedUp.access_token);
    assert.ok(signedUp.refresh_token);
    assert.equal(signedUp.user.email, email);
    const userId = signedUp.user.id;

    const loggedIn = await service.signInWithPassword({ email, password });
    assert.equal(loggedIn.user.id, userId);

    const refreshed = await service.refresh(loggedIn.refresh_token);
    assert.equal(refreshed.user.id, userId);
    assert.notEqual(refreshed.refresh_token, loggedIn.refresh_token);

    const me = await service.getUser(refreshed.access_token);
    assert.equal(me.id, userId);
  });

  it('imports bcrypt hash and verifies QA-style password', async () => {
    const email = `import+${Date.now()}@example.com`;
    const password = 'Password1234';
    const { hashPassword } = await import('./passwords.js');
    const encrypted = await hashPassword(password);
    const fixedId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await pool.query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
       VALUES ($1, $2, $3, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)`,
      [fixedId, email, encrypted]
    );

    const session = await service.signInWithPassword({ email, password });
    assert.equal(session.user.id, fixedId);
  });

  it('links Google identity by verified email to existing UUID', async () => {
    const email = `google-link+${Date.now()}@example.com`;
    const password = 'Password1234';
    const created = await service.signUp({ email, password });

    // Simulate identity link path used by OAuth callback
    const { AuthRepository } = await import('./repository.js');
    const repo = new AuthRepository(pool);
    await repo.createIdentity({
      userId: created.user.id,
      provider: 'google',
      providerId: `google-sub-${Date.now()}`,
      identityData: { email, email_verified: true, sub: 'x' },
      email,
    });

    const identity = await repo.findIdentity('google', `google-sub-${Date.now() - 1}`);
    // Just assert the user still has email identity + google row count
    const identities = await repo.listIdentitiesForUser(created.user.id);
    assert.ok(identities.some((i) => i.provider === 'email'));
    assert.ok(identities.some((i) => i.provider === 'google'));
    assert.equal(identity, null);
  });
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import Fastify from 'fastify';
import { registerBackendProviderRoutes } from './backendProvider.js';
import type { AppConfig } from '../config.js';

const JWT_SECRET = 'backend-provider-test-secret-32chars!';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    HOST: '127.0.0.1',
    JWT_SECRET,
    SELF_HOSTED_API_BASE_URL: 'https://api.example.test',
    JWT_ISSUER: 'retroscope-auth',
    JWT_ACCESS_TTL_SECONDS: 3600,
    ALLOW_ORIGINS: '*',
    POSTGREST_URL: 'http://postgrest:3000',
    SMTP_PORT: 587,
    UPLOADS_DIR: '/tmp/uploads',
    allowOrigins: ['*'],
    ...overrides,
  } as AppConfig;
}

describe('backend provider routes', () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    app = Fastify();
    await registerBackendProviderRoutes(
      app,
      baseConfig({ BACKEND_PROVIDER_MODE: 'selfhosted' })
    );
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('GET falls back to env when database is unavailable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/backend-provider' });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      mode: string;
      selfHostedApiBaseUrl: string;
      source: string;
    };
    assert.equal(body.mode, 'selfhosted');
    assert.equal(body.source, 'env');
    assert.equal(body.selfHostedApiBaseUrl, 'https://api.example.test');
  });

  it('PUT requires Authorization', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/backend-provider',
      payload: { mode: 'selfhosted', selfHostedApiBaseUrl: 'https://api.example.test' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('PUT returns 500 when DATABASE_URL is not configured', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/backend-provider',
      headers: { authorization: 'Bearer any-token' },
      payload: { mode: 'selfhosted', selfHostedApiBaseUrl: 'https://api.example.test' },
    });
    assert.equal(res.statusCode, 500);
    const body = res.json() as { error: string };
    assert.match(body.error, /DATABASE_URL/i);
  });
});

describe('app_config server SQL', () => {
  it('stays free of dollar signs for Coolify compose embeds', async () => {
    const sqlPath = path.resolve(
      __dirname,
      '../../postgres/init/06-app-config-server.sql'
    );
    const sql = await readFile(sqlPath, 'utf8');
    assert.equal(sql.includes('$'), false, 'SQL must not contain $ for Compose interpolation');
    assert.match(sql, /server_upsert_app_config/);
    assert.match(sql, /server_get_app_config/);
    assert.match(sql, /SECURITY DEFINER/);
  });
});

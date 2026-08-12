import type { AppConfig } from '../config.js';

export async function checkPostgrest(
  config: AppConfig
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = config.POSTGREST_URL.replace(/\/$/, '');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/openapi+json' },
      signal: AbortSignal.timeout(3_000),
    });

    if (response.ok || response.status === 200 || response.status === 401) {
      // 401 can still mean PostgREST is up but requires a JWT for some configs.
      return { ok: true, status: response.status };
    }

    return {
      ok: false,
      status: response.status,
      error: `PostgREST returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'PostgREST check failed',
    };
  }
}

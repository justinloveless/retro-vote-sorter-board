import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/** Never copy these from PostgREST — they would clobber @fastify/cors. */
export function shouldForwardUpstreamHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (HOP_BY_HOP.has(lower)) return false;
  if (lower.startsWith('access-control-')) return false;
  return true;
}

function buildTargetUrl(postgrestBase: string, path: string, query: string): string {
  const base = postgrestBase.replace(/\/$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  const qs = query.startsWith('?') || query.length === 0 ? query : `?${query}`;
  return `${base}/${normalizedPath}${qs}`;
}

/**
 * Strip /rest/v1 prefix from request path. Accepts:
 *   /rest/v1/profiles
 *   /rest/v1/rpc/accept_team_invitation
 */
export function restPathFromRequest(urlPath: string): string {
  const withoutQuery = urlPath.split('?')[0] ?? urlPath;
  const trimmed = withoutQuery.replace(/^\/+/, '');
  if (trimmed === 'rest/v1' || trimmed === 'rest/v1/') {
    return '';
  }
  if (trimmed.startsWith('rest/v1/')) {
    return trimmed.slice('rest/v1/'.length);
  }
  return trimmed;
}

async function proxyToPostgrest(
  config: AppConfig,
  request: FastifyRequest,
  reply: FastifyReply,
  path: string
): Promise<void> {
  const queryIndex = request.url.indexOf('?');
  const query = queryIndex >= 0 ? request.url.slice(queryIndex) : '';
  const targetUrl = buildTargetUrl(config.POSTGREST_URL, path, query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || HOP_BY_HOP.has(key.toLowerCase())) continue;
    const lower = key.toLowerCase();
    if (
      lower === 'authorization' ||
      lower === 'prefer' ||
      lower === 'range' ||
      lower === 'content-type' ||
      lower === 'accept' ||
      lower === 'accept-profile' ||
      lower === 'content-profile' ||
      lower === 'apikey' ||
      lower === 'x-client-info'
    ) {
      headers[key] = Array.isArray(value) ? value.join(',') : String(value);
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    signal: AbortSignal.timeout(30_000),
  };

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined) {
    init.body =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (error) {
    request.log.error({ err: error, targetUrl }, 'PostgREST proxy failed');
    return reply.status(502).send({
      message: 'Failed to reach PostgREST',
      details: error instanceof Error ? error.message : String(error),
    });
  }

  reply.status(upstream.status);

  for (const [key, value] of upstream.headers.entries()) {
    if (!shouldForwardUpstreamHeader(key)) continue;
    reply.header(key, value);
  }

  if (request.method === 'HEAD' || upstream.status === 204) {
    return reply.send();
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length === 0) {
    return reply.send();
  }

  const contentType = upstream.headers.get('content-type') || 'application/json';
  return reply.type(contentType).send(buffer);
}

export async function registerRestProxyRoutes(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    // Let @fastify/cors answer preflight; never proxy OPTIONS to PostgREST.
    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }
    const path = restPathFromRequest(request.url);
    return proxyToPostgrest(config, request, reply, path);
  };

  await app.register(
    async (scope) => {
      scope.all('/', handler);
      scope.all('/*', handler);
    },
    { prefix: '/rest/v1' }
  );
}

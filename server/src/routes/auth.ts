import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { AuthError, AuthService } from '../auth/service.js';
import { getPool } from '../lib/db.js';

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function sendAuthError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    return reply.status(error.statusCode).send({
      error: error.code || 'auth_error',
      error_description: error.message,
      msg: error.message,
    });
  }
  throw error;
}

async function readTokenBody(request: FastifyRequest): Promise<Record<string, unknown>> {
  const body = request.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  const requireService = (): AuthService => {
    const pool = getPool(config);
    if (!pool) {
      throw new AuthError('DATABASE_URL is not configured', 503, 'db_unavailable');
    }
    if (!config.JWT_SECRET) {
      throw new AuthError('JWT_SECRET is not configured', 503, 'config_error');
    }
    return new AuthService(config, pool);
  };

  app.post('/auth/v1/signup', async (request, reply) => {
    try {
      const service = requireService();
      const body = await readTokenBody(request);
      const email = String(body.email ?? '');
      const password = String(body.password ?? '');
      const data =
        body.data && typeof body.data === 'object'
          ? (body.data as Record<string, unknown>)
          : undefined;
      const result = await service.signUp({ email, password, data });
      return reply.send(result);
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post('/auth/v1/token', async (request, reply) => {
    try {
      const service = requireService();
      const query = request.query as { grant_type?: string };
      const body = await readTokenBody(request);
      const grantType =
        query.grant_type ||
        (typeof body.grant_type === 'string' ? body.grant_type : undefined);

      if (grantType === 'password') {
        const email = String(body.email ?? '');
        const password = String(body.password ?? '');
        const result = await service.signInWithPassword({ email, password });
        return reply.send(result);
      }

      if (grantType === 'refresh_token') {
        const refreshToken = String(
          body.refresh_token ?? body.refreshToken ?? ''
        );
        const result = await service.refresh(refreshToken);
        return reply.send(result);
      }

      return reply.status(400).send({
        error: 'unsupported_grant_type',
        error_description: `Unsupported grant_type: ${grantType ?? 'missing'}`,
      });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get('/auth/v1/user', async (request, reply) => {
    try {
      const service = requireService();
      const token = bearerToken(request);
      if (!token) {
        return reply.status(401).send({
          error: 'no_authorization',
          msg: 'No authorization header',
        });
      }
      const user = await service.getUser(token);
      return reply.send(user);
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.put('/auth/v1/user', async (request, reply) => {
    try {
      const service = requireService();
      const token = bearerToken(request);
      if (!token) {
        return reply.status(401).send({
          error: 'no_authorization',
          msg: 'No authorization header',
        });
      }
      const body = await readTokenBody(request);
      const password =
        typeof body.password === 'string' ? body.password : undefined;
      const data =
        body.data && typeof body.data === 'object'
          ? (body.data as Record<string, unknown>)
          : undefined;
      const user = await service.updateUser(token, { password, data });
      return reply.send({ user });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post('/auth/v1/logout', async (request, reply) => {
    try {
      const service = requireService();
      const body = await readTokenBody(request);
      const scope = body.scope === 'global' ? 'global' : 'local';
      await service.logout({
        accessToken: bearerToken(request),
        refreshToken:
          typeof body.refresh_token === 'string' ? body.refresh_token : null,
        scope,
      });
      return reply.status(204).send();
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post('/auth/v1/recover', async (request, reply) => {
    try {
      const service = requireService();
      const body = await readTokenBody(request);
      const email = String(body.email ?? '');
      const redirectTo =
        typeof body.redirect_to === 'string'
          ? body.redirect_to
          : typeof body.gotrue_meta_redirect_to === 'string'
            ? body.gotrue_meta_redirect_to
            : undefined;
      await service.recover(email, redirectTo);
      return reply.send({});
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post('/auth/v1/verify', async (request, reply) => {
    try {
      const service = requireService();
      const body = await readTokenBody(request);
      const type = String(body.type ?? '');
      const token = String(body.token ?? body.code ?? '');
      if (type === 'recovery') {
        const password = String(body.password ?? body.new_password ?? '');
        const result = await service.confirmRecovery(token, password);
        return reply.send(result);
      }
      return reply.status(400).send({
        error: 'validation_failed',
        msg: `Unsupported verify type: ${type || 'missing'}`,
      });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get('/auth/v1/authorize', async (request, reply) => {
    try {
      const service = requireService();
      const query = request.query as {
        provider?: string;
        redirect_to?: string;
      };
      if (query.provider !== 'google') {
        return reply.status(400).send({
          error: 'validation_failed',
          msg: 'Only provider=google is supported',
        });
      }
      const url = service.getGoogleAuthorizeUrl(query.redirect_to);
      return reply.redirect(url);
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get('/auth/v1/callback', async (request, reply) => {
    try {
      const service = requireService();
      const query = request.query as {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
      };

      if (query.error) {
        return reply.status(400).send({
          error: query.error,
          error_description: query.error_description,
        });
      }
      if (!query.code) {
        return reply.status(400).send({
          error: 'validation_failed',
          msg: 'Missing code',
        });
      }

      const { redirectUrl } = await service.handleGoogleCallback({
        code: query.code,
        state: query.state,
      });
      return reply.redirect(redirectUrl);
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  // HS256 shared-secret setups do not expose public JWKs; return empty set for clients that probe.
  app.get('/auth/v1/.well-known/jwks.json', async (_request, reply) => {
    return reply.send({ keys: [] });
  });
}

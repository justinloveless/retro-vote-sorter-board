import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import { getPool } from '../lib/db.js';
import { requireAdmin, requireUser } from '../lib/requestAuth.js';
import { adminSearchUsers } from '../functions/adminSearchUsers.js';
import { adminSendNotification } from '../functions/adminSendNotification.js';
import { adminTeamMembers } from '../functions/adminTeamMembers.js';
import { getUserEmail } from '../functions/getUserEmail.js';
import {
  notifyOrgInvite,
  notifyTeamInvite,
  sendInvitationEmail,
} from '../functions/invites.js';
import type { FunctionContext, FunctionResult } from '../functions/helpers.js';

const ADMIN_FUNCTIONS = new Set([
  'admin-search-users',
  'admin-send-notification',
  'admin-team-members',
  'get-user-email',
]);

const AUTH_FUNCTIONS = new Set([
  ...ADMIN_FUNCTIONS,
  'send-invitation-email',
  'notify-team-invite',
  'notify-org-invite',
]);

async function readJsonBody(request: FastifyRequest): Promise<Record<string, unknown>> {
  const body = request.body;
  if (body && typeof body === 'object' && !Array.isArray(body) && !Buffer.isBuffer(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function stripeDeferredBody(name: string): FunctionResult {
  return {
    status: 501,
    body: {
      error: 'Stripe remains on hosted Supabase for Phase 4',
      decision: 'keep_on_supabase',
      function: name,
      phase: 4,
    },
  };
}

export async function dispatchFunction(
  name: string,
  ctx: FunctionContext,
  config: AppConfig,
  body: Record<string, unknown>
): Promise<FunctionResult> {
  switch (name) {
    case 'admin-search-users':
      return adminSearchUsers(ctx, body);
    case 'admin-send-notification':
      return adminSendNotification(ctx, body as {
        recipients?: Array<{ userId?: string; email?: string }>;
        type?: string;
        title?: string;
        message?: string;
        url?: string;
      });
    case 'admin-team-members':
      return adminTeamMembers(ctx, body);
    case 'get-user-email':
      return getUserEmail(ctx, body);
    case 'send-invitation-email':
      return sendInvitationEmail(ctx, config, body);
    case 'notify-team-invite':
      return notifyTeamInvite(ctx, body);
    case 'notify-org-invite':
      return notifyOrgInvite(ctx, body);
    default:
      return { status: 501, body: { error: 'Not implemented' } };
  }
}

export async function registerFunctionRoutes(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  app.options('/functions/v1/:name', async (_request, reply) => {
    return reply.status(204).send();
  });

  app.post<{ Params: { name: string } }>(
    '/functions/v1/:name',
    async (request, reply) => {
      const name = request.params.name;

      if (
        name === 'check-subscription' ||
        name === 'create-checkout' ||
        name === 'customer-portal' ||
        name === 'admin-manage-subscription'
      ) {
        const deferred = stripeDeferredBody(name);
        return reply.status(deferred.status).send(deferred.body);
      }

      if (!AUTH_FUNCTIONS.has(name)) {
        return reply.status(501).send({
          error: `Edge function "${name}" is not ported yet`,
          phase: 4,
          hint: 'Jira/Slack ports are optional and deferred unless actively used',
        });
      }

      const pool = getPool(config);
      if (!pool) {
        return reply.status(503).send({ error: 'DATABASE_URL not configured' });
      }

      let claims;
      if (ADMIN_FUNCTIONS.has(name)) {
        claims = await requireAdmin(request, reply, config);
      } else {
        claims = await requireUser(request, reply, config);
      }
      if (!claims) return;

      const body = await readJsonBody(request);
      const originHeader = request.headers.origin;
      const ctx: FunctionContext = {
        db: pool,
        claims,
        origin: typeof originHeader === 'string' ? originHeader : null,
      };

      try {
        const result = await dispatchFunction(name, ctx, config, body);
        return reply.status(result.status).send(result.body);
      } catch (error) {
        request.log.error({ err: error, name }, 'Function handler failed');
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Unexpected error',
        });
      }
    }
  );
}

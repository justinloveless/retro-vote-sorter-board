import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adminSearchUsers } from '../functions/adminSearchUsers.js';
import { adminSendNotification } from '../functions/adminSendNotification.js';
import { adminTeamMembers } from '../functions/adminTeamMembers.js';
import { sendInvitationEmail } from '../functions/invites.js';
import type { FunctionContext } from '../functions/helpers.js';
import type { AppConfig } from '../config.js';

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

function mockDb(handler: QueryFn): FunctionContext {
  return {
    // Test double — only the string overload is exercised.
    db: { query: handler as FunctionContext['db']['query'] },
    claims: {
      sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      role: 'authenticated',
    },
    origin: 'https://retro.example.com',
  };
}

describe('adminSearchUsers', () => {
  it('returns empty results for blank query', async () => {
    const ctx = mockDb(async () => ({ rows: [] }));
    const result = await adminSearchUsers(ctx, { q: '  ' });
    assert.deepEqual(result, { status: 200, body: { results: [] } });
  });

  it('searches profiles and emails', async () => {
    const ctx = mockDb(async (sql, params) => {
      if (sql.includes('FROM public.profiles') && sql.includes('ILIKE')) {
        return { rows: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }] };
      }
      if (sql.includes('FROM auth.users') && sql.includes('LIKE')) {
        return { rows: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'qa@example.com' }] };
      }
      if (sql.includes('FROM public.profiles') && sql.includes('ANY')) {
        return {
          rows: [
            {
              id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              full_name: 'Bob',
              avatar_url: null,
              role: 'member',
            },
          ],
        };
      }
      if (sql.includes('FROM auth.users') && sql.includes('ANY')) {
        return { rows: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'bob@example.com' }] };
      }
      if (sql.includes('team_members')) {
        return { rows: [{ team_id: 'team-1', team_name: 'Alpha' }] };
      }
      throw new Error(`Unexpected SQL: ${sql} ${JSON.stringify(params)}`);
    });

    const result = await adminSearchUsers(ctx, { q: 'bob' });
    assert.equal(result.status, 200);
    const body = result.body as { results: Array<{ id: string; email: string | null; teams: unknown[] }> };
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0].email, 'bob@example.com');
    assert.deepEqual(body.results[0].teams, [{ id: 'team-1', name: 'Alpha' }]);
  });
});

describe('adminSendNotification', () => {
  it('validates payload', async () => {
    const ctx = mockDb(async () => ({ rows: [] }));
    const result = await adminSendNotification(ctx, { title: 'x' });
    assert.equal(result.status, 400);
  });

  it('inserts notifications for resolved recipients', async () => {
    let inserted = false;
    const ctx = mockDb(async (sql) => {
      if (sql.includes('INSERT INTO public.notifications')) {
        inserted = true;
        return { rows: [] };
      }
      throw new Error(sql);
    });
    const result = await adminSendNotification(ctx, {
      recipients: [{ userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }],
      type: 'custom',
      title: 'Hello',
      message: 'World',
    });
    assert.equal(result.status, 200);
    assert.equal(inserted, true);
  });
});

describe('adminTeamMembers', () => {
  it('lists teams', async () => {
    const ctx = mockDb(async () => ({
      rows: [{ id: 't1', name: 'Alpha', created_at: '2024-01-01' }],
    }));
    const result = await adminTeamMembers(ctx, { action: 'list_teams' });
    assert.equal(result.status, 200);
    assert.deepEqual((result.body as { teams: unknown[] }).teams[0], {
      id: 't1',
      name: 'Alpha',
      created_at: '2024-01-01',
    });
  });
});

describe('sendInvitationEmail', () => {
  it('requires fields', async () => {
    const ctx = mockDb(async () => ({ rows: [] }));
    const config = {
      PUBLIC_SITE_URL: 'https://retro.example.com',
    } as AppConfig;
    const result = await sendInvitationEmail(ctx, config, { email: 'a@b.com' });
    assert.equal(result.status, 400);
  });

  it('sends via mail fallback and returns success', async () => {
    const ctx = mockDb(async () => ({ rows: [] }));
    const config = {
      PUBLIC_SITE_URL: 'https://retro.example.com',
    } as AppConfig;
    const result = await sendInvitationEmail(ctx, config, {
      email: 'invitee@example.com',
      teamName: 'Alpha',
      inviterName: 'Justin',
      token: 'tok-123',
    });
    assert.equal(result.status, 200);
  });
});

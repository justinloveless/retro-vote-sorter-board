import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildRestUrlForTest,
  createRestClient,
  normalizePostgrestSelect,
} from './restClient';

describe('normalizePostgrestSelect', () => {
  it('strips whitespace that PostgREST rejects inside embeds', () => {
    const input = `
      *,
      teams(
        id,
        name,
        team_members(user_id, role)
      )
    `;
    expect(normalizePostgrestSelect(input)).toBe(
      '*,teams(id,name,team_members(user_id,role))'
    );
  });
});

describe('restClient URL building', () => {
  it('builds table URLs under /rest/v1', () => {
    const url = buildRestUrlForTest('https://api.example.com', 'profiles', {
      select: 'id,full_name',
      id: 'eq.abc',
    });
    expect(url).toBe(
      'https://api.example.com/rest/v1/profiles?select=id%2Cfull_name&id=eq.abc'
    );
  });

  it('strips trailing slash on api base', () => {
    const url = buildRestUrlForTest('https://api.example.com/', 'teams', {});
    expect(url).toBe('https://api.example.com/rest/v1/teams');
  });
});

describe('restClient fluent subset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes multiline nested selects before requesting', async () => {
    const calls: Array<{ url: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push({ url: String(input) });
        return new Response(JSON.stringify({ id: '1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const client = createRestClient('https://api.example.com', () => null);
    await client
      .from('retro_boards')
      .select(`
        *,
        teams(
          id,
          name,
          team_members(user_id, role)
        )
      `)
      .eq('room_id', 'PUB2Q1')
      .single();

    expect(calls[0].url).toContain(
      'select=' + encodeURIComponent('*,teams(id,name,team_members(user_id,role))')
    );
    expect(calls[0].url).not.toMatch(/%20id/);
  });

  it('issues GET with filters and Authorization', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify([{ id: '1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
        });
      })
    );

    const client = createRestClient('https://api.example.com', () => 'test-token');
    const { data, error, count } = await client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', 'u1')
      .order('created_at', { ascending: false })
      .range(0, 49);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: '1' }]);
    expect(count).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/rest\/v1\/notifications\?/);
    expect(calls[0].url).toMatch(/user_id=eq\.u1/);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token'
    );
    expect((calls[0].init.headers as Record<string, string>).Range).toBe('0-49');
    expect((calls[0].init.headers as Record<string, string>).Prefer || '').toMatch(
      /count=exact/
    );
  });

  it('POSTs RPC bodies to /rest/v1/rpc/:name', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify({ success: true, team_id: 't1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const client = createRestClient('https://api.example.com', () => 'tok');
    const { data, error } = await client.rpc('accept_team_invitation', {
      invitation_token: 'abc',
    });
    expect(error).toBeNull();
    expect(data).toEqual({ success: true, team_id: 't1' });
    expect(calls[0].url).toBe(
      'https://api.example.com/rest/v1/rpc/accept_team_invitation'
    );
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe(JSON.stringify({ invitation_token: 'abc' }));
  });

  it('sets return=representation when select follows insert', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify([{ id: 'n1' }]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const client = createRestClient('https://api.example.com', () => null);
    await client.from('teams').insert([{ name: 'A' }]).select().single();
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Prefer || '').toMatch(
      /return=representation/
    );
  });
});

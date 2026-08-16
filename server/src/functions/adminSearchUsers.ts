import type { FunctionContext, FunctionResult } from './helpers.js';
import { getEmailsByIds, listUsersMatchingEmail } from './helpers.js';

type SearchResult = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  email: string | null;
  teams: Array<{ id: string; name: string }>;
};

export async function adminSearchUsers(
  ctx: FunctionContext,
  body: { q?: unknown }
): Promise<FunctionResult> {
  const query = (body.q ?? '').toString().trim();
  if (!query) {
    return { status: 200, body: { results: [] } };
  }

  const ids = new Set<string>();
  const uuidRegex = /^[0-9a-fA-F-]{36}$/;
  if (uuidRegex.test(query)) ids.add(query);

  const profileMatches = await ctx.db.query<{ id: string }>(
    `SELECT id FROM public.profiles
     WHERE full_name ILIKE $1
     LIMIT 50`,
    [`%${query}%`]
  );
  for (const row of profileMatches.rows) ids.add(row.id);

  const emailMatches = await listUsersMatchingEmail(ctx.db, query);
  for (const row of emailMatches) ids.add(row.id);

  const allIds = Array.from(ids).slice(0, 20);
  if (allIds.length === 0) {
    return { status: 200, body: { results: [] } };
  }

  const profiles = await ctx.db.query<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
  }>(
    `SELECT id, full_name, avatar_url, role
     FROM public.profiles
     WHERE id = ANY($1::uuid[])`,
    [allIds]
  );

  const emailById = await getEmailsByIds(ctx.db, allIds);
  for (const row of emailMatches) {
    if (row.email) emailById.set(row.id, row.email);
  }

  const results: SearchResult[] = [];
  for (const p of profiles.rows) {
    const memberships = await ctx.db.query<{
      team_id: string;
      team_name: string | null;
    }>(
      `SELECT tm.team_id, t.name AS team_name
       FROM public.team_members tm
       LEFT JOIN public.teams t ON t.id = tm.team_id
       WHERE tm.user_id = $1`,
      [p.id]
    );
    results.push({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      role: p.role,
      email: emailById.get(p.id) || null,
      teams: memberships.rows.map((m) => ({
        id: m.team_id,
        name: m.team_name || 'Team',
      })),
    });
  }

  return { status: 200, body: { results } };
}

import type { FunctionContext, FunctionResult } from './helpers.js';
import { findUserIdByEmail, getEmailsByIds } from './helpers.js';

type Action = 'list_teams' | 'list_team_members' | 'add_member' | 'remove_member';

export async function adminTeamMembers(
  ctx: FunctionContext,
  body: Record<string, unknown>
): Promise<FunctionResult> {
  const action = body.action as Action;

  if (action === 'list_teams') {
    const q = typeof body.query === 'string' ? body.query.trim() : '';
    const result = q
      ? await ctx.db.query(
          `SELECT id, name, created_at FROM public.teams
           WHERE name ILIKE $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [`%${q}%`]
        )
      : await ctx.db.query(
          `SELECT id, name, created_at FROM public.teams
           ORDER BY created_at DESC
           LIMIT 50`
        );
    return { status: 200, body: { teams: result.rows } };
  }

  if (action === 'list_team_members') {
    const teamId = typeof body.team_id === 'string' ? body.team_id : undefined;
    if (!teamId) {
      return { status: 400, body: { error: 'team_id is required' } };
    }

    const members = await ctx.db.query<{
      id: string;
      role: string;
      user_id: string;
      full_name: string | null;
      avatar_url: string | null;
    }>(
      `SELECT tm.id, tm.role, tm.user_id, p.full_name, p.avatar_url
       FROM public.team_members tm
       LEFT JOIN public.profiles p ON p.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.id DESC`,
      [teamId]
    );

    const emailById = await getEmailsByIds(
      ctx.db,
      members.rows.map((m) => m.user_id)
    );

    const rows = members.rows.map((m) => ({
      id: m.id,
      role: m.role,
      user_id: m.user_id,
      full_name: m.full_name,
      avatar_url: m.avatar_url,
      email: emailById.get(m.user_id) || null,
    }));
    return { status: 200, body: { members: rows } };
  }

  if (action === 'add_member') {
    const teamId = typeof body.team_id === 'string' ? body.team_id : undefined;
    const userId = typeof body.user_id === 'string' ? body.user_id : undefined;
    const email = typeof body.email === 'string' ? body.email : undefined;
    const role =
      body.role === 'owner' || body.role === 'admin' || body.role === 'member'
        ? body.role
        : 'member';

    if (!teamId) {
      return { status: 400, body: { error: 'team_id is required' } };
    }

    let resolvedUserId = userId || '';
    if (!resolvedUserId && email) {
      const found = await findUserIdByEmail(ctx.db, email);
      if (!found) {
        return { status: 404, body: { error: 'No user found for email' } };
      }
      resolvedUserId = found;
    }
    if (!resolvedUserId) {
      return { status: 400, body: { error: 'user_id or email is required' } };
    }

    const existing = await ctx.db.query<{ id: string }>(
      `SELECT id FROM public.team_members
       WHERE team_id = $1 AND user_id = $2
       LIMIT 1`,
      [teamId, resolvedUserId]
    );

    if (existing.rows[0]) {
      await ctx.db.query(`UPDATE public.team_members SET role = $2 WHERE id = $1`, [
        existing.rows[0].id,
        role,
      ]);
    } else {
      await ctx.db.query(
        `INSERT INTO public.team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [teamId, resolvedUserId, role]
      );
    }
    return { status: 200, body: { success: true } };
  }

  if (action === 'remove_member') {
    const teamId = typeof body.team_id === 'string' ? body.team_id : undefined;
    const userId = typeof body.user_id === 'string' ? body.user_id : undefined;
    const memberId = typeof body.member_id === 'string' ? body.member_id : undefined;

    if (!teamId && !memberId) {
      return {
        status: 400,
        body: { error: 'member_id or team_id+user_id required' },
      };
    }

    if (memberId) {
      await ctx.db.query(`DELETE FROM public.team_members WHERE id = $1`, [memberId]);
    } else {
      if (!userId) {
        return {
          status: 400,
          body: { error: 'user_id required when using team_id' },
        };
      }
      await ctx.db.query(
        `DELETE FROM public.team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );
    }
    return { status: 200, body: { success: true } };
  }

  return { status: 400, body: { error: 'Unknown action' } };
}

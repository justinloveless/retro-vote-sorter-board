import type { FunctionContext, FunctionResult } from './helpers.js';

export async function getUserEmail(
  ctx: FunctionContext,
  body: { userId?: unknown }
): Promise<FunctionResult> {
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId) {
    return { status: 400, body: { error: 'userId is required' } };
  }

  const result = await ctx.db.query<{ email: string | null }>(
    `SELECT email FROM auth.users
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );
  if (!result.rows[0]) {
    return { status: 404, body: { error: 'User not found' } };
  }
  return { status: 200, body: { email: result.rows[0].email } };
}

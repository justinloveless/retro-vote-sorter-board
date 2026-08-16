import type { FunctionContext, FunctionResult } from './helpers.js';
import { findUserIdByEmail } from './helpers.js';

type Body = {
  recipients?: Array<{ userId?: string; email?: string }>;
  type?: string;
  title?: string;
  message?: string;
  url?: string;
};

export async function adminSendNotification(
  ctx: FunctionContext,
  body: Body
): Promise<FunctionResult> {
  if (!Array.isArray(body.recipients) || !body.title || !body.type) {
    return { status: 400, body: { error: 'Invalid payload' } };
  }

  const ids: string[] = [];
  const emails = body.recipients
    .filter((r) => !!r.email)
    .map((r) => r.email!.toLowerCase());
  const directIds = body.recipients
    .filter((r) => !!r.userId)
    .map((r) => r.userId!) as string[];
  ids.push(...directIds);

  for (const email of emails) {
    const id = await findUserIdByEmail(ctx.db, email);
    if (id) ids.push(id);
  }

  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) {
    return { status: 200, body: { success: true, info: 'No recipients resolved' } };
  }

  const rows = uniqueIds.map((id) => ({
    user_id: id,
    type: body.type!,
    title: body.title!,
    message: body.message ?? null,
    url: body.url ?? null,
  }));

  await ctx.db.query(
    `INSERT INTO public.notifications (user_id, type, title, message, url)
     SELECT * FROM UNNEST(
       $1::uuid[],
       $2::text[],
       $3::text[],
       $4::text[],
       $5::text[]
     )`,
    [
      rows.map((r) => r.user_id),
      rows.map((r) => r.type),
      rows.map((r) => r.title),
      rows.map((r) => r.message),
      rows.map((r) => r.url),
    ]
  );

  return { status: 200, body: { success: true, count: rows.length } };
}

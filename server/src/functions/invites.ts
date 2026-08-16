import type { AppConfig } from '../config.js';
import { sendMail } from '../auth/mail.js';
import type { FunctionContext, FunctionResult } from './helpers.js';
import { findUserIdByEmail, getProfileRole } from './helpers.js';

interface InvitationEmailRequest {
  invitationId?: string;
  email?: string;
  teamName?: string;
  inviterName?: string;
  token?: string;
  invitePath?: string;
}

export async function sendInvitationEmail(
  ctx: FunctionContext,
  config: AppConfig,
  body: InvitationEmailRequest
): Promise<FunctionResult> {
  const email = body.email?.trim();
  const teamName = body.teamName?.trim();
  const inviterName = body.inviterName?.trim() || 'Someone';
  const token = body.token?.trim();
  if (!email || !teamName || !token) {
    return {
      status: 400,
      body: { error: 'email, teamName, and token are required' },
    };
  }

  const basePath = body.invitePath || '/invite';
  const siteBase =
    config.PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    ctx.origin ||
    'https://your-domain.com';
  const inviteLink = `${siteBase}${basePath}/${token}`;

  await sendMail(config, {
    to: email,
    subject: `You're invited to join ${teamName}`,
    text: `${inviterName} invited you to join "${teamName}". Accept: ${inviteLink}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; text-align: center;">Team Invitation</h1>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 16px; color: #333;">
            <strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong>.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}"
               style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 14px; color: #666;">
            Or copy this link:<br>
            <a href="${inviteLink}" style="color: #4f46e5; word-break: break-all;">${inviteLink}</a>
          </p>
        </div>
        <p style="font-size: 12px; color: #999; text-align: center;">
          This invitation will expire in 7 days.
        </p>
      </div>
    `,
  });

  return { status: 200, body: { success: true } };
}

export async function notifyTeamInvite(
  ctx: FunctionContext,
  body: { invitationId?: unknown }
): Promise<FunctionResult> {
  const invitationId =
    typeof body.invitationId === 'string' ? body.invitationId : '';
  if (!invitationId) {
    return { status: 400, body: { error: 'invitationId is required' } };
  }

  const invitation = await ctx.db.query<{
    id: string;
    team_id: string;
    email: string;
    invited_by: string;
    token: string;
  }>(
    `SELECT id, team_id, email, invited_by, token
     FROM public.team_invitations
     WHERE id = $1
     LIMIT 1`,
    [invitationId]
  );
  const inv = invitation.rows[0];
  if (!inv) {
    return { status: 404, body: { error: 'Invitation not found' } };
  }

  const role = await getProfileRole(ctx.db, ctx.claims.sub);
  if (role !== 'admin' && inv.invited_by !== ctx.claims.sub) {
    return { status: 403, body: { error: 'Forbidden' } };
  }

  const targetId = await findUserIdByEmail(ctx.db, inv.email);
  if (!targetId) {
    return {
      status: 200,
      body: { success: true, info: 'No user with that email; skipping in-app notification' },
    };
  }

  await ctx.db.query(
    `INSERT INTO public.notifications (user_id, type, title, message, url)
     VALUES ($1, 'team_invite', 'Team invitation', 'You have been invited to join a team.', $2)`,
    [targetId, `/invite/${inv.token}`]
  );

  return { status: 200, body: { success: true } };
}

export async function notifyOrgInvite(
  ctx: FunctionContext,
  body: { invitationId?: unknown }
): Promise<FunctionResult> {
  const invitationId =
    typeof body.invitationId === 'string' ? body.invitationId : '';
  if (!invitationId) {
    return { status: 400, body: { error: 'invitationId is required' } };
  }

  const invitation = await ctx.db.query<{
    id: string;
    organization_id: string;
    email: string;
    invited_by: string;
    token: string;
  }>(
    `SELECT id, organization_id, email, invited_by, token
     FROM public.organization_invitations
     WHERE id = $1
     LIMIT 1`,
    [invitationId]
  );
  const inv = invitation.rows[0];
  if (!inv) {
    return { status: 404, body: { error: 'Invitation not found' } };
  }

  const role = await getProfileRole(ctx.db, ctx.claims.sub);
  if (role !== 'admin' && inv.invited_by !== ctx.claims.sub) {
    return { status: 403, body: { error: 'Forbidden' } };
  }

  const org = await ctx.db.query<{ name: string }>(
    `SELECT name FROM public.organizations WHERE id = $1 LIMIT 1`,
    [inv.organization_id]
  );

  const targetId = await findUserIdByEmail(ctx.db, inv.email);
  if (!targetId) {
    return {
      status: 200,
      body: {
        success: true,
        info: 'No user with that email; skipping in-app notification',
      },
    };
  }

  await ctx.db.query(
    `INSERT INTO public.notifications (user_id, type, title, message, url)
     VALUES ($1, 'org_invite', 'Organization invitation', $2, $3)`,
    [
      targetId,
      `You have been invited to join the organization "${org.rows[0]?.name || 'an organization'}".`,
      `/org-invite/${inv.token}`,
    ]
  );

  return { status: 200, body: { success: true } };
}

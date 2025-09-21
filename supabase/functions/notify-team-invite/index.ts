import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const { invitationId } = await req.json();
    if (!invitationId) return new Response(JSON.stringify({ error: 'invitationId is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const { data: invitation, error: invError } = await supabase
      .from('team_invitations')
      .select('id, team_id, email, invited_by, token, status, is_active')
      .eq('id', invitationId)
      .single();
    if (invError || !invitation) return new Response(JSON.stringify({ error: 'Invitation not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // Only inviter or admin can trigger notification
    const { data: callerProfile } = await supabase.from('profiles').select('id, role').eq('id', userData.user.id).single();
    const isAdmin = callerProfile?.role === 'admin';
    if (!isAdmin && invitation.invited_by !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Find user account by email (might not exist yet)
    const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const target = authUsers.users.find(u => u.email?.toLowerCase() === invitation.email?.toLowerCase());
    if (!target) {
      return new Response(JSON.stringify({ success: true, info: 'No user with that email; skipping in-app notification' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Insert notification for the target user
    const url = `/invite/${invitation.token}`;
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: target.id,
        type: 'team_invite',
        title: 'Team invitation',
        message: 'You have been invited to join a team.',
        url
      });
    if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});



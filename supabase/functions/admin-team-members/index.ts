import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = 'list_teams' | 'list_team_members' | 'add_member' | 'remove_member';

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
    const { data: authUser, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', authUser.user.id).single();
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const body = await req.json();
    const action: Action = body.action;

    if (action === 'list_teams') {
      const q: string | undefined = body.query;
      let query = supabase.from('teams').select('id, name, created_at').order('created_at', { ascending: false }).limit(50);
      if (q && q.trim()) {
        query = supabase.from('teams').select('id, name, created_at').ilike('name', `%${q}%`).order('created_at', { ascending: false }).limit(50);
      }
      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return new Response(JSON.stringify({ teams: data }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'list_team_members') {
      const teamId: string | undefined = body.team_id;
      if (!teamId) return new Response(JSON.stringify({ error: 'team_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const { data: members, error } = await supabase
        .from('team_members')
        .select('id, role, user_id, profiles(full_name, avatar_url)')
        .eq('team_id', teamId)
        .order('id', { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      // decorate with email via admin list
      const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers();
      const emailById = new Map<string, string | null>();
      if (!listErr) {
        for (const u of usersList.users) {
          if (u.email) emailById.set(u.id, u.email);
        }
      }

      const rows = ((members as unknown) as Array<{ id: string; role: 'owner'|'admin'|'member'; user_id: string; profiles: { full_name: string|null; avatar_url: string|null } | null }> || []).map((m) => ({
        id: m.id,
        role: m.role,
        user_id: m.user_id,
        full_name: m.profiles?.full_name || null,
        avatar_url: m.profiles?.avatar_url || null,
        email: emailById.get(m.user_id) || null,
      }));
      return new Response(JSON.stringify({ members: rows }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'add_member') {
      const teamId: string | undefined = body.team_id;
      const userId: string | undefined = body.user_id;
      const email: string | undefined = body.email;
      const role: 'owner' | 'admin' | 'member' = body.role || 'member';
      if (!teamId) return new Response(JSON.stringify({ error: 'team_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      let resolvedUserId = userId || '';
      if (!resolvedUserId && email) {
        const { data: usersList, error } = await supabase.auth.admin.listUsers();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        const found = usersList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (!found) return new Response(JSON.stringify({ error: 'No user found for email' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        resolvedUserId = found.id;
      }
      if (!resolvedUserId) return new Response(JSON.stringify({ error: 'user_id or email is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      // Check if membership exists
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', resolvedUserId)
        .single();
      if (existing) {
        // update role
        const { error } = await supabase
          .from('team_members')
          .update({ role })
          .eq('id', existing.id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } else {
        const { error } = await supabase
          .from('team_members')
          .insert({ team_id: teamId, user_id: resolvedUserId, role });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'remove_member') {
      const teamId: string | undefined = body.team_id;
      const userId: string | undefined = body.user_id;
      const memberId: string | undefined = body.member_id; // team_members.id
      if (!teamId && !memberId) return new Response(JSON.stringify({ error: 'member_id or team_id+user_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      let query = supabase.from('team_members').delete();
      if (memberId) {
        query = query.eq('id', memberId);
      } else {
        if (!userId) return new Response(JSON.stringify({ error: 'user_id required when using team_id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        query = query.eq('team_id', teamId!).eq('user_id', userId);
      }
      const { error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});



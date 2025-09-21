import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SearchResult = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  email: string | null;
  teams: Array<{ id: string; name: string }>;
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
    const { data: authUser, error: userError } = await supabase.auth.getUser(token);
    if (userError || !authUser.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', authUser.user.id).single();
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const { q } = await req.json();
    const query = (q || '').toString().trim();
    if (!query) return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const ids = new Set<string>();

    // 1) Match UUID directly
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (uuidRegex.test(query)) ids.add(query);

    // 2) Search profiles by name
    const { data: profileMatches } = await supabase
      .from('profiles')
      .select('id')
      .ilike('full_name', `%${query}%`)
      .limit(50);
    (profileMatches || []).forEach(r => ids.add(r.id));

    // 3) Search emails via Admin API
    const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers();
    if (!listErr) {
      for (const u of usersList.users) {
        if (u.email && u.email.toLowerCase().includes(query.toLowerCase())) ids.add(u.id);
      }
    }

    // Build results up to 20 entries
    const allIds = Array.from(ids).slice(0, 20);
    if (allIds.length === 0) {
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', allIds);

    // Prepare email map
    const emailById = new Map<string, string | null>();
    for (const u of usersList?.users || []) {
      if (u.email) emailById.set(u.id, u.email);
    }

    // Fetch teams for each user
    const results: SearchResult[] = [];
    for (const p of (profiles || []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string | null }>) {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, teams(id, name)')
        .eq('user_id', p.id);
      const rows = (memberships as unknown as Array<{ team_id: string; teams: { id: string; name: string } | null }>) || [];
      const teams = rows.map(m => ({ id: m.teams?.id || m.team_id, name: m.teams?.name || 'Team' }));
      results.push({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: p.role,
        email: emailById.get(p.id) || null,
        teams
      });
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});



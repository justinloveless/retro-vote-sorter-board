import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

async function checkUserRole(supabase: SupabaseClient, userId: string, teamId: string): Promise<boolean> {
  const { data: member, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single();

  if (error || !member) {
    return false;
  }

  return ['admin', 'owner'].includes(member.role);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create a Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('poker_sessions')
      .select('room_id')
      .eq('id', session_id)
      .single();
    
    if (sessionError || !sessionData) {
      throw new Error(sessionError?.message || 'Session not found');
    }
    const team_id = sessionData.room_id;
    
    // Check if the room_id corresponds to a team
    const { data: team } = await supabaseAdmin.from('teams').select('id').eq('id', team_id).single();

    if (team) {
      // It's a team session, so check permissions
      const isAuthorized = await checkUserRole(supabaseAdmin, user.id, team_id);
      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Forbidden: not an admin or owner' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
    }

    // Perform deletions and updates
    const { error: roundsError } = await supabaseAdmin
      .from('poker_session_rounds')
      .delete()
      .eq('session_id', session_id);

    if (roundsError) throw roundsError;

    const { error: chatsError } = await supabaseAdmin
      .from('poker_session_chat')
      .delete()
      .eq('session_id', session_id);

    if (chatsError) throw chatsError;
    
    const { error: sessionUpdateError } = await supabaseAdmin
      .from('poker_sessions')
      .update({ current_round_number: 1 })
      .eq('id', session_id);

    if (sessionUpdateError) throw sessionUpdateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

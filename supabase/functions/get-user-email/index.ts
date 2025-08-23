import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Client bound to the caller's JWT to identify who is calling
    const authedClient = createClient(url, anon, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') || '' }
      }
    });
    const { data: caller, error: getUserError } = await authedClient.auth.getUser();
    if (getUserError || !caller?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    // Verify caller is an admin
    const { data: profile, error: profileError } = await authedClient
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .single();
    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    // Use service role to fetch user email securely
    const adminClient = createClient(url, service);
    const { data: target, error: adminErr } = await adminClient.auth.admin.getUserById(userId);
    if (adminErr || !target?.user) {
      return new Response(JSON.stringify({ error: adminErr?.message || 'User not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    return new Response(JSON.stringify({ email: target.user.email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});



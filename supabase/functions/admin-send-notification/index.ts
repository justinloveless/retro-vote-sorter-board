import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  recipients: Array<{ userId?: string; email?: string }>;
  type: string;
  title: string;
  message?: string;
  url?: string;
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

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
    if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const body: Body = await req.json();
    if (!Array.isArray(body.recipients) || !body.title || !body.type) return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const ids: string[] = [];
    const emails = body.recipients.filter(r => !!r.email).map(r => r.email!.toLowerCase());
    const directIds = body.recipients.filter(r => !!r.userId).map(r => r.userId!) as string[];
    ids.push(...directIds);

    if (emails.length > 0) {
      const { data: usersList, error } = await supabase.auth.admin.listUsers();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      for (const u of usersList.users) {
        if (u.email && emails.includes(u.email.toLowerCase())) ids.push(u.id);
      }
    }

    const rows = Array.from(new Set(ids)).map((id) => ({
      user_id: id,
      type: body.type,
      title: body.title,
      message: body.message ?? null,
      url: body.url ?? null,
    }));

    if (rows.length === 0) return new Response(JSON.stringify({ success: true, info: 'No recipients resolved' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const { error: insertError } = await supabase.from('notifications').insert(rows);
    if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    return new Response(JSON.stringify({ success: true, count: rows.length }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});



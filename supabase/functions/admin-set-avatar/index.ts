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
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get('user_id');
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing user_id query param' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Expect image bytes in body
    const imageBytes = new Uint8Array(await req.arrayBuffer());
    if (!imageBytes || imageBytes.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty image payload' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin (from auth header if provided)
    // If the function is invoked client-side, Supabase will attach the JWT in Authorization header
    // We can use getUser to identify the caller and then check profile role
    const authHeader = req.headers.get('Authorization');
    let callerUserId: string | null = null;
    if (authHeader) {
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      callerUserId = user?.id ?? null;
    }

    if (!callerUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', callerUserId)
      .single();
    if (profileError || !callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Upload to avatars bucket under target user's id
    const filePath = `${targetUserId}.png`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, imageBytes, { contentType: 'image/png', upsert: true });
    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl;

    // Update target profile's avatar_url
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', targetUserId);
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true, avatar_url: publicUrl }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});



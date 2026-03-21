import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_COMMENT_LEN = 32_000;
const MAX_SENDER_LEN = 200;

function buildCommentBody(commentText: string, senderDisplayName: string): string {
  const safeName = senderDisplayName.replace(/\r/g, '').trim().slice(0, MAX_SENDER_LEN) || 'Unknown user';
  const trimmed = commentText.replace(/\r/g, '').trim();
  const prefix = `-- This message was sent from Retroscope on behalf of ${safeName} --\n`;
  return `${prefix}${trimmed}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { teamId, issueKey, commentText, senderDisplayName } = body as {
      teamId?: string;
      issueKey?: string;
      commentText?: string;
      senderDisplayName?: string;
    };

    if (!teamId || !issueKey) {
      throw new Error('Missing required parameters: teamId and issueKey');
    }

    const text = typeof commentText === 'string' ? commentText : '';
    const sender = typeof senderDisplayName === 'string' ? senderDisplayName : '';
    if (!text.trim()) {
      throw new Error('Comment cannot be empty');
    }
    if (!sender.trim()) {
      throw new Error('Sender display name is required');
    }
    if (text.length > MAX_COMMENT_LEN) {
      throw new Error(`Comment is too long (max ${MAX_COMMENT_LEN} characters)`);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'You must be signed in to comment.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select('jira_domain, jira_email, jira_api_key, jira_ticket_prefix')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const { jira_domain, jira_email, jira_api_key, jira_ticket_prefix } = teamData;

    if (!jira_domain || !jira_email || !jira_api_key) {
      return new Response(
        JSON.stringify({ error: 'Jira is not fully configured for this team.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    let resolvedKey = issueKey;
    if (!issueKey.includes('-') && jira_ticket_prefix) {
      resolvedKey = `${jira_ticket_prefix}-${issueKey}`;
    }

    const auth = btoa(`${jira_email}:${jira_api_key}`);
    const jiraUrl = `${jira_domain}/rest/api/2/issue/${encodeURIComponent(resolvedKey)}/comment`;

    const fullBody = buildCommentBody(text, sender);

    const jiraResponse = await fetch(jiraUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: fullBody }),
    });

    if (!jiraResponse.ok) {
      const errorBody = await jiraResponse.text();
      throw new Error(`Jira API error (${jiraResponse.status}): ${errorBody}`);
    }

    return new Response(
      JSON.stringify({ success: true, issueKey: resolvedKey }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});

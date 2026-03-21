import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, issueKey, query } = await req.json() as {
      teamId?: string;
      issueKey?: string;
      query?: string;
    };

    if (!teamId || !issueKey) {
      throw new Error('Missing required parameters: teamId and issueKey');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

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
    const params = new URLSearchParams({
      issueKey: resolvedKey,
      maxResults: '25',
      query: query ?? '',
    });
    const url = `${jira_domain}/rest/api/3/user/assignable/search?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Jira API error (${res.status}): ${errorBody}`);
    }

    const users = await res.json();
    const list = Array.isArray(users) ? users : [];

    return new Response(
      JSON.stringify({
        users: list.map((u: { accountId?: string; displayName?: string; avatarUrls?: Record<string, string> }) => ({
          accountId: u.accountId ?? '',
          displayName: u.displayName ?? u.accountId ?? '',
          avatarUrls: u.avatarUrls ?? {},
        })),
      }),
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

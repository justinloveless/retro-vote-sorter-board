import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, issueKey, points } = await req.json();

    if (!teamId || !issueKey || points == null) {
      throw new Error('Missing required parameters: teamId, issueKey, and points');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
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
        JSON.stringify({ error: 'Jira is not fully configured for this team. Please set domain, email, and API key.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    let resolvedKey = issueKey;
    if (!issueKey.includes('-') && jira_ticket_prefix) {
      resolvedKey = `${jira_ticket_prefix}-${issueKey}`;
    }

    const auth = btoa(`${jira_email}:${jira_api_key}`);
    const jiraUrl = `${jira_domain}/rest/api/3/issue/${resolvedKey}`;

    const jiraResponse = await fetch(jiraUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          story_point_estimate: points,
        },
      }),
    });

    if (!jiraResponse.ok) {
      const errorBody = await jiraResponse.text();
      throw new Error(`Jira API error (${jiraResponse.status}): ${errorBody}`);
    }

    return new Response(
      JSON.stringify({ success: true, issueKey: resolvedKey, points }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

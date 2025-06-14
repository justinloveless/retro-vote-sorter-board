import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { issueIdOrKey, teamId } = await req.json();

    if (!issueIdOrKey || !teamId) {
      throw new Error('Missing required parameters: issueIdOrKey and teamId');
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select("jira_domain, jira_email, jira_api_key")
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const { jira_domain, jira_email, jira_api_key } = teamData;

    if (!jira_domain) {
      return new Response(
        JSON.stringify({ error: 'Jira domain is not configured for this team.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // If domain is present but API key is not, instruct client to use iFrame
    if (!jira_api_key) {
      return new Response(
        JSON.stringify({ shouldUseIframe: true, domain: jira_domain }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const auth = btoa(`${jira_email}:${jira_api_key}`);
    const jiraUrl = `${jira_domain}/rest/api/2/issue/${issueIdOrKey}`;

    const jiraResponse = await fetch(jiraUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!jiraResponse.ok) {
      const errorBody = await jiraResponse.text();
      throw new Error(`Jira API error (${jiraResponse.status}): ${errorBody}`);
    }

    const issueData = await jiraResponse.json();

    return new Response(JSON.stringify({ ...issueData, shouldUseIframe: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 
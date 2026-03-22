import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, issueKey, points } = await req.json();

    if (!teamId || !issueKey) {
      throw new Error('Missing required parameters: teamId and issueKey');
    }
    if (points !== null && points !== undefined) {
      if (typeof points !== 'number' || !Number.isFinite(points) || points < 0) {
        throw new Error('points must be null (clear) or a valid non-negative number');
      }
    } else if (points === undefined) {
      throw new Error('Missing required parameter: points (use null to clear)');
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
    const jiraBaseUrl = `${jira_domain}/rest/api/3/issue/${resolvedKey}`;

    // Story points use custom field IDs that vary by Jira instance. Fetch issue to find which field exists.
    const knownPointFields = ['customfield_10016', 'customfield_10028', 'customfield_10004', 'customfield_10020'];
    const fieldsParam = knownPointFields.join(',');
    const getRes = await fetch(`${jiraBaseUrl}?fields=${fieldsParam}`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });
    if (!getRes.ok) {
      const errBody = await getRes.text();
      throw new Error(`Jira API error (${getRes.status}): ${errBody}`);
    }
    const issueData = await getRes.json();
    const issueFields = issueData.fields ?? {};
    const pointsFieldKey = knownPointFields.find((key) => key in issueFields) ?? 'customfield_10016';

    const jiraResponse = await fetch(jiraBaseUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          [pointsFieldKey]: points === null ? null : points,
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

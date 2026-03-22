import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { resolveJiraBoardId } from '../_shared/jiraBoardResolve.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      teamId?: string;
      issueKey?: string;
      sprintId?: number | null;
    };

    const { teamId, issueKey } = body;
    const hasSprintId = Object.prototype.hasOwnProperty.call(body, 'sprintId');

    if (!teamId || !issueKey || !hasSprintId) {
      throw new Error('Missing required parameters: teamId, issueKey, and sprintId');
    }

    const sprintId = body.sprintId;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select('jira_domain, jira_email, jira_api_key, jira_ticket_prefix, jira_board_id')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const { jira_domain, jira_email, jira_api_key, jira_ticket_prefix, jira_board_id } = teamData;

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

    const auth = `Basic ${btoa(`${jira_email}:${jira_api_key}`)}`;
    const authHeaders: Record<string, string> = {
      'Authorization': auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const baseUrl = jira_domain.replace(/\/$/, '');
    const projectKey = jira_board_id || jira_ticket_prefix || null;
    const resolvedBoardId = await resolveJiraBoardId(baseUrl, authHeaders, jira_board_id, projectKey);

    if (resolvedBoardId == null) {
      throw new Error(
        'Could not resolve a Jira board for this team. Set Jira Board ID in team settings (numeric Agile board id or project key).',
      );
    }

    if (sprintId === null) {
      const backlogRes = await fetch(
        `${baseUrl}/rest/agile/1.0/backlog/${resolvedBoardId}/issue`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ issues: [resolvedKey] }),
        },
      );
      if (!backlogRes.ok) {
        const errBody = await backlogRes.text();
        throw new Error(`Jira backlog error (${backlogRes.status}): ${errBody}`);
      }
    } else {
      const sid = typeof sprintId === 'number' ? sprintId : parseInt(String(sprintId), 10);
      if (Number.isNaN(sid)) {
        throw new Error('Invalid sprintId');
      }
      const sprintRes = await fetch(
        `${baseUrl}/rest/agile/1.0/sprint/${sid}/issue`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ issues: [resolvedKey] }),
        },
      );
      if (!sprintRes.ok) {
        const errBody = await sprintRes.text();
        throw new Error(`Jira sprint error (${sprintRes.status}): ${errBody}`);
      }
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CreateLinkBody = {
  action: 'create';
  teamId: string;
  issueKey: string;
  targetIssueKey: string;
  linkTypeName: string;
  /** outward = current issue is the "outward" side (e.g. current blocks target); inward = current is "inward" (e.g. current is blocked by target). */
  direction: 'inward' | 'outward';
};

type DeleteLinkBody = {
  action: 'delete';
  teamId: string;
  linkId: string;
};

type ManageLinkBody = CreateLinkBody | DeleteLinkBody;

function makeResolveKey(jiraTicketPrefix: string | null | undefined): (k: string) => string {
  return (k: string) => {
    if (!k.includes('-') && jiraTicketPrefix) {
      return `${jiraTicketPrefix}-${k}`;
    }
    return k;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<ManageLinkBody>;
    const action = body.action;
    const teamId = body.teamId;

    if (!teamId) {
      throw new Error('Missing required parameter: teamId');
    }
    if (action !== 'create' && action !== 'delete') {
      throw new Error("action must be 'create' or 'delete'");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'You must be signed in to modify Jira issue links.' }),
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const auth = btoa(`${jira_email}:${jira_api_key}`);
    const authHeader = `Basic ${auth}`;
    const resolveKey = makeResolveKey(jira_ticket_prefix);

    if (action === 'create') {
      const create = body as CreateLinkBody;
      if (!create.issueKey || !create.targetIssueKey || !create.linkTypeName) {
        throw new Error('Missing required parameters: issueKey, targetIssueKey, linkTypeName');
      }
      if (create.direction !== 'inward' && create.direction !== 'outward') {
        throw new Error("direction must be 'inward' or 'outward'");
      }

      const sourceKey = resolveKey(create.issueKey);
      const targetKey = resolveKey(create.targetIssueKey);

      if (sourceKey.toUpperCase() === targetKey.toUpperCase()) {
        return new Response(
          JSON.stringify({ error: 'Cannot link an issue to itself.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
      }

      // Direction tells us which side of the relationship the current issue plays.
      // outward: current issue is the "outward" side (e.g. "blocks" target → current blocks target)
      // inward:  current issue is the "inward"  side (e.g. "is blocked by" target → current is blocked by target)
      const outwardIssueKey = create.direction === 'outward' ? sourceKey : targetKey;
      const inwardIssueKey = create.direction === 'outward' ? targetKey : sourceKey;

      const payload = {
        type: { name: create.linkTypeName },
        inwardIssue: { key: inwardIssueKey },
        outwardIssue: { key: outwardIssueKey },
      };

      const res = await fetch(`${jira_domain}/rest/api/3/issueLink`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Jira API error (${res.status}): ${errorBody}`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    // delete
    const del = body as DeleteLinkBody;
    if (!del.linkId) {
      throw new Error('Missing required parameter: linkId');
    }

    const delRes = await fetch(
      `${jira_domain}/rest/api/3/issueLink/${encodeURIComponent(String(del.linkId))}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      },
    );

    if (!delRes.ok) {
      const errorBody = await delRes.text();
      throw new Error(`Jira API error (${delRes.status}): ${errorBody}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});

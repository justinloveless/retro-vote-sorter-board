import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, issueKey } = await req.json() as { teamId?: string; issueKey?: string };

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

    const auth = `Basic ${btoa(`${jira_email}:${jira_api_key}`)}`;
    const headers = {
      'Authorization': auth,
      'Accept': 'application/json',
    };

    const base = `${jira_domain}/rest/api/2/issue/${encodeURIComponent(resolvedKey)}`;

    const [editmetaRes, transitionsRes, issueProjectRes] = await Promise.all([
      fetch(`${base}/editmeta`, { headers }),
      fetch(`${base}/transitions`, { headers }),
      fetch(`${base}?fields=project`, { headers }),
    ]);

    if (!editmetaRes.ok) {
      const errBody = await editmetaRes.text();
      throw new Error(`Jira editmeta error (${editmetaRes.status}): ${errBody}`);
    }
    if (!transitionsRes.ok) {
      const errBody = await transitionsRes.text();
      throw new Error(`Jira transitions error (${transitionsRes.status}): ${errBody}`);
    }

    const editmeta = await editmetaRes.json();
    const transData = await transitionsRes.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapAllowed = (arr: any[] | undefined) =>
      (arr ?? []).map((v: { id?: string | number; name?: string; iconUrl?: string }) => ({
        id: String(v.id ?? ''),
        name: String(v.name ?? ''),
        iconUrl: v.iconUrl ?? undefined,
      }));

    const fields = editmeta.fields ?? {};
    const priorities = mapAllowed(fields.priority?.allowedValues);

    // editmeta.issuetype.allowedValues is often a tiny subset; project.issueTypes is the full list for the project.
    let issueTypes = mapAllowed(fields.issuetype?.allowedValues);
    if (issueProjectRes.ok) {
      const issueJson = await issueProjectRes.json();
      const projectKey = issueJson?.fields?.project?.key as string | undefined;
      if (projectKey) {
        const projRes = await fetch(
          `${jira_domain}/rest/api/2/project/${encodeURIComponent(projectKey)}`,
          { headers },
        );
        if (projRes.ok) {
          const proj = await projRes.json();
          const fromProject = mapAllowed(proj.issueTypes);
          if (fromProject.length > 0) {
            issueTypes = fromProject.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transitions = (transData.transitions ?? []).map((t: any) => ({
      id: String(t.id ?? ''),
      name: String(t.name ?? ''),
      toStatusName: t.to?.name != null ? String(t.to.name) : undefined,
    }));

    return new Response(
      JSON.stringify({
        issueKey: resolvedKey,
        priorities,
        issueTypes,
        transitions,
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

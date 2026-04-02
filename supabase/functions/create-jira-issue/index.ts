import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  appendCloneFooterToAdf,
  fetchJiraBoardLocationProjectKey,
  plainTextToAdf,
  resolveTeamProjectKey,
} from '../_shared/jiraAdfCreate.ts';

function resolveIssueKey(issueIdOrKey: string, jiraTicketPrefix: string | null | undefined): string {
  let k = issueIdOrKey.trim();
  if (!k.includes('-') && jira_ticket_prefix_trim(jiraTicketPrefix)) {
    k = `${jira_ticket_prefix_trim(jiraTicketPrefix)}-${k}`;
  }
  return k;
}

function jira_ticket_prefix_trim(p: string | null | undefined): string {
  return (p || '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      teamId?: string;
      summary?: string | null;
      description?: string | null;
      cloneFromIssueKey?: string | null;
      /** Poker split: same project/issue type as parent, empty description (automations + client update later). */
      splitFromIssueKey?: string | null;
    };

    const { teamId, summary, description, cloneFromIssueKey, splitFromIssueKey } = body;
    const isSplit = !!(splitFromIssueKey && String(splitFromIssueKey).trim());
    const isClone = !!(cloneFromIssueKey && String(cloneFromIssueKey).trim());
    if (isSplit && isClone) {
      throw new Error('Use only one of splitFromIssueKey or cloneFromIssueKey');
    }
    const isCloneMode = isClone && !isSplit;

    if (!teamId) {
      throw new Error('Missing required parameter: teamId');
    }

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

    const baseUrl = jira_domain.replace(/\/$/, '');
    const auth = btoa(`${jira_email}:${jira_api_key}`);
    const authHeaders: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    const trimmedBoard = (jira_board_id || '').trim();
    const boardIdNum = parseInt(trimmedBoard, 10);
    const isNumericBoard =
      trimmedBoard !== '' && !isNaN(boardIdNum) && String(boardIdNum) === trimmedBoard;

    let boardProjectKey: string | undefined;
    if (isNumericBoard) {
      boardProjectKey = await fetchJiraBoardLocationProjectKey(baseUrl, authHeaders, boardIdNum);
    }

    const projectKey = resolveTeamProjectKey({
      jiraBoardId: jira_board_id,
      jiraTicketPrefix: jira_ticket_prefix,
      boardProjectKey,
    });

    if (!isCloneMode && !isSplit && !projectKey) {
      throw new Error(
        'Could not resolve Jira project key. Set Team Jira board ID or ticket prefix in settings.',
      );
    }

    // deno-lint-ignore no-explicit-any
    let fields: Record<string, any>;

    async function loadSourceFieldsForKey(rawKey: string) {
      const srcKey = resolveIssueKey(String(rawKey).trim(), jira_ticket_prefix);
      const getUrl = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(srcKey)}`;
      const getRes = await fetch(getUrl, { headers: authHeaders });
      if (!getRes.ok) {
        const t = await getRes.text();
        throw new Error(`Failed to load source issue (${getRes.status}): ${t}`);
      }
      const source = await getRes.json() as {
        key?: string;
        fields?: {
          project?: { key?: string };
          issuetype?: { id?: string };
          summary?: string;
          description?: unknown;
        };
      };
      const srcFields = source.fields;
      if (!srcFields?.project?.key || !srcFields?.issuetype?.id) {
        throw new Error('Source issue is missing project or issue type');
      }
      return { srcKey, sourceKey: source.key || srcKey, srcFields };
    }

    if (isSplit) {
      const { srcFields } = await loadSourceFieldsForKey(String(splitFromIssueKey).trim());
      const sum = typeof summary === 'string' ? summary.trim() : '';
      if (!sum) {
        throw new Error('summary is required for split create');
      }
      if (sum.length > 255) {
        throw new Error('Summary must be 255 characters or fewer');
      }
      fields = {
        project: { key: srcFields.project.key },
        issuetype: { id: srcFields.issuetype.id },
        summary: sum,
        description: plainTextToAdf(''),
      };
    } else if (isCloneMode) {
      const { sourceKey, srcFields } = await loadSourceFieldsForKey(String(cloneFromIssueKey).trim());
      const srcSummary = typeof srcFields.summary === 'string' ? srcFields.summary : '';
      const newSummaryRaw =
        typeof summary === 'string' && summary.trim()
          ? summary.trim()
          : `Clone: ${srcSummary}`.slice(0, 255);
      const newSummary = newSummaryRaw.slice(0, 255);
      const browseUrl = `${baseUrl}/browse/${encodeURIComponent(sourceKey)}`;
      const descriptionAdf = appendCloneFooterToAdf(srcFields.description, sourceKey, browseUrl);
      fields = {
        project: { key: srcFields.project.key },
        issuetype: { id: srcFields.issuetype.id },
        summary: newSummary,
        description: descriptionAdf,
      };
    } else {
      const sum = typeof summary === 'string' ? summary.trim() : '';
      if (!sum) {
        throw new Error('summary is required when not cloning');
      }
      if (sum.length > 255) {
        throw new Error('Summary must be 255 characters or fewer');
      }
      const descStr = typeof description === 'string' ? description : '';
      const descriptionAdf = descStr.trim() ? plainTextToAdf(descStr) : plainTextToAdf('');
      fields = {
        project: { key: projectKey },
        issuetype: { name: 'Story' },
        summary: sum,
        description: descriptionAdf,
      };
    }

    const createUrl = `${baseUrl}/rest/api/3/issue`;
    let createRes = await fetch(createUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ fields }),
    });
    let createErrBody = createRes.ok ? '' : await createRes.text();

    if (!createRes.ok && !isCloneMode && !isSplit && projectKey && createRes.status === 400 &&
      createErrBody.toLowerCase().includes('issuetype')
    ) {
      const metaUrl =
        `${baseUrl}/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&maxResults=50`;
      const metaRes = await fetch(metaUrl, { headers: authHeaders });
      if (metaRes.ok) {
        const meta = await metaRes.json() as {
          projects?: { issuetypes?: { id?: string; name?: string; subtask?: boolean }[] }[];
        };
        const types = meta.projects?.[0]?.issuetypes?.filter((t) => !t.subtask) ?? [];
        const fallback = types.find((t) =>
          /story|task|bug|feature/i.test(String(t.name || ''))
        ) || types[0];
        if (fallback?.id) {
          fields = {
            ...fields,
            issuetype: { id: fallback.id },
          };
          createRes = await fetch(createUrl, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ fields }),
          });
          createErrBody = createRes.ok ? '' : await createRes.text();
        }
      }
    }

    if (!createRes.ok) {
      throw new Error(`Jira create error (${createRes.status}): ${createErrBody}`);
    }

    const created = await createRes.json() as { key?: string; id?: string; self?: string };
    return new Response(
      JSON.stringify({
        key: created.key,
        id: created.id,
        self: created.self,
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

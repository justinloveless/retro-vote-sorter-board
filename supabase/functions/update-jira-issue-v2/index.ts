import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { teamId, issueKey } = body as {
      teamId?: string;
      issueKey?: string;
      description?: string | null;
      descriptionAdf?: Record<string, unknown> | null;
      assigneeAccountId?: string | null;
      summary?: string | null;
      priorityId?: string | null;
      issueTypeId?: string | null;
      transitionId?: string | null;
    };

    if (!teamId || !issueKey) {
      throw new Error('Missing required parameters: teamId and issueKey');
    }

    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    const hasDescriptionAdf = Object.prototype.hasOwnProperty.call(body, 'descriptionAdf');
    const hasAssignee = Object.prototype.hasOwnProperty.call(body, 'assigneeAccountId');
    const hasSummary = Object.prototype.hasOwnProperty.call(body, 'summary');
    const hasPriority = Object.prototype.hasOwnProperty.call(body, 'priorityId');
    const hasIssueType = Object.prototype.hasOwnProperty.call(body, 'issueTypeId');
    const hasTransition = Object.prototype.hasOwnProperty.call(body, 'transitionId');

    if (!hasDescription && !hasDescriptionAdf && !hasAssignee && !hasSummary && !hasPriority && !hasIssueType && !hasTransition) {
      throw new Error(
        'Provide at least one of: description, descriptionAdf, assigneeAccountId, summary, priorityId, issueTypeId, transitionId',
      );
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
        JSON.stringify({ error: 'Jira is not fully configured for this team. Please set domain, email, and API key.' }),
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
    const authHeader = `Basic ${auth}`;

    // Use v3 when sending ADF (native format), v2 for wiki/HTML string descriptions.
    const useV3 = hasDescriptionAdf;
    const apiVersion = useV3 ? '3' : '2';
    const jiraBaseUrl = `${jira_domain}/rest/api/${apiVersion}/issue/${encodeURIComponent(resolvedKey)}`;

    if (hasTransition) {
      const tid = body.transitionId;
      if (tid == null || tid === '') {
        throw new Error('transitionId is required when updating status');
      }
      const transRes = await fetch(`${jiraBaseUrl}/transitions`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transition: { id: String(tid) } }),
      });
      if (!transRes.ok) {
        const errorBody = await transRes.text();
        throw new Error(`Jira transition error (${transRes.status}): ${errorBody}`);
      }
    }

    // deno-lint-ignore no-explicit-any
    const fields: Record<string, any> = {};

    if (hasDescriptionAdf) {
      fields.description = body.descriptionAdf ?? null;
    } else if (hasDescription) {
      const desc = body.description;
      fields.description = typeof desc === 'string' ? desc : '';
    }

    if (hasAssignee) {
      const aid = body.assigneeAccountId;
      if (aid == null || aid === '') {
        fields.assignee = null;
      } else {
        fields.assignee = { accountId: String(aid) };
      }
    }

    if (hasSummary) {
      const raw = typeof body.summary === 'string' ? body.summary.trim() : '';
      if (!raw) {
        throw new Error('Summary cannot be empty');
      }
      if (raw.length > 255) {
        throw new Error('Summary must be 255 characters or fewer');
      }
      fields.summary = raw;
    }

    if (hasPriority) {
      const pid = body.priorityId;
      if (pid == null || pid === '') {
        throw new Error('priorityId is required when updating priority');
      }
      fields.priority = { id: String(pid) };
    }

    if (hasIssueType) {
      const iid = body.issueTypeId;
      if (iid == null || iid === '') {
        throw new Error('issueTypeId is required when updating issue type');
      }
      fields.issuetype = { id: String(iid) };
    }

    if (Object.keys(fields).length > 0) {
      const jiraResponse = await fetch(jiraBaseUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });

      if (!jiraResponse.ok) {
        const errorBody = await jiraResponse.text();
        throw new Error(`Jira API error (${jiraResponse.status}): ${errorBody}`);
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

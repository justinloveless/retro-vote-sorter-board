import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  discoverJiraStoryPointsFieldId,
  getStoryPointsFromIssueFields,
  JIRA_STORY_POINT_FIELD_FALLBACK_IDS,
} from '../_shared/jiraStoryPoints.ts';

const DEFAULT_STORY_POINTS_JQL_FIELD_NAME = 'Story Points';

function escapeJqlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, searchText, statusFilter, pointsFilter, includeKeys } = await req.json();

    if (!teamId) {
      throw new Error('Missing required parameter: teamId');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select("jira_domain, jira_email, jira_api_key, jira_ticket_prefix, jira_board_id")
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    const { jira_domain, jira_email, jira_api_key, jira_ticket_prefix, jira_board_id } = teamData;

    if (!jira_domain || !jira_api_key || !jira_email) {
      return new Response(
        JSON.stringify({ error: 'Jira credentials are not fully configured for this team.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const auth = btoa(`${jira_email}:${jira_api_key}`);
    const authHeaders = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
    const baseUrl = jira_domain.replace(/\/$/, '');
    const projectKey = jira_board_id || jira_ticket_prefix;

    let sprintFieldId: string | null = null;
    let storyPointsFieldId: string | null = null;
    let fieldsList: { id?: string; name?: string; schema?: { custom?: string } }[] = [];
    try {
      const fieldsRes = await fetch(`${baseUrl}/rest/api/3/field`, { headers: authHeaders });
      if (fieldsRes.ok) {
        const fieldsData = await fieldsRes.json();
        fieldsList = fieldsData || [];
        const sprintField = fieldsList.find(
          (f) => f?.schema?.custom?.toLowerCase().includes('sprint') ?? false,
        );
        if (sprintField?.id) sprintFieldId = sprintField.id;
        storyPointsFieldId = discoverJiraStoryPointsFieldId(fieldsList);
      }
    } catch (_) {
      /* ignore */
    }

    const storyPointsJqlField = `"${escapeJqlString(DEFAULT_STORY_POINTS_JQL_FIELD_NAME)}"`;

    const jqlParts: string[] = [];
    if (projectKey) jqlParts.push(`project = "${projectKey}"`);
    jqlParts.push('issuetype NOT IN (Epic, subtaskIssueTypes())');
    jqlParts.push('(sprint in futureSprints() OR sprint in openSprints() OR sprint is EMPTY)');
    if (statusFilter === 'all') {
      // no status
    } else if (statusFilter) {
      jqlParts.push(`statusCategory = "${escapeJqlString(statusFilter)}"`);
    } else {
      jqlParts.push(`statusCategory != "Done"`);
    }
    if (pointsFilter === 'unestimated') {
      jqlParts.push(`${storyPointsJqlField} is EMPTY`);
    } else if (pointsFilter && /^\d+(?:\.\d+)?$/.test(pointsFilter)) {
      jqlParts.push(`${storyPointsJqlField} = ${pointsFilter}`);
    }
    if (searchText) jqlParts.push(`(summary ~ "${searchText}" OR key ~ "${searchText}")`);

    const boardIdNum = parseInt(jira_board_id || '', 10);
    const isNumericBoardId = !isNaN(boardIdNum) && String(boardIdNum) === (jira_board_id || '').trim();
    let resolvedBoardId: number | undefined;
    if (isNumericBoardId) {
      resolvedBoardId = boardIdNum;
    } else if (projectKey) {
      try {
        const boardsRes = await fetch(`${baseUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=100`, { headers: authHeaders });
        if (boardsRes.ok) {
          const boardsData = await boardsRes.json();
          const boards = boardsData?.values || [];
          const scrumBoard = boards.find((b: { type?: string }) => b?.type === 'scrum');
          const first = scrumBoard || boards[0];
          if (first?.id) resolvedBoardId = first.id;
        }
        if (resolvedBoardId == null) {
          const allRes = await fetch(`${baseUrl}/rest/agile/1.0/board?maxResults=100&startAt=0`, { headers: authHeaders });
          if (allRes.ok) {
            const allData = await allRes.json();
            const boards = allData?.values || [];
            const pkUpper = projectKey.toUpperCase();
            const match = boards.find((b: { location?: { projectKey?: string; key?: string } }) => {
              const pk = b?.location?.projectKey || b?.location?.key;
              return pk && pk.toUpperCase() === pkUpper;
            });
            const scrumFirst = boards.find((b: { type?: string }) => b?.type === 'scrum');
            const chosen = match || scrumFirst || boards[0];
            if (chosen?.id) resolvedBoardId = chosen.id;
          }
        }
      } catch (_) {
        /* ignore */
      }
    }

    let sprintJql = '(sprint in futureSprints() OR sprint in openSprints() OR sprint is EMPTY)';
    const sprintIdToName = new Map<number | string, string>();
    if (resolvedBoardId != null) {
      try {
        const sprintsRes = await fetch(`${baseUrl}/rest/agile/1.0/board/${resolvedBoardId}/sprint`, { headers: authHeaders });
        if (sprintsRes.ok) {
          const sprintsData = await sprintsRes.json();
          // deno-lint-ignore no-explicit-any
          const openSprints = (sprintsData?.values || []).filter((s: any) => s?.id != null && (s?.state === 'future' || s?.state === 'active'));
          for (const s of openSprints) {
            if (s?.name) sprintIdToName.set(s.id, s.name);
          }
          if (openSprints.length > 0) {
            // deno-lint-ignore no-explicit-any
            sprintJql = `(sprint in (${openSprints.map((s: any) => s.id).join(', ')}) OR sprint is EMPTY)`;
          }
        }
      } catch (_) {
        /* ignore */
      }
    }

    const sprintIdx = jqlParts.findIndex((p) => p?.includes('sprint in') || p?.includes('sprint is'));
    if (sprintIdx >= 0) jqlParts[sprintIdx] = sprintJql;
    const jql = jqlParts.join(' AND ') + ' ORDER BY sprint, created DESC';

    const coreFieldNames = ['summary', 'status', 'priority', 'assignee', 'reporter', 'parent', 'issuetype'];
    const pointFieldIdSet = new Set<string>([...JIRA_STORY_POINT_FIELD_FALLBACK_IDS]);
    if (storyPointsFieldId) pointFieldIdSet.add(storyPointsFieldId);
    const fieldsArray = [
      ...coreFieldNames,
      ...pointFieldIdSet,
      ...(sprintFieldId ? [sprintFieldId] : ['customfield_10020', 'customfield_10021']),
    ];
    const fieldsParam = [...new Set(fieldsArray)].join(',');

    const getSprintName = (fields: Record<string, unknown> | null | undefined): string | null => {
      const extract = (val: unknown): string | null => {
        if (val == null) return null;
        const arr = Array.isArray(val) ? val : [val];
        for (let i = arr.length - 1; i >= 0; i--) {
          const item = arr[i];
          if (!item) continue;
          if (typeof item === 'object' && item !== null) {
            const state = ('state' in item && typeof item.state === 'string') ? item.state : null;
            if (state === 'closed') continue;
            if ('name' in item && item.name != null) return String(item.name);
            if ('id' in item && item.id != null) {
              const id = typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10);
              if (!isNaN(id) && sprintIdToName.has(id)) return sprintIdToName.get(id)!;
            }
          }
          if (typeof item === 'string') {
            const stateMatch = item.match(/state=([^,\]]+)/);
            if (stateMatch && stateMatch[1].trim().toLowerCase() === 'closed') continue;
            const nameMatch = item.match(/name=([^,\]]+)/);
            if (nameMatch) return nameMatch[1].trim();
            const idMatch = item.match(/id=(\d+)/);
            if (idMatch) {
              const id = parseInt(idMatch[1], 10);
              if (sprintIdToName.has(id)) return sprintIdToName.get(id)!;
            }
          }
        }
        return null;
      };
      for (const [key, value] of Object.entries(fields || {})) {
        if (value == null) continue;
        if (!key.startsWith('customfield_') && key !== 'sprint') continue;
        const name = extract(value);
        if (name) return name;
      }
      return null;
    };

    const allIssues: Record<string, unknown>[] = [];
    const seenKeys = new Set<string>();
    const pageSize = 100;
    const maxPages = 100;
    let nextPageToken: string | undefined = undefined;

    for (let page = 0; page < maxPages; page++) {
      const body: Record<string, unknown> = {
        jql: jql.trim(),
        maxResults: pageSize,
        fields: fieldsParam.split(','),
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const res = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Jira API error (${res.status}): ${await res.text()}`);
      const data = await res.json();
      const batch = data.issues || [];
      for (const i of batch) {
        const k = i?.key;
        if (k && !seenKeys.has(k)) {
          seenKeys.add(k);
          allIssues.push(i);
        }
      }
      if (batch.length === 0 || !data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }

    if (Array.isArray(includeKeys) && includeKeys.length > 0) {
      const keysToFetch = includeKeys.filter((k: string) => typeof k === 'string' && k.trim() && !seenKeys.has(k.trim()));
      if (keysToFetch.length > 0) {
        const keysJql = `key in (${keysToFetch.map((k: string) => `"${String(k).replace(/"/g, '\\"')}"`).join(', ')})`;
        try {
          const incRes = await fetch(`${baseUrl}/rest/api/3/search`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ jql: keysJql, maxResults: 50, fields: fieldsParam.split(',') }),
          });
          if (incRes.ok) {
            const incData = await incRes.json();
            for (const i of incData.issues || []) {
              const k = i?.key;
              if (k && !seenKeys.has(k)) {
                seenKeys.add(k);
                allIssues.push(i);
              }
            }
          }
        } catch (_) {
          /* ignore */
        }
      }
    }

    // deno-lint-ignore no-explicit-any
    const issues = allIssues.map((issue: any) => {
      const fields = issue.fields as Record<string, unknown>;
      return {
        key: issue.key,
        summary: issue.fields?.summary || '',
        status: issue.fields?.status?.name || '',
        statusCategory: issue.fields?.status?.statusCategory?.key || '',
        priority: issue.fields?.priority?.name || '',
        priorityIconUrl: issue.fields?.priority?.iconUrl || '',
        assignee: issue.fields?.assignee?.displayName || null,
        reporter: issue.fields?.reporter?.displayName || null,
        parent: issue.fields?.parent ? { key: issue.fields.parent.key, summary: issue.fields.parent.fields?.summary || '' } : null,
        sprint: getSprintName(fields) || 'Backlog',
        issueType: issue.fields?.issuetype?.name || '',
        issueTypeIconUrl: issue.fields?.issuetype?.iconUrl || '',
        storyPoints: getStoryPointsFromIssueFields(fields, storyPointsFieldId),
      };
    });

    return new Response(JSON.stringify({
      issues,
      total: issues.length,
      jql: jql.trim(),
    }), {
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

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

function createGetSprintMeta(
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
) {
  return (fields: Record<string, unknown> | null | undefined): { name: string | null; startDate: string | null } => {
    const extract = (val: unknown): { name: string; startDate: string | null } | null => {
      if (val == null) return null;
      const arr = Array.isArray(val) ? val : [val];
      for (let i = arr.length - 1; i >= 0; i--) {
        const item = arr[i];
        if (!item) continue;
        if (typeof item === 'object' && item !== null) {
          const o = item as Record<string, unknown>;
          const state = typeof o.state === 'string' ? o.state : null;
          if (state === 'closed') continue;
          let name: string | null = null;
          if (o.name != null) name = String(o.name);
          let id: number | null = null;
          if (o.id != null) {
            const raw = typeof o.id === 'number' ? o.id : parseInt(String(o.id), 10);
            id = !isNaN(raw) ? raw : null;
          }
          if (!name && id != null && sprintIdToName.has(id)) name = sprintIdToName.get(id)!;
          let startDate: string | null = null;
          if (typeof o.startDate === 'string' && o.startDate) startDate = o.startDate;
          else if (id != null && sprintIdToStartDate.has(id)) startDate = sprintIdToStartDate.get(id)!;
          if (name) return { name, startDate };
        }
        if (typeof item === 'string') {
          const stateMatch = item.match(/state=([^,\]]+)/);
          if (stateMatch && stateMatch[1].trim().toLowerCase() === 'closed') continue;
          const nameMatch = item.match(/name=([^,\]]+)/);
          if (nameMatch) return { name: nameMatch[1].trim(), startDate: null };
          const idMatch = item.match(/id=(\d+)/);
          if (idMatch) {
            const id = parseInt(idMatch[1], 10);
            if (sprintIdToName.has(id)) {
              const sd = sprintIdToStartDate.has(id) ? sprintIdToStartDate.get(id)! : null;
              return { name: sprintIdToName.get(id)!, startDate: sd };
            }
          }
        }
      }
      return null;
    };
    for (const [key, value] of Object.entries(fields || {})) {
      if (value == null) continue;
      if (!key.startsWith('customfield_') && key !== 'sprint') continue;
      const meta = extract(value);
      if (meta) return meta;
    }
    return { name: null, startDate: null };
  };
}

// deno-lint-ignore no-explicit-any
function mapIssueToBrowseRow(issue: any, getSprintMeta: ReturnType<typeof createGetSprintMeta>, storyPointsFieldId: string | null) {
  const fields = issue.fields as Record<string, unknown>;
  const sprintMeta = getSprintMeta(fields);
  const sprintName = sprintMeta.name || 'Backlog';
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
    sprint: sprintName,
    sprintStartDate: sprintMeta.name ? sprintMeta.startDate : null,
    issueType: issue.fields?.issuetype?.name || '',
    issueTypeIconUrl: issue.fields?.issuetype?.iconUrl || '',
    storyPoints: getStoryPointsFromIssueFields(fields, storyPointsFieldId),
  };
}

async function fetchIssuesByKeyChunks(
  baseUrl: string,
  authHeaders: Record<string, string>,
  fieldsParam: string,
  keysToFetch: string[],
): Promise<Record<string, unknown>[]> {
  const KEY_CHUNK = 40;
  const allIssues: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();
  const fieldsArr = fieldsParam.split(',');

  for (let i = 0; i < keysToFetch.length; i += KEY_CHUNK) {
    const chunk = keysToFetch.slice(i, i + KEY_CHUNK);
    const keysJql = `key in (${chunk.map((k: string) => `"${String(k).replace(/"/g, '\\"')}"`).join(', ')})`;
    try {
      const incRes = await fetch(`${baseUrl}/rest/api/3/search`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          jql: keysJql,
          maxResults: Math.min(100, chunk.length + 10),
          fields: fieldsArr,
        }),
      });
      if (!incRes.ok) continue;
      const incData = await incRes.json();
      for (const issue of incData.issues || []) {
        const k = issue?.key;
        if (k && !seenKeys.has(k)) {
          seenKeys.add(k);
          allIssues.push(issue);
        }
      }
    } catch (_) {
      /* ignore chunk */
    }
  }
  return allIssues;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { teamId, searchText, statusFilter, pointsFilter, includeKeys, keysOnly } = await req.json();

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

    const coreFieldNames = ['summary', 'status', 'priority', 'assignee', 'reporter', 'parent', 'issuetype'];
    const pointFieldIdSet = new Set<string>([...JIRA_STORY_POINT_FIELD_FALLBACK_IDS]);
    if (storyPointsFieldId) pointFieldIdSet.add(storyPointsFieldId);
    const fieldsArray = [
      ...coreFieldNames,
      ...pointFieldIdSet,
      ...(sprintFieldId ? [sprintFieldId] : ['customfield_10020', 'customfield_10021']),
    ];
    const fieldsParam = [...new Set(fieldsArray)].join(',');

    if (keysOnly === true) {
      if (!Array.isArray(includeKeys) || includeKeys.length === 0) {
        throw new Error('keysOnly requires a non-empty includeKeys array');
      }
      const rawKeys = [
        ...new Set(
          includeKeys
            .filter((k: unknown): k is string => typeof k === 'string' && !!k.trim())
            .map((k: string) => k.trim()),
        ),
      ];
      const emptyName = new Map<number | string, string>();
      const emptyStart = new Map<number | string, string>();
      const getSprintMeta = createGetSprintMeta(emptyName, emptyStart);
      const rawIssues = await fetchIssuesByKeyChunks(baseUrl, authHeaders, fieldsParam, rawKeys);
      // deno-lint-ignore no-explicit-any
      const issues = rawIssues.map((issue: any) => mapIssueToBrowseRow(issue, getSprintMeta, storyPointsFieldId));
      return new Response(
        JSON.stringify({
          issues,
          total: issues.length,
          jql: `keysOnly (${rawKeys.length} keys)`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
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
    const sprintIdToStartDate = new Map<number | string, string>();
    if (resolvedBoardId != null) {
      try {
        const sprintsRes = await fetch(`${baseUrl}/rest/agile/1.0/board/${resolvedBoardId}/sprint`, { headers: authHeaders });
        if (sprintsRes.ok) {
          const sprintsData = await sprintsRes.json();
          // deno-lint-ignore no-explicit-any
          const openSprints = (sprintsData?.values || []).filter((s: any) => s?.id != null && (s?.state === 'future' || s?.state === 'active'));
          for (const s of openSprints) {
            if (s?.name) sprintIdToName.set(s.id, s.name);
            if (typeof s?.startDate === 'string' && s.startDate) sprintIdToStartDate.set(s.id, s.startDate);
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

    const getSprintMeta = createGetSprintMeta(sprintIdToName, sprintIdToStartDate);

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
        const extra = await fetchIssuesByKeyChunks(baseUrl, authHeaders, fieldsParam, keysToFetch);
        for (const i of extra) {
          const k = i?.key as string | undefined;
          if (k && !seenKeys.has(k)) {
            seenKeys.add(k);
            allIssues.push(i);
          }
        }
      }
    }

    // deno-lint-ignore no-explicit-any
    const issues = allIssues.map((issue: any) => mapIssueToBrowseRow(issue, getSprintMeta, storyPointsFieldId));

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

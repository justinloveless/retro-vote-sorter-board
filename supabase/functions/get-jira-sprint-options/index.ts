import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createGetSprintMeta } from '../_shared/jiraSprintFields.ts';
import { resolveJiraBoardId } from '../_shared/jiraBoardResolve.ts';

type SprintRow = { id?: number; name?: string; state?: string; startDate?: string };

function pushPickerFromRows(
  rows: SprintRow[],
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
  pickerSprints: Array<{ id: number; name: string; state: string; startDate: string | null }>,
) {
  for (const s of rows) {
    if (s?.id == null || !s?.name) continue;
    sprintIdToName.set(s.id, s.name);
    if (typeof s.startDate === 'string' && s.startDate) {
      sprintIdToStartDate.set(s.id, s.startDate);
    }
    const st = String(s.state ?? '').toLowerCase();
    if (st === 'active' || st === 'future') {
      pickerSprints.push({
        id: s.id,
        name: s.name,
        state: String(s.state ?? ''),
        startDate: typeof s.startDate === 'string' ? s.startDate : null,
      });
    }
  }
}

/** Prefer Agile API `state=future,active` so we are not limited to the first page of mostly closed sprints. */
async function loadPickerSprints(
  baseUrl: string,
  boardId: number,
  authHeaders: Record<string, string>,
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
): Promise<Array<{ id: number; name: string; state: string; startDate: string | null }>> {
  const pickerSprints: Array<{ id: number; name: string; state: string; startDate: string | null }> = [];

  let startAt = 0;
  const maxResults = 50;
  let isLast = false;
  let usedFilteredApi = false;

  while (!isLast) {
    const q = new URLSearchParams();
    q.set('maxResults', String(maxResults));
    q.set('startAt', String(startAt));
    q.set('state', 'future,active');
    const res = await fetch(
      `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?${q.toString()}`,
      { headers: authHeaders },
    );
    if (!res.ok) {
      break;
    }
    usedFilteredApi = true;
    const data = await res.json();
    const values = (data?.values ?? []) as SprintRow[];
    pushPickerFromRows(values, sprintIdToName, sprintIdToStartDate, pickerSprints);
    isLast = data?.isLast === true;
    startAt += values.length;
    if (values.length === 0) isLast = true;
  }

  if (!usedFilteredApi || pickerSprints.length === 0) {
    // Fallback: paginate all sprints and keep active/future (first pages may be only closed).
    pickerSprints.length = 0;
    startAt = 0;
    isLast = false;
    const maxPages = 30;
    for (let page = 0; page < maxPages && !isLast; page++) {
      const q = new URLSearchParams();
      q.set('maxResults', String(maxResults));
      q.set('startAt', String(startAt));
      const res = await fetch(
        `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?${q.toString()}`,
        { headers: authHeaders },
      );
      if (!res.ok) break;
      const data = await res.json();
      const values = (data?.values ?? []) as SprintRow[];
      pushPickerFromRows(values, sprintIdToName, sprintIdToStartDate, pickerSprints);
      isLast = data?.isLast === true;
      startAt += values.length;
      if (values.length === 0) isLast = true;
    }
  }

  const seen = new Set<number>();
  const deduped = pickerSprints.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  deduped.sort((a, b) => {
    const ta = a.startDate ? new Date(a.startDate).getTime() : NaN;
    const tb = b.startDate ? new Date(b.startDate).getTime() : NaN;
    const aOk = !Number.isNaN(ta);
    const bOk = !Number.isNaN(tb);
    if (aOk && bOk && ta !== tb) return ta - tb;
    if (aOk !== bOk) return aOk ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  return deduped;
}

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
    const issueRes = await fetch(`${baseUrl}/rest/api/2/issue/${encodeURIComponent(resolvedKey)}`, {
      headers: authHeaders,
    });

    if (!issueRes.ok) {
      const errBody = await issueRes.text();
      throw new Error(`Jira issue error (${issueRes.status}): ${errBody}`);
    }

    const issueJson = await issueRes.json();
    const fields = issueJson?.fields as Record<string, unknown> | undefined;

    const projectKey = jira_board_id || jira_ticket_prefix || null;
    const resolvedBoardId = await resolveJiraBoardId(baseUrl, authHeaders, jira_board_id, projectKey);

    const sprintIdToName = new Map<number | string, string>();
    const sprintIdToStartDate = new Map<number | string, string>();
    const pickerSprints =
      resolvedBoardId != null
        ? await loadPickerSprints(baseUrl, resolvedBoardId, authHeaders, sprintIdToName, sprintIdToStartDate)
        : [];

    const getSprintMeta = createGetSprintMeta(sprintIdToName, sprintIdToStartDate);
    const meta = getSprintMeta(fields);
    const currentSprintName = meta.name || 'Backlog';
    const currentSprintId = meta.sprintId;
    const pickerIds = new Set(pickerSprints.map((s) => s.id));
    const currentSprintInPicker =
      currentSprintId != null && pickerIds.has(currentSprintId);

    return new Response(
      JSON.stringify({
        issueKey: resolvedKey,
        boardId: resolvedBoardId ?? null,
        pickerSprints,
        currentSprintName,
        currentSprintId,
        currentSprintInPicker,
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

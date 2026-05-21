/** Paginated board sprint loading — mirrors get-jira-sprint-options (state=future,active avoids first-page closed-only results). */

export type BoardSprintRow = {
  id: number;
  name?: string;
  state?: string;
  startDate?: string;
};

function pushSprintRows(
  rows: Array<{ id?: number; name?: string; state?: string; startDate?: string }>,
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
  out: BoardSprintRow[],
  stateFilter: Set<string> | null,
): void {
  for (const s of rows) {
    if (s?.id == null) continue;
    const id = typeof s.id === 'number' ? s.id : parseInt(String(s.id), 10);
    if (Number.isNaN(id)) continue;
    const st = String(s.state ?? '').toLowerCase();
    if (stateFilter && !stateFilter.has(st)) continue;
    const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : undefined;
    const startDate = typeof s.startDate === 'string' && s.startDate ? s.startDate : undefined;
    if (name) sprintIdToName.set(id, name);
    if (startDate) sprintIdToStartDate.set(id, startDate);
    out.push({ id, name, state: s.state, startDate });
  }
}

async function paginateBoardSprints(
  baseUrl: string,
  authHeaders: Record<string, string>,
  boardId: number,
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
  stateFilter: Set<string> | null,
  stateQuery: string | undefined,
  maxPages: number,
): Promise<BoardSprintRow[]> {
  const out: BoardSprintRow[] = [];
  let startAt = 0;
  const maxResults = 50;

  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams();
    q.set('maxResults', String(maxResults));
    q.set('startAt', String(startAt));
    if (stateQuery) q.set('state', stateQuery);

    const res = await fetch(`${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?${q.toString()}`, {
      headers: authHeaders,
    });
    if (!res.ok) break;

    const data = await res.json();
    const values = (data?.values ?? []) as Array<{ id?: number; name?: string; state?: string; startDate?: string }>;
    pushSprintRows(values, sprintIdToName, sprintIdToStartDate, out, stateFilter);

    const isLast = data?.isLast === true || values.length === 0;
    if (isLast) break;
    startAt += values.length;
  }

  return out;
}

/** Active + future sprints on the board (paginated). Use for ranked sprint/issue fetch. */
export async function loadBoardActiveFutureSprints(
  baseUrl: string,
  authHeaders: Record<string, string>,
  boardId: number,
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
): Promise<BoardSprintRow[]> {
  const activeFuture = new Set(['active', 'future']);
  const rows = await paginateBoardSprints(
    baseUrl,
    authHeaders,
    boardId,
    sprintIdToName,
    sprintIdToStartDate,
    activeFuture,
    'future,active',
    30,
  );

  if (rows.length > 0) {
    return dedupeSprintsById(rows);
  }

  // Fallback: paginate all sprints and keep active/future (older Jira without state query param).
  const fallback = await paginateBoardSprints(
    baseUrl,
    authHeaders,
    boardId,
    sprintIdToName,
    sprintIdToStartDate,
    activeFuture,
    undefined,
    30,
  );
  return dedupeSprintsById(fallback);
}

function dedupeSprintsById(rows: BoardSprintRow[]): BoardSprintRow[] {
  const seen = new Set<number>();
  return rows.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

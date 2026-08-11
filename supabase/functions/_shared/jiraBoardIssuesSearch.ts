/** Pure helpers for get-jira-board-issues search / browse path selection. */

/** If the user typed a bare issue key, fetch it by key — board JQL sprint/issuetype filters often hide those issues. */
export function issueKeyFromSearchText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  const m = t.match(/^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}`;
}

export function hasNonEmptySearchText(searchText: unknown): boolean {
  return typeof searchText === 'string' && searchText.trim().length > 0;
}

/**
 * Board-ranked browse walks every active/future sprint + backlog (many sequential Jira calls).
 * That is correct for the default board view, but far too slow when the user is searching —
 * especially for a single issue key.
 */
export function shouldUseBoardRankedIssueFetch(opts: {
  resolvedBoardId: number | null | undefined;
  sprintScope: string;
  searchText: unknown;
}): boolean {
  if (opts.resolvedBoardId == null) return false;
  if (opts.sprintScope !== 'board-open-backlog') return false;
  if (hasNonEmptySearchText(opts.searchText)) return false;
  return true;
}

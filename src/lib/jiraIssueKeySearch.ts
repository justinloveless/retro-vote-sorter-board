/** Bare Jira issue key typed into Browse Jira search (e.g. RNMT-8100). */
export function issueKeyFromSearchText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  const m = t.match(/^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}`;
}

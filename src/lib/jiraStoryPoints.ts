/** Custom field ids commonly used for Story Points across Jira Cloud / Server instances. */
export const JIRA_STORY_POINT_FIELD_IDS = [
  'customfield_10016',
  'customfield_10028',
  'customfield_10004',
  'customfield_10020',
] as const;

export function getStoryPointsFromJiraFields(
  fields: Record<string, unknown> | null | undefined,
): number | null {
  if (!fields) return null;
  const keys = ['story_points', ...JIRA_STORY_POINT_FIELD_IDS];
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    const v = fields[k];
    if (v == null) continue;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

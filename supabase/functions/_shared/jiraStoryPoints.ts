/** Common Story Points custom field ids (varies by Jira site). */
export const JIRA_STORY_POINT_FIELD_FALLBACK_IDS = [
  'customfield_10016',
  'customfield_10028',
  'customfield_10004',
  'customfield_10020',
] as const;

type JiraFieldMeta = {
  id?: string;
  name?: string;
  schema?: { custom?: string; type?: string };
};

export function discoverJiraStoryPointsFieldId(fieldsList: JiraFieldMeta[]): string | null {
  for (const f of fieldsList || []) {
    const c = f?.schema?.custom?.toLowerCase() ?? '';
    if (
      c.includes('jsw-story-points') ||
      c.includes('gh-story-points') ||
      c.includes('story-points') ||
      c.includes('jpo-custom-field-story-points')
    ) {
      const id = f.id;
      if (id && /^customfield_\d+$/i.test(id)) return id;
    }
  }
  for (const f of fieldsList || []) {
    const name = (f?.name || '').trim();
    if (!name || !/story\s*point/i.test(name)) continue;
    const id = f.id;
    if (id && /^customfield_\d+$/i.test(id)) return id;
  }
  return null;
}

export function getStoryPointsFromIssueFields(
  fields: Record<string, unknown> | null | undefined,
  discoveredFieldId: string | null,
): number | null {
  if (!fields) return null;
  const order: string[] = [];
  if (discoveredFieldId) order.push(discoveredFieldId);
  for (const id of JIRA_STORY_POINT_FIELD_FALLBACK_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  order.push('story_points');
  const seen = new Set<string>();
  for (const k of order) {
    if (!k || seen.has(k)) continue;
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

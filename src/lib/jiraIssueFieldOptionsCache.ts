/** Edit meta (transitions, priorities, issue types) is per issue but stable for a poker round; cache 1h. */

export const JIRA_FIELD_OPTIONS_TTL_MS = 60 * 60 * 1000;

export type JiraFieldOptionsPayload = {
  priorities: Array<{ id: string; name: string; iconUrl?: string }>;
  issueTypes: Array<{ id: string; name: string; iconUrl?: string }>;
  transitions: Array<{ id: string; name: string; toStatusName?: string }>;
};

type Entry = { data: JiraFieldOptionsPayload; expiresAt: number };

const store = new Map<string, Entry>();

function key(teamId: string, issueKey: string): string {
  return `${teamId}:${issueKey}`;
}

export function getCachedIssueFieldOptions(teamId: string, issueKey: string): JiraFieldOptionsPayload | null {
  const k = key(teamId, issueKey);
  const entry = store.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return null;
  }
  return entry.data;
}

export function setCachedIssueFieldOptions(
  teamId: string,
  issueKey: string,
  data: JiraFieldOptionsPayload,
): void {
  store.set(key(teamId, issueKey), {
    data,
    expiresAt: Date.now() + JIRA_FIELD_OPTIONS_TTL_MS,
  });
}

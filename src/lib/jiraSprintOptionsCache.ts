import { getSprintBucketFromIssueFields } from '@/lib/jiraSprintFromFields';

/** Sprint list for a team/board changes rarely; cache 1h to avoid repeated edge calls during poker. */
export const JIRA_SPRINT_OPTIONS_TTL_MS = 60 * 60 * 1000;

export type JiraPickerSprintRow = {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
};

export type SprintPickerData = {
  issueKey: string;
  boardId: number | null;
  pickerSprints: JiraPickerSprintRow[];
  currentSprintName: string;
  currentSprintId: number | null;
  currentSprintInPicker: boolean;
};

type CachedTeamSprintOptions = {
  boardId: number | null;
  pickerSprints: JiraPickerSprintRow[];
  expiresAt: number;
};

const store = new Map<string, CachedTeamSprintOptions>();

export function getCachedTeamSprintPickerOptions(teamId: string): CachedTeamSprintOptions | null {
  const entry = store.get(teamId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(teamId);
    return null;
  }
  return entry;
}

export function setCachedTeamSprintPickerOptions(
  teamId: string,
  data: { boardId: number | null; pickerSprints: JiraPickerSprintRow[] },
): void {
  store.set(teamId, {
    ...data,
    expiresAt: Date.now() + JIRA_SPRINT_OPTIONS_TTL_MS,
  });
}

/** Per-issue fields (current sprint) merged with cached board sprint list. */
export function buildSprintPickerDataFromCacheAndIssue(
  issueKey: string,
  fields: Record<string, unknown> | null | undefined,
  cached: { boardId: number | null; pickerSprints: JiraPickerSprintRow[] },
): SprintPickerData {
  const sprintBucket = fields ? getSprintBucketFromIssueFields(fields) : null;
  const pickerIds = new Set(cached.pickerSprints.map((s) => s.id));
  const currentSprintId = sprintBucket?.sprintId ?? null;
  return {
    issueKey,
    boardId: cached.boardId,
    pickerSprints: cached.pickerSprints,
    currentSprintName: sprintBucket?.displayName ?? '—',
    currentSprintId,
    currentSprintInPicker: currentSprintId != null && pickerIds.has(currentSprintId),
  };
}

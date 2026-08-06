/**
 * Field selection for ticket-detail fetches.
 * Avoids returning every custom field / changelog-sized payload from Jira.
 */

import {
  discoverJiraStoryPointsFieldId,
  JIRA_STORY_POINT_FIELD_FALLBACK_IDS,
} from './jiraStoryPoints.ts';

export const JIRA_ISSUE_DETAIL_CORE_FIELDS = [
  'summary',
  'description',
  'status',
  'priority',
  'assignee',
  'reporter',
  'issuetype',
  'parent',
  'labels',
  'attachment',
  'issuelinks',
  'created',
  'updated',
  'project',
  'sprint',
] as const;

/** Common Sprint field ids when /field discovery is unavailable. */
export const JIRA_SPRINT_FIELD_FALLBACK_IDS = [
  'customfield_10020',
  'customfield_10021',
] as const;

export const JIRA_ISSUE_DETAIL_MAX_COMMENTS = 20;

type JiraFieldMeta = {
  id?: string;
  name?: string;
  schema?: { custom?: string; type?: string };
};

type CachedTeamFields = {
  fieldsParam: string;
  timestamp: number;
};

const TEAM_FIELDS_CACHE_TTL_MS = 10 * 60_000;
const teamFieldsCache = new Map<string, CachedTeamFields>();

function discoverSprintFieldId(fieldsList: JiraFieldMeta[]): string | null {
  for (const f of fieldsList || []) {
    const custom = f?.schema?.custom?.toLowerCase() ?? '';
    if (custom.includes('sprint')) {
      const id = f.id;
      if (id && /^customfield_\d+$/i.test(id)) return id;
    }
  }
  return null;
}

/** Static fallback list used when field metadata cannot be loaded. */
export function buildStaticJiraIssueDetailFieldsParam(): string {
  return [
    ...JIRA_ISSUE_DETAIL_CORE_FIELDS,
    ...JIRA_STORY_POINT_FIELD_FALLBACK_IDS,
    ...JIRA_SPRINT_FIELD_FALLBACK_IDS,
  ].join(',');
}

async function discoverAndCacheFieldsParam(
  teamId: string,
  baseUrl: string,
  authHeaders: Record<string, string>,
): Promise<string> {
  const pointIds = new Set<string>(JIRA_STORY_POINT_FIELD_FALLBACK_IDS);
  const sprintIds = new Set<string>(JIRA_SPRINT_FIELD_FALLBACK_IDS);

  try {
    const fieldsRes = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/api/3/field`, {
      headers: authHeaders,
    });
    if (fieldsRes.ok) {
      const fieldsList = (await fieldsRes.json()) as JiraFieldMeta[];
      const storyPointsFieldId = discoverJiraStoryPointsFieldId(fieldsList);
      if (storyPointsFieldId) pointIds.add(storyPointsFieldId);
      const sprintFieldId = discoverSprintFieldId(fieldsList);
      if (sprintFieldId) sprintIds.add(sprintFieldId);
    }
  } catch {
    /* use fallbacks */
  }

  const fieldsParam = [
    ...JIRA_ISSUE_DETAIL_CORE_FIELDS,
    ...pointIds,
    ...sprintIds,
  ].join(',');

  teamFieldsCache.set(teamId, { fieldsParam, timestamp: Date.now() });
  return fieldsParam;
}

/**
 * Resolve the fields query for issue detail.
 * Returns cached/static fields immediately so /field discovery never blocks the issue GET.
 * Warms the per-team cache in the background on first use.
 */
export function resolveJiraIssueDetailFieldsParam(
  teamId: string,
  baseUrl: string,
  authHeaders: Record<string, string>,
): string {
  const cached = teamFieldsCache.get(teamId);
  if (cached && Date.now() - cached.timestamp < TEAM_FIELDS_CACHE_TTL_MS) {
    return cached.fieldsParam;
  }

  // Warm cache for subsequent opens; first request uses safe static fallbacks.
  void discoverAndCacheFieldsParam(teamId, baseUrl, authHeaders);
  return buildStaticJiraIssueDetailFieldsParam();
}

/** Keep only the newest comments to shrink edge→browser payloads. */
export function trimIssueComments(
  // deno-lint-ignore no-explicit-any
  issueData: any,
  maxComments = JIRA_ISSUE_DETAIL_MAX_COMMENTS,
  // deno-lint-ignore no-explicit-any
): any {
  const comments = issueData?.fields?.comment?.comments;
  if (!Array.isArray(comments) || comments.length <= maxComments) {
    return issueData;
  }

  const sorted = [...comments].sort(
    (a, b) => new Date(b?.created ?? 0).getTime() - new Date(a?.created ?? 0).getTime(),
  );
  const trimmed = sorted.slice(0, maxComments);
  const total = typeof issueData.fields.comment.total === 'number'
    ? issueData.fields.comment.total
    : comments.length;

  return {
    ...issueData,
    fields: {
      ...issueData.fields,
      comment: {
        ...issueData.fields.comment,
        comments: trimmed,
        total,
        maxResults: trimmed.length,
        startAt: 0,
      },
    },
  };
}

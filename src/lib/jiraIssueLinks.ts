/**
 * Types and normalization helpers for Jira "Linked work items" (issue links).
 *
 * Jira's `issuelinks` field is symmetric: each entry contains either an
 * `inwardIssue` (the other side of an inward relationship from current issue's
 * perspective) or an `outwardIssue` (outward side). The relationship label
 * comes from `type.inward` or `type.outward` accordingly.
 */

export type JiraIssueLinkDirection = 'inward' | 'outward';

export interface JiraIssueLinkRaw {
  id: string;
  type?: {
    id?: string;
    name?: string;
    inward?: string;
    outward?: string;
  };
  inwardIssue?: {
    key?: string;
    fields?: {
      summary?: string;
      status?: { name?: string; statusCategory?: { colorName?: string; key?: string } };
      issuetype?: { name?: string; iconUrl?: string };
      priority?: { name?: string; iconUrl?: string };
    };
  };
  outwardIssue?: {
    key?: string;
    fields?: {
      summary?: string;
      status?: { name?: string; statusCategory?: { colorName?: string; key?: string } };
      issuetype?: { name?: string; iconUrl?: string };
      priority?: { name?: string; iconUrl?: string };
    };
  };
}

export interface JiraLinkedIssueSummary {
  key: string;
  summary: string;
  status?: { name: string; statusCategory?: { colorName?: string; key?: string } };
  issuetype?: { name: string; iconUrl?: string };
  priority?: { name: string; iconUrl?: string };
}

export interface JiraIssueLinkDisplay {
  id: string;
  relationshipLabel: string;
  /** Direction relative to the *current* issue: outward means current issue is the outward side. */
  direction: JiraIssueLinkDirection;
  /** The Jira link type name (e.g. "Blocks", "Relates"); needed to recreate after delete. */
  linkTypeName: string;
  issue: JiraLinkedIssueSummary;
}

export interface JiraLinkTypeRaw {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

export interface JiraLinkTypeOption {
  /** Unique key for React lists: `${typeName}|${direction}`. */
  key: string;
  /** Jira link type name (e.g. "Blocks", "Relates"); sent back to the API. */
  typeName: string;
  /** Which side the *current* issue plays in this relationship. */
  direction: JiraIssueLinkDirection;
  /** Human-readable label such as "blocks", "is blocked by", "relates to". */
  label: string;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickIssueSummary(issue: NonNullable<JiraIssueLinkRaw['inwardIssue' | 'outwardIssue']>): JiraLinkedIssueSummary {
  const key = asString(issue.key);
  const fields = issue.fields ?? {};
  return {
    key,
    summary: asString(fields.summary),
    status: fields.status?.name
      ? {
          name: asString(fields.status.name),
          statusCategory: fields.status.statusCategory
            ? {
                colorName: fields.status.statusCategory.colorName
                  ? asString(fields.status.statusCategory.colorName)
                  : undefined,
                key: fields.status.statusCategory.key
                  ? asString(fields.status.statusCategory.key)
                  : undefined,
              }
            : undefined,
        }
      : undefined,
    issuetype: fields.issuetype?.name
      ? {
          name: asString(fields.issuetype.name),
          iconUrl: fields.issuetype.iconUrl ? asString(fields.issuetype.iconUrl) : undefined,
        }
      : undefined,
    priority: fields.priority?.name
      ? {
          name: asString(fields.priority.name),
          iconUrl: fields.priority.iconUrl ? asString(fields.priority.iconUrl) : undefined,
        }
      : undefined,
  };
}

/**
 * Convert raw Jira `issuelinks` into a display-friendly list. The relationship
 * label is always phrased from the current issue's perspective.
 *
 *   Current issue has link: { type: { inward: "is blocked by", outward: "blocks" }, outwardIssue: TARGET }
 *   → label: "blocks", direction: "outward", issue: TARGET
 *
 *   Current issue has link: { type: { ... }, inwardIssue: SOURCE }
 *   → label: "is blocked by", direction: "inward", issue: SOURCE
 */
export function normalizeIssueLinks(
  issuelinks: readonly JiraIssueLinkRaw[] | undefined | null,
): JiraIssueLinkDisplay[] {
  if (!Array.isArray(issuelinks)) return [];
  const out: JiraIssueLinkDisplay[] = [];
  for (const link of issuelinks) {
    if (!link?.id) continue;
    const typeName = asString(link.type?.name);
    if (link.outwardIssue?.key) {
      out.push({
        id: String(link.id),
        relationshipLabel: asString(link.type?.outward) || typeName || 'relates to',
        direction: 'outward',
        linkTypeName: typeName,
        issue: pickIssueSummary(link.outwardIssue),
      });
    } else if (link.inwardIssue?.key) {
      out.push({
        id: String(link.id),
        relationshipLabel: asString(link.type?.inward) || typeName || 'relates to',
        direction: 'inward',
        linkTypeName: typeName,
        issue: pickIssueSummary(link.inwardIssue),
      });
    }
  }
  return out;
}

/**
 * Expand each link type into one or two options. Symmetric types (where
 * inward === outward, e.g. "relates to") collapse to a single option.
 * Options are sorted alphabetically by label for a stable picker.
 */
export function buildLinkTypeOptions(
  linkTypes: readonly JiraLinkTypeRaw[] | undefined | null,
): JiraLinkTypeOption[] {
  if (!Array.isArray(linkTypes)) return [];
  const opts: JiraLinkTypeOption[] = [];
  for (const t of linkTypes) {
    const name = asString(t?.name);
    if (!name) continue;
    const outward = asString(t.outward);
    const inward = asString(t.inward);
    const symmetric = outward && inward && outward.trim().toLowerCase() === inward.trim().toLowerCase();
    if (outward) {
      opts.push({
        key: `${name}|outward`,
        typeName: name,
        direction: 'outward',
        label: outward,
      });
    }
    if (inward && !symmetric) {
      opts.push({
        key: `${name}|inward`,
        typeName: name,
        direction: 'inward',
        label: inward,
      });
    }
  }
  return opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

/**
 * Validate that a string looks like a Jira issue key (e.g. PROJ-123). Allows
 * `123` as a shorthand the edge function will prefix with the team's ticket prefix.
 */
export function looksLikeJiraIssueKey(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^\d+$/.test(t)) return true;
  return /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(t);
}

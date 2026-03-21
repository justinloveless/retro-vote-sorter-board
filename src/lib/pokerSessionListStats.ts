import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';

export type PokerRoundForListStats = {
  game_state: string;
  ticket_number: string | null;
  ticket_parent_key: string | null;
  ticket_parent_summary: string | null;
};

/** Rounds where the team finished pointing a real Jira story (revealed hand, non-placeholder ticket). */
export function countPointedStories(rounds: PokerRoundForListStats[]): number {
  return rounds.filter(
    (r) => r.game_state === 'Playing' && !isSyntheticRoundTicket(r.ticket_number)
  ).length;
}

export const SESSION_TOPIC_UNSCOPED_TONE_KEY = '__no_parent__';
const NO_PARENT_TOPIC_ID = SESSION_TOPIC_UNSCOPED_TONE_KEY;
const NO_PARENT_LABEL = 'various topics';

export type SessionTopicBadge = {
  label: string;
  /** Prefer Jira parent key for `parentBadgeClassName`; may be `NO_PARENT_TOPIC_ID`. */
  toneKey: string;
};

export type SessionTopicSummaryResult =
  | { kind: 'badges'; topics: SessionTopicBadge[] }
  | { kind: 'various' };

/** Maps stored tone key to the string hashed by `parentBadgeClassName` (matches Jira browser parent badges). */
export function sessionTopicBadgeToneForParentClass(toneKey: string): string {
  return toneKey === SESSION_TOPIC_UNSCOPED_TONE_KEY ? '__unscoped_stories__' : toneKey;
}

function topicIdAndLabel(r: PokerRoundForListStats): { id: string; label: string } {
  const hasParent = !!(r.ticket_parent_key?.trim() || r.ticket_parent_summary?.trim());
  if (!hasParent) {
    return { id: NO_PARENT_TOPIC_ID, label: NO_PARENT_LABEL };
  }
  const id = r.ticket_parent_key?.trim() || r.ticket_parent_summary?.trim() || '';
  const s = r.ticket_parent_summary?.trim();
  const k = r.ticket_parent_key?.trim();
  const label = (s || k || id) || 'Unknown';
  return { id: id || label, label };
}

/** Prefer parent issue key for stable colors; fall back to summary; then previous bucket tone. */
function mergeParentTone(prev: string | undefined, r: PokerRoundForListStats): string {
  const pk = r.ticket_parent_key?.trim();
  if (pk) return pk;
  if (prev && prev !== NO_PARENT_TOPIC_ID) return prev;
  const ps = r.ticket_parent_summary?.trim();
  if (ps) return ps;
  return prev ?? NO_PARENT_TOPIC_ID;
}

/**
 * Session topic summary: every round with a real Jira key (not `round:N`), including not yet pointed.
 * Ranks topics by story count; smallest top-heavy set covering ≥75% of those rounds. More than three
 * topics → `various`. Use `sessionTopicBadgeToneForParentClass` + `parentBadgeClassName` for UI.
 */
export function getSessionTopicSummary75Percent(
  rounds: PokerRoundForListStats[]
): SessionTopicSummaryResult | null {
  const withRealTicket = rounds.filter((r) => !isSyntheticRoundTicket(r.ticket_number));
  if (withRealTicket.length === 0) return null;

  const n = withRealTicket.length;
  const threshold = Math.ceil(0.75 * n);
  const counts = new Map<string, { count: number; label: string; toneKey: string }>();

  for (const r of withRealTicket) {
    const { id, label } = topicIdAndLabel(r);
    const prev = counts.get(id);
    const toneKey = mergeParentTone(prev?.toneKey, r);
    counts.set(id, {
      count: (prev?.count ?? 0) + 1,
      label,
      toneKey,
    });
  }

  const sorted = Array.from(counts.entries())
    .map(([topicId, v]) => ({ topicId, ...v }))
    .sort((a, b) => b.count - a.count);

  let cumulative = 0;
  const covered: SessionTopicBadge[] = [];
  const seen = new Set<string>();

  for (const row of sorted) {
    cumulative += row.count;
    if (!seen.has(row.topicId)) {
      seen.add(row.topicId);
      covered.push({ label: row.label, toneKey: row.toneKey });
    }
    if (cumulative >= threshold) break;
  }

  if (covered.length > 3) {
    return { kind: 'various' };
  }
  return { kind: 'badges', topics: covered };
}

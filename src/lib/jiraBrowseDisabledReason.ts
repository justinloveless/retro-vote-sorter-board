import type { TicketQueueItem } from '@/hooks/useTicketQueue';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';

export type JiraBrowseDisabledReason = 'in_queue' | 'pointing' | 'pointed';

export const JIRA_BROWSE_DISABLED_REASON_META: Record<
  JiraBrowseDisabledReason,
  { label: string; badgeVariant: 'default' | 'secondary' | 'outline' }
> = {
  in_queue: { label: 'In queue', badgeVariant: 'secondary' },
  pointing: { label: 'Pointing', badgeVariant: 'default' },
  pointed: { label: 'Pointed', badgeVariant: 'outline' },
};

/** Why a Jira row is blocked from “add to queue” (queue vs live round vs past round). */
export function getJiraBrowseDisabledReason(
  issueKey: string,
  queue: Pick<TicketQueueItem, 'ticket_key'>[],
  rounds: Pick<PokerSessionRound, 'ticket_number' | 'is_active'>[],
): JiraBrowseDisabledReason | null {
  const k = issueKey.trim();
  if (!k) return null;
  if (queue.some((q) => q.ticket_key.trim() === k)) return 'in_queue';
  const onRounds = rounds.filter((r) => (r.ticket_number?.trim() || '') === k);
  if (onRounds.length === 0) return null;
  if (onRounds.some((r) => r.is_active)) return 'pointing';
  return 'pointed';
}

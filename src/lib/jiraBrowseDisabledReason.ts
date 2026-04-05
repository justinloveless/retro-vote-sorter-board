import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';

export type JiraBrowseDisabledReason = 'pointing' | 'pointed';

export const JIRA_BROWSE_DISABLED_REASON_META: Record<
  JiraBrowseDisabledReason,
  { label: string; badgeVariant: 'default' | 'secondary' | 'outline' }
> = {
  pointing: { label: 'Pointing', badgeVariant: 'default' },
  pointed: { label: 'Pointed', badgeVariant: 'outline' },
};

/** Why a Jira row is blocked from add (active vs completed round). */
export function getJiraBrowseDisabledReason(
  issueKey: string,
  rounds: Pick<PokerSessionRound, 'ticket_number' | 'is_active' | 'is_pending_round'>[],
): JiraBrowseDisabledReason | null {
  const k = issueKey.trim();
  if (!k) return null;
  const onRounds = rounds.filter(
    (r) => (r.ticket_number?.trim() || '') === k && !r.is_pending_round,
  );
  if (onRounds.length === 0) return null;
  if (onRounds.some((r) => r.is_active)) return 'pointing';
  return 'pointed';
}

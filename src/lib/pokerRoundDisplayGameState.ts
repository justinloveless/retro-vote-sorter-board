import type { PlayerSelection, PokerSessionState, GameState } from '@/hooks/usePokerSession';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';

/**
 * Selection vs Playing for UI, matching poker table merge rules (see PokerTableProvider).
 */
export function deriveDisplayGameState(
  merged: Pick<PokerSessionState, 'game_state' | 'average_points' | 'selections'>,
  round: Pick<PokerSessionRound, 'is_active'>,
): GameState {
  const raw = merged.game_state;

  if (round.is_active) {
    return raw === 'Playing' ? 'Playing' : 'Selection';
  }

  if (raw === 'Playing') return 'Playing';

  const avg = Number(merged.average_points);
  if (!Number.isNaN(avg) && avg > 0) return 'Playing';

  const participants = Object.values(merged.selections || {}) as PlayerSelection[];
  if (participants.length > 0) {
    const allLocked = participants.every((p) => p.locked);
    const allAbstain = allLocked && participants.every((p) => p.points === -1);
    if (allAbstain) return 'Playing';
  }

  return 'Selection';
}

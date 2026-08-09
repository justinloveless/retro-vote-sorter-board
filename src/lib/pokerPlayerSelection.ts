export interface PlayerSelectionLike {
  points: number;
  locked: boolean;
  name: string;
  betweenHighPoints?: number;
}

/**
 * Default for a player on a new or reset round: abstained until they pick a value (#44).
 * Matches toggle-abstain semantics (`points: -1`, `locked: true`).
 */
export function createDefaultPlayerSelection(name: string): PlayerSelectionLike {
  return { points: -1, locked: true, name };
}

/**
 * Auto-reveal when every participant is ready, but not when the table is still
 * entirely at the default abstained state (otherwise a new round would reveal immediately).
 */
export function shouldAutoRevealSelections(selections: PlayerSelectionLike[]): boolean {
  if (selections.length === 0) return false;
  const allReady = selections.every((s) => s.locked || s.points === -1);
  if (!allReady) return false;
  return selections.some((s) => s.locked && s.points !== -1);
}

import { describe, expect, it } from 'vitest';
import {
  createDefaultPlayerSelection,
  shouldAutoRevealSelections,
  type PlayerSelectionLike,
} from './pokerPlayerSelection';

describe('createDefaultPlayerSelection', () => {
  it('starts players abstained and locked', () => {
    expect(createDefaultPlayerSelection('Alex')).toEqual({
      points: -1,
      locked: true,
      name: 'Alex',
    });
  });
});

describe('shouldAutoRevealSelections', () => {
  it('does not auto-reveal when everyone is still at the default abstained state', () => {
    const selections: PlayerSelectionLike[] = [
      { points: -1, locked: true, name: 'A' },
      { points: -1, locked: true, name: 'B' },
    ];
    expect(shouldAutoRevealSelections(selections)).toBe(false);
  });

  it('auto-reveals when everyone is ready and at least one non-abstain vote is locked', () => {
    const selections: PlayerSelectionLike[] = [
      { points: 5, locked: true, name: 'A' },
      { points: -1, locked: true, name: 'B' },
    ];
    expect(shouldAutoRevealSelections(selections)).toBe(true);
  });

  it('does not auto-reveal while someone is still unlocked on a point value', () => {
    const selections: PlayerSelectionLike[] = [
      { points: 5, locked: true, name: 'A' },
      { points: 3, locked: false, name: 'B' },
    ];
    expect(shouldAutoRevealSelections(selections)).toBe(false);
  });

  it('returns false for an empty table', () => {
    expect(shouldAutoRevealSelections([])).toBe(false);
  });
});

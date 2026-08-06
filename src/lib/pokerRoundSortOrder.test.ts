import { describe, expect, it } from 'vitest';
import {
  buildDensifiedSortOrderUpdates,
  compareRoundsBySortOrder,
  moveItemInOrder,
  roundSortKey,
} from './pokerRoundSortOrder';

describe('roundSortKey', () => {
  it('uses sort_order when present', () => {
    expect(roundSortKey({ sort_order: 2, round_number: 9 })).toBe(2);
  });

  it('falls back to round_number when sort_order is missing', () => {
    expect(roundSortKey({ round_number: 4 })).toBe(4);
    expect(roundSortKey({ sort_order: null, round_number: 4 })).toBe(4);
  });
});

describe('compareRoundsBySortOrder', () => {
  it('orders by sort_order then round_number', () => {
    const rounds = [
      { id: 'c', sort_order: 3, round_number: 1 },
      { id: 'a', sort_order: 1, round_number: 3 },
      { id: 'b', sort_order: 2, round_number: 2 },
    ];
    expect([...rounds].sort(compareRoundsBySortOrder).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to round_number for legacy rows', () => {
    const rounds = [
      { id: 'b', round_number: 2 },
      { id: 'a', round_number: 1 },
    ];
    expect([...rounds].sort(compareRoundsBySortOrder).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('buildDensifiedSortOrderUpdates', () => {
  const rounds = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('densifies to 1..n for a valid permutation', () => {
    expect(buildDensifiedSortOrderUpdates(rounds, ['c', 'a', 'b'])).toEqual([
      { id: 'c', sort_order: 1 },
      { id: 'a', sort_order: 2 },
      { id: 'b', sort_order: 3 },
    ]);
  });

  it('rejects incomplete or unknown id lists', () => {
    expect(buildDensifiedSortOrderUpdates(rounds, ['a', 'b'])).toBeNull();
    expect(buildDensifiedSortOrderUpdates(rounds, ['a', 'b', 'x'])).toBeNull();
    expect(buildDensifiedSortOrderUpdates(rounds, ['a', 'a', 'b'])).toBeNull();
    expect(buildDensifiedSortOrderUpdates(rounds, [])).toBeNull();
  });
});

describe('moveItemInOrder', () => {
  it('moves an item to a new index', () => {
    expect(moveItemInOrder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItemInOrder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns a copy when indexes are invalid or unchanged', () => {
    const items = ['a', 'b'];
    expect(moveItemInOrder(items, 0, 0)).toEqual(['a', 'b']);
    expect(moveItemInOrder(items, -1, 0)).toEqual(['a', 'b']);
    expect(moveItemInOrder(items, 0, 5)).toEqual(['a', 'b']);
  });
});

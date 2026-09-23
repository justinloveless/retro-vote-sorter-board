/** Round fields needed to order the poker round selector strip. */
export type RoundSortable = {
  sort_order?: number | null;
  round_number: number;
};

/** Prefer explicit sort_order; fall back to round_number for legacy rows. */
export function roundSortKey(round: RoundSortable): number {
  return typeof round.sort_order === 'number' ? round.sort_order : round.round_number;
}

/** True when Postgres/PostgREST rejects a query because sort_order is not on the table yet. */
export function isMissingSortOrderColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  if (!message.includes('sort_order')) return false;
  // Postgres undefined_column, or PostgREST schema-cache miss on PATCH/POST (PGRST204).
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

/** Drop sort_order so inserts/updates can proceed before the migration is applied. */
export function omitSortOrder<T extends { sort_order?: unknown }>(row: T): Omit<T, 'sort_order'> {
  const { sort_order: _ignored, ...rest } = row;
  return rest;
}

export function compareRoundsBySortOrder(a: RoundSortable, b: RoundSortable): number {
  const bySort = roundSortKey(a) - roundSortKey(b);
  if (bySort !== 0) return bySort;
  return a.round_number - b.round_number;
}

/**
 * Densify display order to 1..n for the given round id sequence.
 * Returns null when the ordered ids are empty or not a permutation of `rounds`.
 */
export function buildDensifiedSortOrderUpdates<T extends { id: string }>(
  rounds: T[],
  orderedRoundIds: string[]
): Array<{ id: string; sort_order: number }> | null {
  if (orderedRoundIds.length === 0) return null;
  if (orderedRoundIds.length !== rounds.length) return null;

  const idSet = new Set(rounds.map((r) => r.id));
  if (idSet.size !== rounds.length) return null;
  if (orderedRoundIds.some((id) => !idSet.has(id))) return null;
  if (new Set(orderedRoundIds).size !== orderedRoundIds.length) return null;

  return orderedRoundIds.map((id, index) => ({ id, sort_order: index + 1 }));
}

/** Move the item at `fromIndex` to `toIndex` (array splice semantics). */
export function moveItemInOrder<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items.slice();
  }
  const next = items.slice();
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

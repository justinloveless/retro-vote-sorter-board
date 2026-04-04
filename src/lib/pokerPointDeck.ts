/** Standard Fibonacci-style planning poker deck used across session UI and team settings. */
export const POKER_DECK_POINT_VALUES = [1, 2, 3, 5, 8, 13, 21] as const;

export type PokerDeckPoint = (typeof POKER_DECK_POINT_VALUES)[number];

/** Normalize team JSON from DB into trimmed labels keyed by numeric point (only known deck keys). */
export function pokerPointDescriptionsFromJson(
  raw: unknown,
  deck: readonly number[] = POKER_DECK_POINT_VALUES
): Record<number, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: Record<number, string> = {};
  for (const p of deck) {
    const v = obj[String(p)];
    if (typeof v === 'string' && v.trim()) out[p] = v.trim();
  }
  return out;
}

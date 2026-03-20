/**
 * Keep in sync with src/lib/pokerSessionCloneSettings.ts (Deno cannot import app src).
 * @see POKER_SESSION_NON_SETTING_KEYS in the app lib for when to add keys.
 */
export const POKER_SESSION_NON_SETTING_KEYS = new Set([
  "id",
  "room_id",
  "team_id",
  "created_at",
  "updated_at",
  "current_round_number",
  "last_activity_at",
]);

export function pokerSessionSettingsFromPreviousRow(
  previous: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!previous) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(previous)) {
    if (POKER_SESSION_NON_SETTING_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

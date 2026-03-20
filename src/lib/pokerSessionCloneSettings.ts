import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Row fields that must not be cloned onto a new poker_sessions row.
 * Anything else on the row is treated as a team-level setting (e.g. observers, toggles)
 * and is copied forward when starting a new session.
 *
 * When adding columns to poker_sessions:
 * - Identity / timestamps / per-session counters → add the key here.
 * - Team preferences → do not add here (they copy automatically).
 */
export const POKER_SESSION_NON_SETTING_KEYS = new Set([
  'id',
  'room_id',
  'team_id',
  'created_at',
  'updated_at',
  'current_round_number',
  'last_activity_at',
]);

export function pokerSessionSettingsFromPreviousRow(
  previous: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!previous) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(previous)) {
    if (POKER_SESSION_NON_SETTING_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export async function fetchLatestPokerSessionRowForTeam(
  client: SupabaseClient,
  teamId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from('poker_sessions')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** Use in URLs for /teams/:teamId/poker/:slug. Never interpolate raw `room_id` — null becomes the path segment "null". */
export function pokerSessionPathSlug(session: { room_id: string | null; id: string }): string {
  const r = session.room_id?.trim();
  return r || session.id;
}

/** True if `s` looks like a UUID (for loading a session by primary key when `room_id` is missing or the URL uses id). */
export function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

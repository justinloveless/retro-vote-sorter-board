export interface MentionTeamMember {
  id?: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
  } | null;
}

/** Prefix-match full name, name parts, or nickname (avoid mid-string hits like "c" in McIntyre). */
export const memberMatchesMentionQuery = (
  member: Pick<MentionTeamMember, 'profiles'>,
  query: string,
): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = member.profiles?.full_name?.toLowerCase().trim() || '';
  const nickname = member.profiles?.nickname?.toLowerCase().trim() || '';
  if (name.startsWith(q)) return true;
  if (name.split(/\s+/).some(part => part.startsWith(q))) return true;
  if (nickname && nickname.startsWith(q)) return true;
  return false;
};

/** Keep one row per user_id so duplicate memberships cannot flood suggestions. */
export const dedupeTeamMembersByUserId = <T extends { user_id: string }>(members: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const member of members) {
    if (!member?.user_id || seen.has(member.user_id)) continue;
    seen.add(member.user_id);
    result.push(member);
  }
  return result;
};

import { describe, expect, it } from 'vitest';
import {
  dedupeTeamMembersByUserId,
  memberMatchesMentionQuery,
} from '@/lib/mentionMatching';

const member = (full_name: string, user_id = 'u1', nickname?: string | null) => ({
  id: `m-${user_id}`,
  user_id,
  profiles: { full_name, nickname: nickname ?? null },
});

describe('memberMatchesMentionQuery', () => {
  it('matches prefix of first or last name', () => {
    const carlos = member('Carlos Sotelo');
    expect(memberMatchesMentionQuery(carlos, 'c')).toBe(true);
    expect(memberMatchesMentionQuery(carlos, 'ca')).toBe(true);
    expect(memberMatchesMentionQuery(carlos, 'sot')).toBe(true);
  });

  it('does not match mid-string letters (e.g. c in McIntyre)', () => {
    const kim = member('Kimberly McIntyre');
    expect(memberMatchesMentionQuery(kim, 'c')).toBe(false);
    expect(memberMatchesMentionQuery(kim, 'kim')).toBe(true);
    expect(memberMatchesMentionQuery(kim, 'mc')).toBe(true);
  });

  it('matches nicknames by prefix', () => {
    const tiago = member('Tiago Marto', 'u2', 'TM');
    expect(memberMatchesMentionQuery(tiago, 'tm')).toBe(true);
    expect(memberMatchesMentionQuery(tiago, 't')).toBe(true);
  });

  it('returns all members for empty query', () => {
    expect(memberMatchesMentionQuery(member('Anyone'), '')).toBe(true);
  });
});

describe('dedupeTeamMembersByUserId', () => {
  it('keeps the first row per user_id', () => {
    const list = [
      member('Kimberly McIntyre', 'kim-1'),
      member('Kimberly McIntyre', 'kim-1'),
      member('Carlos Sotelo', 'carlos-1'),
    ];
    const unique = dedupeTeamMembersByUserId(list);
    expect(unique).toHaveLength(2);
    expect(unique.map(m => m.user_id)).toEqual(['kim-1', 'carlos-1']);
  });
});

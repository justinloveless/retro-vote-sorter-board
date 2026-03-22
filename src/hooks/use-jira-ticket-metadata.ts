import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';
import { POKER_JIRA_STORY_POINTS_BROADCAST_EVENT } from '@/lib/pokerJiraStoryPointsBroadcast';

export type JiraTicketMeta = {
  issueTypeIconUrl?: string;
  storyPoints?: number | null;
  summary?: string;
};

/**
 * Fetches Jira issue metadata for all ticket keys on the session rounds plus the current display key.
 * Single shared fetch for desktop/mobile layouts and RoundSelector.
 * When `sessionId` is set, merges live story-point updates broadcast from this session (Jira submit / drawer).
 */
export function useJiraTicketMetadata(
  teamId: string | undefined,
  rounds: PokerSessionRound[],
  displayTicketNumber: string,
  sessionId?: string | null
): Record<string, JiraTicketMeta> {
  const [ticketMetaByKey, setTicketMetaByKey] = useState<Record<string, JiraTicketMeta>>({});

  const ticketKeysForFetch = useMemo(() => {
    const fromRounds = rounds
      .map((r) => r.ticket_number)
      .filter((k): k is string => !!k && !isSyntheticRoundTicket(k));
    const current = displayTicketNumber || '';
    return Array.from(
      new Set(
        [...fromRounds, current].filter((k) => k && k !== 'No ticket' && !isSyntheticRoundTicket(k))
      )
    )
      .sort()
      .join(',');
  }, [rounds, displayTicketNumber]);

  useEffect(() => {
    const keys = ticketKeysForFetch ? ticketKeysForFetch.split(',') : [];

    if (keys.length === 0) {
      if (!sessionId) setTicketMetaByKey({});
      return;
    }

    if (!teamId) {
      return;
    }

    const fetchIssueMetadata = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
          body: {
            teamId,
            includeKeys: keys,
            keysOnly: true,
          },
        });

        if (error || data?.error) {
          return;
        }

        const nextMap: Record<string, JiraTicketMeta> = {};
        for (const issue of data?.issues || []) {
          if (issue?.key) {
            nextMap[issue.key] = {
              issueTypeIconUrl: issue.issueTypeIconUrl,
              storyPoints: issue.storyPoints,
              summary: issue.summary,
            };
          }
        }
        setTicketMetaByKey(nextMap);
      } catch {
        // keep UI resilient if issue metadata is unavailable
      }
    };

    fetchIssueMetadata();
  }, [teamId, ticketKeysForFetch, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`poker_session:${sessionId}`);
    channel.on(
      'broadcast',
      { event: POKER_JIRA_STORY_POINTS_BROADCAST_EVENT },
      ({ payload }: { payload?: Record<string, unknown> }) => {
        const issueKey = payload?.issueKey;
        const points = payload?.points;
        if (typeof issueKey !== 'string' || issueKey.length === 0) return;
        if (points !== null && typeof points !== 'number') return;
        setTicketMetaByKey((prev) => ({
          ...prev,
          [issueKey]: { ...prev[issueKey], storyPoints: (points === null ? null : points) as number },
        }));
      }
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return ticketMetaByKey;
}

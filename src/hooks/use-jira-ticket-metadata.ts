import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';

export type JiraTicketMeta = {
  issueTypeIconUrl?: string;
  storyPoints?: number | null;
  summary?: string;
};

/**
 * Fetches Jira issue metadata for all ticket keys on the session rounds plus the current display key.
 * Single shared fetch for desktop/mobile layouts and RoundSelector.
 */
export function useJiraTicketMetadata(
  teamId: string | undefined,
  rounds: PokerSessionRound[],
  displayTicketNumber: string
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

    if (!teamId || keys.length === 0) {
      setTicketMetaByKey({});
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
  }, [teamId, ticketKeysForFetch]);

  return ticketMetaByKey;
}

import { supabase } from '@/integrations/supabase/client';

/** Broadcast on `poker_session:${sessionId}` so all clients refresh story-point labels without refetching Jira. */
export const POKER_JIRA_STORY_POINTS_BROADCAST_EVENT = 'jira_story_points_updated';

export async function broadcastPokerSessionJiraStoryPoints(
  sessionId: string,
  payload: { issueKey: string; points: number | null }
): Promise<void> {
  const channel = supabase.channel(`poker_session:${sessionId}`);
  try {
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          reject(new Error(`Realtime channel ${status}`));
        }
      });
    });
    await channel.send({
      type: 'broadcast',
      event: POKER_JIRA_STORY_POINTS_BROADCAST_EVENT,
      payload,
    });
  } finally {
    supabase.removeChannel(channel);
  }
}

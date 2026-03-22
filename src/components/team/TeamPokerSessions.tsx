import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Spade, Calendar, Hash, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pokerSessionPathSlug } from '@/lib/pokerSessionPathSlug';
import { useToast } from '@/hooks/use-toast';
import {
  countPointedStories,
  getSessionTopicSummary75Percent,
  sessionTopicBadgeToneForParentClass,
  SESSION_TOPIC_UNSCOPED_TONE_KEY,
  type PokerRoundForListStats,
} from '@/lib/pokerSessionListStats';
import { parentBadgeClassName } from '@/lib/parentBadgeTone';
import { cn } from '@/lib/utils';

interface PokerSessionRow {
  id: string;
  room_id: string | null;
  created_at: string;
  poker_session_rounds: Array<
    Pick<
      PokerRoundForListStats,
      'game_state' | 'ticket_number' | 'ticket_parent_key' | 'ticket_parent_summary'
    >
  > | null;
}

interface TeamPokerSessionsProps {
  teamId: string;
  onCreateSession: () => void;
  /** Team owner or admin — can delete sessions from the team list */
  canDeleteSessions?: boolean;
}

export const TeamPokerSessions: React.FC<TeamPokerSessionsProps> = ({
  teamId,
  onCreateSession,
  canDeleteSessions = false,
}) => {
  const [sessions, setSessions] = useState<PokerSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionPendingDelete, setSessionPendingDelete] = useState<PokerSessionRow | null>(null);
  /** Session ids removed optimistically until the delete request finishes (refetch must ignore these rows). */
  const optimisticPendingDeleteIds = useRef(new Set<string>());
  const navigate = useNavigate();
  const { toast } = useToast();

  const mergeSessionsSorted = (prev: PokerSessionRow[], row: PokerSessionRow) => {
    if (prev.some((s) => s.id === row.id)) return prev;
    return [...prev, row].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const roundRowsOrCount = (session: PokerSessionRow) => {
    const embedded = session.poker_session_rounds;
    if (!embedded?.length) return { total: 0, rows: [] as PokerRoundForListStats[] };
    return { total: embedded.length, rows: embedded as PokerRoundForListStats[] };
  };

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('poker_sessions')
        .select(
          `id, room_id, created_at,
           poker_session_rounds(
             game_state,
             ticket_number,
             ticket_parent_key,
             ticket_parent_summary
           )`
        )
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const pending = optimisticPendingDeleteIds.current;
        setSessions(
          pending.size === 0 ? data : data.filter((s) => !pending.has(s.id))
        );
      }
      setLoading(false);
    };

    fetchSessions();

    const channelSessions = supabase
      .channel(`team-poker-sessions-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'poker_sessions',
        filter: `team_id=eq.${teamId}`,
      }, () => {
        void fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelSessions);
    };
  }, [teamId]);

  /** Refetch when any round row for this team's sessions changes (insert/update/delete). */
  const sessionIdsKey = sessions
    .map((s) => s.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!sessionIdsKey) return;

    const fetchSessions = async () => {
      const { data, error } = await supabase
        .from('poker_sessions')
        .select(
          `id, room_id, created_at,
           poker_session_rounds(
             game_state,
             ticket_number,
             ticket_parent_key,
             ticket_parent_summary
           )`
        )
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const pending = optimisticPendingDeleteIds.current;
        setSessions(
          pending.size === 0 ? data : data.filter((s) => !pending.has(s.id))
        );
      }
    };

    const ids = sessionIdsKey.split(',');
    const filter =
      ids.length === 1
        ? `session_id=eq.${ids[0]}`
        : `session_id=in.(${ids.join(',')})`;

    const channelRounds = supabase
      .channel(`team-poker-rounds-${teamId}-${sessionIdsKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_session_rounds',
          filter,
        },
        () => {
          void fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelRounds);
    };
  }, [teamId, sessionIdsKey]);

  const confirmDeleteSession = async () => {
    const session = sessionPendingDelete;
    if (!session) return;
    const { id } = session;

    setSessionPendingDelete(null);
    optimisticPendingDeleteIds.current.add(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));

    const { error } = await supabase.from('poker_sessions').delete().eq('id', id);
    optimisticPendingDeleteIds.current.delete(id);

    if (error) {
      setSessions((prev) => mergeSessionsSorted(prev, session));
      toast({
        title: 'Could not delete session',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Poker session deleted' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Spade className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-semibold">No poker sessions yet</h3>
          <p className="text-muted-foreground mt-1">
            Start a new poker session to begin pointing stories with your team.
          </p>
        </div>
        <Button onClick={onCreateSession}>
          <Plus className="h-4 w-4 mr-2" />
          New Poker Session
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {sessions.map((session) => {
          const { total: roundCount, rows: roundRows } = roundRowsOrCount(session);
          const pointedCount = countPointedStories(roundRows);
          const topicSummary = getSessionTopicSummary75Percent(roundRows);
          return (
          <Card
            key={session.id}
            className="cursor-pointer hover:shadow-md transition-shadow border-border"
            onClick={() => navigate(`/teams/${teamId}/poker/${pokerSessionPathSlug(session)}`)}
          >
            <CardContent className="p-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Spade className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {format(new Date(session.created_at), 'MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <Hash className="h-3 w-3 shrink-0" />
                    {pointedCount}/{roundCount} {roundCount === 1 ? 'story' : 'stories'} pointed
                    <span className="mx-1">·</span>
                    Started {format(new Date(session.created_at), 'h:mm a')}
                  </div>
                  {topicSummary && (
                    <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap min-w-0">
                      {topicSummary.kind === 'various' ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs px-2 py-0.5 font-medium border min-w-0 max-w-[14rem] truncate',
                            parentBadgeClassName('__various_topics__'),
                          )}
                        >
                          various topics
                        </Badge>
                      ) : (
                        topicSummary.topics.map((t) => (
                          <Badge
                            key={`${t.toneKey}-${t.label}`}
                            variant="outline"
                            title={
                              t.toneKey !== SESSION_TOPIC_UNSCOPED_TONE_KEY ? t.toneKey : undefined
                            }
                            className={cn(
                              'text-xs px-2 py-0.5 font-medium border min-w-0 max-w-[14rem] truncate',
                              parentBadgeClassName(sessionTopicBadgeToneForParentClass(t.toneKey)),
                            )}
                          >
                            {t.label}
                          </Badge>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {canDeleteSessions && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Delete poker session"
                    onClick={() => setSessionPendingDelete(session)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950"
                  onClick={() =>
                    navigate(`/teams/${teamId}/poker/${pokerSessionPathSlug(session)}`)
                  }
                >
                  Join
                </Button>
              </div>
            </CardContent>
          </Card>
        );
        })}
      </div>

      <AlertDialog open={!!sessionPendingDelete} onOpenChange={(open) => !open && setSessionPendingDelete(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this poker session?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the whole session, including all rounds and chat history. Anyone currently in the room will lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteSession();
              }}
            >
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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

interface PokerSessionRow {
  id: string;
  room_id: string | null;
  created_at: string;
  current_round_number: number;
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

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('poker_sessions')
        .select('id, room_id, created_at, current_round_number')
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

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`team-poker-sessions-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'poker_sessions',
        filter: `team_id=eq.${teamId}`,
      }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

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
        {sessions.map((session) => (
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
                    {session.current_round_number} round{session.current_round_number !== 1 ? 's' : ''}
                    <span className="mx-1">·</span>
                    Started {format(new Date(session.created_at), 'h:mm a')}
                  </div>
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
        ))}
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

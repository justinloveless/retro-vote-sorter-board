import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Spade, Calendar, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PokerSessionRow {
  id: string;
  room_id: string;
  created_at: string;
  current_round_number: number;
}

interface TeamPokerSessionsProps {
  teamId: string;
  onCreateSession: () => void;
}

export const TeamPokerSessions: React.FC<TeamPokerSessionsProps> = ({ teamId, onCreateSession }) => {
  const [sessions, setSessions] = useState<PokerSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('poker_sessions')
        .select('id, room_id, created_at, current_round_number')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSessions(data);
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
    <div className="space-y-3">
      {sessions.map((session) => (
        <Card
          key={session.id}
          className="cursor-pointer hover:shadow-md transition-shadow border-border"
          onClick={() => navigate(`/teams/${teamId}/poker/${session.room_id}`)}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Spade className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(new Date(session.created_at), 'MMMM d, yyyy')}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  {session.current_round_number} round{session.current_round_number !== 1 ? 's' : ''}
                  <span className="mx-1">·</span>
                  Started {format(new Date(session.created_at), 'h:mm a')}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950">
              Join
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

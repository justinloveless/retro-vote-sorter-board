import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type RecentActivityRow = {
  entity_id: string;
  entity_type: 'team' | 'board' | 'poker_session';
  last_accessed_at: string;
};

export type RecentTeamItem = {
  id: string;
  name: string;
  createdAt: string;
  lastAccessedAt: string;
};

export type RecentBoardItem = {
  id: string;
  title: string;
  roomId: string;
  teamId: string | null;
  teamName: string;
  createdAt: string | null;
  lastAccessedAt: string;
};

export type RecentPokerSessionItem = {
  id: string;
  roomId: string | null;
  teamId: string | null;
  teamName: string;
  createdAt: string;
  roundStats: Array<{
    game_state: string;
    ticket_number: string | null;
    ticket_parent_key: string | null;
    ticket_parent_summary: string | null;
  }> | null;
  lastAccessedAt: string;
};

export const useRecentActivity = (limitPerSection = 5) => {
  const { profile } = useAuth();
  const [recentTeams, setRecentTeams] = useState<RecentTeamItem[]>([]);
  const [recentBoards, setRecentBoards] = useState<RecentBoardItem[]>([]);
  const [recentPokerSessions, setRecentPokerSessions] = useState<RecentPokerSessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) {
        setRecentTeams([]);
        setRecentBoards([]);
        setRecentPokerSessions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: recentRows, error: recentError } = await supabase
        .from('user_recent_activity')
        .select('entity_id, entity_type, last_accessed_at')
        .eq('user_id', profile.id)
        .order('last_accessed_at', { ascending: false })
        .limit(Math.max(limitPerSection * 6, 30));

      if (recentError) {
        console.error('Failed to load recent activity:', recentError);
        setRecentTeams([]);
        setRecentBoards([]);
        setRecentPokerSessions([]);
        setLoading(false);
        return;
      }

      const rows = (recentRows ?? []) as RecentActivityRow[];
      const recentTeamRows = rows.filter((row) => row.entity_type === 'team');
      const recentBoardRows = rows.filter((row) => row.entity_type === 'board');
      const recentPokerRows = rows.filter((row) => row.entity_type === 'poker_session');

      const teamIds = [...new Set(recentTeamRows.map((row) => row.entity_id))];
      const boardIds = [...new Set(recentBoardRows.map((row) => row.entity_id))];
      const pokerIds = [...new Set(recentPokerRows.map((row) => row.entity_id))];

      const [teamsRes, boardsRes, pokerRes] = await Promise.all([
        teamIds.length
          ? supabase.from('teams').select('id, name, created_at').in('id', teamIds)
          : Promise.resolve({ data: [], error: null }),
        boardIds.length
          ? supabase
              .from('retro_boards')
              .select('id, title, room_id, team_id, created_at')
              .in('id', boardIds)
          : Promise.resolve({ data: [], error: null }),
        pokerIds.length
          ? supabase
              .from('poker_sessions')
              .select(
                `id, room_id, team_id, created_at,
                 poker_session_rounds(
                   game_state,
                   ticket_number,
                   ticket_parent_key,
                   ticket_parent_summary
                 )`
              )
              .in('id', pokerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (teamsRes.error || boardsRes.error || pokerRes.error) {
        console.error('Failed to resolve recent activity metadata:', teamsRes.error || boardsRes.error || pokerRes.error);
        setRecentTeams([]);
        setRecentBoards([]);
        setRecentPokerSessions([]);
        setLoading(false);
        return;
      }

      const teamsById = new Map((teamsRes.data ?? []).map((team) => [team.id, team]));
      const boardsById = new Map((boardsRes.data ?? []).map((board) => [board.id, board]));
      const pokerById = new Map((pokerRes.data ?? []).map((session) => [session.id, session]));

      const relatedTeamIds = [
        ...new Set([
          ...(boardsRes.data ?? []).map((board) => board.team_id).filter(Boolean),
          ...(pokerRes.data ?? []).map((session) => session.team_id).filter(Boolean),
        ]),
      ] as string[];

      const relatedTeamsRes = relatedTeamIds.length
        ? await supabase.from('teams').select('id, name').in('id', relatedTeamIds)
        : { data: [], error: null };

      const relatedTeamNameById = new Map((relatedTeamsRes.data ?? []).map((team) => [team.id, team.name]));

      const teams = recentTeamRows
        .map((row) => {
          const team = teamsById.get(row.entity_id);
          if (!team) return null;
          return {
            id: team.id,
            name: team.name,
            createdAt: team.created_at,
            lastAccessedAt: row.last_accessed_at,
          };
        })
        .filter(Boolean) as RecentTeamItem[];

      const boards = recentBoardRows
        .map((row) => {
          const board = boardsById.get(row.entity_id);
          if (!board) return null;
          return {
            id: board.id,
            title: board.title ?? 'Untitled board',
            roomId: board.room_id,
            teamId: board.team_id,
            teamName: board.team_id ? relatedTeamNameById.get(board.team_id) ?? 'Unknown team' : 'Personal',
            createdAt: board.created_at,
            lastAccessedAt: row.last_accessed_at,
          };
        })
        .filter(Boolean) as RecentBoardItem[];

      const pokerSessions = recentPokerRows
        .map((row) => {
          const session = pokerById.get(row.entity_id);
          if (!session) return null;
          return {
            id: session.id,
            roomId: session.room_id,
            teamId: session.team_id,
            teamName: session.team_id ? relatedTeamNameById.get(session.team_id) ?? 'Unknown team' : 'Personal',
            createdAt: session.created_at,
            roundStats: session.poker_session_rounds,
            lastAccessedAt: row.last_accessed_at,
          };
        })
        .filter(Boolean) as RecentPokerSessionItem[];

      setRecentTeams(teams.slice(0, limitPerSection));
      setRecentBoards(boards.slice(0, limitPerSection));
      setRecentPokerSessions(pokerSessions.slice(0, limitPerSection));
      setLoading(false);
    };

    load();
  }, [profile?.id, limitPerSection]);

  return { recentTeams, recentBoards, recentPokerSessions, loading };
};

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchTeamInvitations as dcFetchTeamInvitations, fetchCommentsForItem as dcFetchCommentsForItem } from '@/lib/dataClient';

// Types
interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  invite_type: 'email' | 'link';
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

interface TeamBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash: string | null;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamActionItem {
  id: string;
  text: string;
  assigned_to: string | null;
  done: boolean;
  created_at: string;
  source_board_id: string | null;
  source_item_id: string | null;
  board_title?: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
  team_members: Array<{ role: string }>;
}

// Cache interfaces
interface CachedData<T> {
  data: T;
  timestamp: number;
  loading: boolean;
  fetched: boolean; // Track if data has been fetched at least once
}

interface TeamActionItemComment {
  id: string;
  item_id: string;
  text: string;
  author: string;
  author_id: string | null;
  created_at: string;
  profiles?: {
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

interface TeamDataCache {
  members: CachedData<TeamMember[]>;
  invitations: CachedData<TeamInvitation[]>;
  boards: CachedData<TeamBoard[]>;
  actionItems: CachedData<TeamActionItem[]>;
  teamInfo: CachedData<Team | null>;
  actionItemComments: CachedData<Record<string, TeamActionItemComment[]>>; // keyed by item_id
}

interface TeamDataContextType {
  // Cached data getters
  getMembers: (teamId: string) => { data: TeamMember[], loading: boolean, refetch: () => Promise<void> };
  getInvitations: (teamId: string) => { data: TeamInvitation[], loading: boolean, refetch: () => Promise<void> };
  getBoards: (teamId: string) => { data: TeamBoard[], loading: boolean, refetch: () => Promise<void> };
  getActionItems: (teamId: string) => { data: TeamActionItem[], loading: boolean, refetch: () => Promise<void> };
  getTeamInfo: (teamId: string) => { data: Team | null, loading: boolean, refetch: () => Promise<void> };
  getActionItemComments: (teamId: string, itemId: string) => { data: TeamActionItemComment[], loading: boolean, refetch: () => Promise<void> };

  // Cache management
  invalidateTeamCache: (teamId: string) => void;
  invalidateAllCache: () => void;
}

const TeamDataContext = createContext<TeamDataContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const isDataStale = (timestamp: number) => Date.now() - timestamp > CACHE_DURATION;

export const TeamDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [cache, setCache] = useState<Record<string, TeamDataCache>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  const initializeTeamCache = useCallback((teamId: string): TeamDataCache => ({
    members: { data: [], timestamp: 0, loading: true, fetched: false },
    invitations: { data: [], timestamp: 0, loading: true, fetched: false },
    boards: { data: [], timestamp: 0, loading: true, fetched: false },
    actionItems: { data: [], timestamp: 0, loading: true, fetched: false },
    teamInfo: { data: null, timestamp: 0, loading: true, fetched: false },
    actionItemComments: { data: {}, timestamp: 0, loading: true, fetched: false },
  }), []);

  const getTeamCache = useCallback((teamId: string) => {
    if (!cache[teamId]) {
      const newCache = initializeTeamCache(teamId);
      // Initialize cache asynchronously to avoid state update during render
      setTimeout(() => {
        setCache(prev => {
          // Only update if cache doesn't exist to avoid overwriting updates
          if (!prev[teamId]) {
            return {
              ...prev,
              [teamId]: newCache
            };
          }
          return prev;
        });
      }, 0);
      // Return temporary cache structure for immediate use
      return newCache;
    }
    return cache[teamId];
  }, [cache, initializeTeamCache]);

  const updateCache = useCallback((teamId: string, key: keyof TeamDataCache, data: any, loading: boolean = false) => {
    setCache(prev => ({
      ...prev,
      [teamId]: {
        ...(prev[teamId] || initializeTeamCache(teamId)), // Fallback to initialized cache if doesn't exist
        [key]: {
          data,
          timestamp: Date.now(),
          loading,
          fetched: !loading // Mark as fetched when not loading (i.e., when data is set)
        }
      }
    }));
  }, [initializeTeamCache]);

  // Fetch functions
  const fetchMembers = useCallback(async (teamId: string) => {
    try {
      updateCache(teamId, 'members', [], true);

      // First get team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      // Then get profiles for those users
      const userIds = membersData?.map(member => member.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const typedMembers = (membersData || []).map(member => ({
        ...member,
        role: member.role as 'owner' | 'admin' | 'member',
        profiles: profilesData?.find(profile => profile.id === member.user_id) || null
      }));

      updateCache(teamId, 'members', typedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      updateCache(teamId, 'members', []);
    }
  }, [updateCache]);

  const fetchInvitations = useCallback(async (teamId: string) => {
    try {
      updateCache(teamId, 'invitations', [], true);

      const data = await dcFetchTeamInvitations(teamId, 'email', 'pending');

      updateCache(teamId, 'invitations', data);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      updateCache(teamId, 'invitations', []);
    }
  }, [updateCache]);

  const fetchBoards = useCallback(async (teamId: string) => {
    try {
      updateCache(teamId, 'boards', [], true);

      const { data, error } = await supabase
        .from('retro_boards')
        .select('*')
        .eq('team_id', teamId)
        .neq('deleted', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      updateCache(teamId, 'boards', data || []);
    } catch (error) {
      console.error('Error fetching boards:', error);
      updateCache(teamId, 'boards', []);
    }
  }, [updateCache]);

  const fetchActionItems = useCallback(async (teamId: string) => {
    try {
      updateCache(teamId, 'actionItems', [], true);

      const { data } = await supabase
        .from('team_action_items')
        .select('id, text, assigned_to, done, created_at, source_board_id, source_item_id')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      const base = (data || []) as TeamActionItem[];
      const boardIds = Array.from(new Set(base.map(i => i.source_board_id).filter(Boolean))) as string[];
      let titleMap: Record<string, string> = {};

      if (boardIds.length > 0) {
        const { data: boards } = await supabase
          .from('retro_boards')
          .select('id, title')
          .in('id', boardIds);
        (boards || []).forEach(b => { titleMap[b.id] = b.title; });
      }

      const itemsWithTitles = base.map(i => ({
        ...i,
        board_title: i.source_board_id ? (titleMap[i.source_board_id] || 'Board') : 'Other'
      }));

      updateCache(teamId, 'actionItems', itemsWithTitles);
    } catch (error) {
      console.error('Error fetching action items:', error);
      updateCache(teamId, 'actionItems', []);
    }
  }, [updateCache]);

  const fetchTeamInfo = useCallback(async (teamId: string) => {
    if (!profile) return; // This should not happen now due to profile check in getTeamInfo

    try {
      updateCache(teamId, 'teamInfo', null, true);

      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_members!inner(role)
        `)
        .eq('id', teamId)
        .eq('team_members.user_id', profile.id)
        .single();

      if (error) throw error;
      updateCache(teamId, 'teamInfo', data);
    } catch (error) {
      console.error('Error fetching team info:', error);
      updateCache(teamId, 'teamInfo', null);
    }
  }, [updateCache, profile]);

  const fetchActionItemComments = useCallback(async (teamId: string, itemId: string) => {
    try {
      // Get current comments data and mark this specific item as loading
      const teamCache = getTeamCache(teamId);
      const currentComments = teamCache.actionItemComments.data;
      const updatedComments = {
        ...currentComments,
        [itemId]: [] // Clear existing comments for this item
      };
      updateCache(teamId, 'actionItemComments', updatedComments, true);

      const data = await dcFetchCommentsForItem(itemId);

      const typedComments = (data || []).map(comment => ({
        ...comment,
        profiles: comment.profiles || null
      })) as TeamActionItemComment[];

      // Update cache with the fetched comments
      const finalComments = {
        ...currentComments,
        [itemId]: typedComments
      };
      updateCache(teamId, 'actionItemComments', finalComments);
    } catch (error) {
      console.error('Error fetching action item comments:', error);
      // On error, still update cache to mark as fetched (empty array)
      const teamCache = getTeamCache(teamId);
      const currentComments = teamCache.actionItemComments.data;
      const errorComments = {
        ...currentComments,
        [itemId]: []
      };
      updateCache(teamId, 'actionItemComments', errorComments);
    }
  }, [updateCache, getTeamCache]);

  // Public API
  const getMembers = useCallback((teamId: string) => {
    const teamCache = getTeamCache(teamId);
    const cached = teamCache.members;

    const refetch = async () => {
      await fetchMembers(teamId);
    };

    if (!cached.fetched || isDataStale(cached.timestamp)) {
      const fetchKey = `${teamId}-members`;
      if (!fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        // Trigger fetch asynchronously to avoid state update during render
        setTimeout(() => {
          fetchMembers(teamId).finally(() => {
            fetchingRef.current.delete(fetchKey);
          });
        }, 0);
      }
    }

    return {
      data: cached.data,
      loading: cached.loading,
      refetch
    };
  }, [getTeamCache, fetchMembers]);

  const getInvitations = useCallback((teamId: string) => {
    const teamCache = getTeamCache(teamId);
    const cached = teamCache.invitations;

    const refetch = async () => {
      await fetchInvitations(teamId);
    };

    if (!cached.fetched || isDataStale(cached.timestamp)) {
      const fetchKey = `${teamId}-invitations`;
      if (!fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        // Trigger fetch asynchronously to avoid state update during render
        setTimeout(() => {
          fetchInvitations(teamId).finally(() => {
            fetchingRef.current.delete(fetchKey);
          });
        }, 0);
      }
    }

    return {
      data: cached.data,
      loading: cached.loading,
      refetch
    };
  }, [getTeamCache, fetchInvitations]);

  const getBoards = useCallback((teamId: string) => {
    const teamCache = getTeamCache(teamId);
    const cached = teamCache.boards;

    const refetch = async () => {
      await fetchBoards(teamId);
    };

    if (!cached.fetched || isDataStale(cached.timestamp)) {
      const fetchKey = `${teamId}-boards`;
      if (!fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        // Trigger fetch asynchronously to avoid state update during render
        setTimeout(() => {
          fetchBoards(teamId).finally(() => {
            fetchingRef.current.delete(fetchKey);
          });
        }, 0);
      }
    }

    return {
      data: cached.data,
      loading: cached.loading,
      refetch
    };
  }, [getTeamCache, fetchBoards]);

  const getActionItems = useCallback((teamId: string) => {
    const teamCache = getTeamCache(teamId);
    const cached = teamCache.actionItems;

    const refetch = async () => {
      await fetchActionItems(teamId);
    };

    if (!cached.fetched || isDataStale(cached.timestamp)) {
      const fetchKey = `${teamId}-actionItems`;
      if (!fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        // Trigger fetch asynchronously to avoid state update during render
        setTimeout(() => {
          fetchActionItems(teamId).finally(() => {
            fetchingRef.current.delete(fetchKey);
          });
        }, 0);
      }
    }

    return {
      data: cached.data,
      loading: cached.loading,
      refetch
    };
  }, [getTeamCache, fetchActionItems]);

  const getTeamInfo = useCallback((teamId: string) => {
    const teamCache = getTeamCache(teamId);
    const cached = teamCache.teamInfo;

    const refetch = async () => {
      await fetchTeamInfo(teamId);
    };

    // Only attempt to fetch if profile is available
    if (profile && (!cached.fetched || isDataStale(cached.timestamp))) {
      const fetchKey = `${teamId}-teamInfo`;
      if (!fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        // Trigger fetch asynchronously to avoid state update during render
        setTimeout(() => {
          fetchTeamInfo(teamId).finally(() => {
            fetchingRef.current.delete(fetchKey);
          });
        }, 0);
      }
    }

    // If profile isn't available yet, keep loading state
    const actualLoading = !profile || cached.loading;

    return {
      data: cached.data,
      loading: actualLoading,
      refetch
    };
  }, [getTeamCache, fetchTeamInfo, profile]);

  const getActionItemComments = useCallback((teamId: string, itemId: string) => {
    const teamCache = getTeamCache(teamId);
    const cached = teamCache.actionItemComments;
    const itemComments = cached.data[itemId] || [];
    const itemFetched = cached.fetched && cached.data.hasOwnProperty(itemId);

    const refetch = async () => {
      await fetchActionItemComments(teamId, itemId);
    };

    if (!itemFetched || isDataStale(cached.timestamp)) {
      const fetchKey = `${teamId}-comments-${itemId}`;
      if (!fetchingRef.current.has(fetchKey)) {
        fetchingRef.current.add(fetchKey);
        // Trigger fetch asynchronously to avoid state update during render
        setTimeout(() => {
          fetchActionItemComments(teamId, itemId).finally(() => {
            fetchingRef.current.delete(fetchKey);
          });
        }, 0);
      }
    }

    return {
      data: itemComments,
      loading: cached.loading,
      refetch
    };
  }, [getTeamCache, fetchActionItemComments]);

  const invalidateTeamCache = useCallback((teamId: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[teamId];
      return newCache;
    });
  }, []);

  const invalidateAllCache = useCallback(() => {
    setCache({});
  }, []);

  const value = useMemo(() => ({
    getMembers,
    getInvitations,
    getBoards,
    getActionItems,
    getTeamInfo,
    getActionItemComments,
    invalidateTeamCache,
    invalidateAllCache,
  }), [getMembers, getInvitations, getBoards, getActionItems, getTeamInfo, getActionItemComments, invalidateTeamCache, invalidateAllCache]);

  return (
    <TeamDataContext.Provider value={value}>
      {children}
    </TeamDataContext.Provider>
  );
};

export const useTeamData = () => {
  const context = useContext(TeamDataContext);
  if (context === undefined) {
    throw new Error('useTeamData must be used within a TeamDataProvider');
  }
  return context;
};

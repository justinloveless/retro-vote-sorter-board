import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RetroStage } from './useRetroBoard';

interface ReadinessSummary {
  total_users: number;
  ready_users: number;
  all_ready: boolean;
  ready_percentage: number;
}

interface UserReadinessData {
  id: string;
  user_id: string | null;
  session_id: string | null;
  is_ready: boolean;
  user_name?: string;
  avatar_url?: string;
}

export const useUserReadiness = (
  boardId: string, 
  currentStage: RetroStage | null,
  activeUsers: Array<{
    id?: string;
    user_id?: string;
    user_name: string;
    avatar_url?: string;
    last_seen: string;
  }> = [],
  broadcastReadinessChange?: (readinessData: {
    boardId: string;
    stage: string;
    userId: string;  // Now always present (auth user ID or session ID)
    sessionId?: string;  // Kept for backward compatibility but not used
    isReady: boolean;
    userName?: string;
  }) => Promise<void>
) => {
  const [isCurrentUserReady, setIsCurrentUserReady] = useState(false);
  const [readinessSummary, setReadinessSummary] = useState<ReadinessSummary>({
    total_users: 0,
    ready_users: 0,
    all_ready: false,
    ready_percentage: 0,
  });
  const [readyUsers, setReadyUsers] = useState<UserReadinessData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Get session ID for anonymous users
  const sessionId = localStorage.getItem('retroSessionId');
  
  // Track readiness state in memory (synced via broadcasts between users)
  const [readinessMap, setReadinessMap] = useState<Map<string, { isReady: boolean; userName: string }>>(new Map());

  // Get current user ID
  const getCurrentUserId = useCallback(async () => {
    const currentUser = (await supabase.auth.getUser()).data.user;
    return currentUser?.id || sessionId;
  }, [sessionId]);

  // Calculate readiness summary from activeUsers and readinessMap
  const calculateReadinessSummary = useCallback(() => {
    const totalActiveUsers = activeUsers.length;
    let readyCount = 0;
    const readyUsersList: UserReadinessData[] = [];

    console.log('🧮 Calculating readiness summary...', {
      totalActiveUsers,
      readinessMapSize: readinessMap.size,
      readinessEntries: Array.from(readinessMap.entries())
    });

    activeUsers.forEach(user => {
      const userKey = user.user_id || user.id;
      const readinessData = readinessMap.get(userKey || '');
      
      console.log(`👤 User ${user.user_name} (${userKey}):`, {
        hasReadinessData: !!readinessData,
        isReady: readinessData?.isReady || false,
        userStructure: { user_id: user.user_id, id: user.id }
      });
      
      if (readinessData?.isReady) {
        readyCount++;
        readyUsersList.push({
          id: userKey || '',
          user_id: user.user_id || null,
          session_id: user.id || null,
          is_ready: true,
          user_name: user.user_name,
          avatar_url: user.avatar_url,
        });
      }
    });

    const readyPercentage = totalActiveUsers > 0 ? Math.round((readyCount / totalActiveUsers) * 100) : 0;
    const allReady = totalActiveUsers > 0 && readyCount === totalActiveUsers;

    const newSummary = {
      total_users: totalActiveUsers,
      ready_users: readyCount,
      all_ready: allReady,
      ready_percentage: readyPercentage,
    };

    setReadyUsers(readyUsersList);
    setReadinessSummary(newSummary);
    
    console.log('✅ Readiness summary calculated:', {
      totalActiveUsers,
      readyCount,
      allReady,
      readyPercentage,
      readyUserNames: readyUsersList.map(u => u.user_name)
    });
  }, [activeUsers, readinessMap]);

  // Toggle readiness for current user
  const toggleReadiness = useCallback(async () => {
    if (!boardId || !currentStage || !broadcastReadinessChange) return;

    try {
      const userId = await getCurrentUserId();
      const newReadyState = !isCurrentUserReady;
      const currentUser = (await supabase.auth.getUser()).data.user;
      const currentUserName = activeUsers.find(u => (u.user_id || u.id) === userId)?.user_name || 'Unknown';

      console.log('🔄 Toggling readiness:', {
        boardId,
        currentStage,
        userId,
        fromReady: isCurrentUserReady,
        toReady: newReadyState,
        userName: currentUserName
      });

      // Update database for persistence
      const upsertData: any = {
        board_id: boardId,
        current_stage: currentStage,
        is_ready: newReadyState,
        updated_at: new Date().toISOString(),
      };

      if (currentUser) {
        upsertData.user_id = currentUser.id;
        upsertData.session_id = null;
      } else {
        upsertData.user_id = null;
        upsertData.session_id = sessionId;
      }

      const { error } = await supabase
        .from('retro_user_readiness')
        .upsert(upsertData, {
          onConflict: currentUser ? 'board_id,user_id,current_stage' : 'board_id,session_id,current_stage'
        });

      if (error) {
        console.error('❌ Database upsert error:', error);
        // Don't throw error - continue with broadcast even if DB fails
      } else {
        console.log('✅ Database updated successfully');
      }

      // Broadcast the change to all users
      // Use the same key format as presence system for consistency
      const broadcastUserId = currentUser?.id || sessionId;
      await broadcastReadinessChange({
        boardId,
        stage: currentStage,
        userId: broadcastUserId,  // Always send as userId for consistency
        sessionId: undefined,     // Not needed - userId handles both cases
        isReady: newReadyState,
        userName: currentUserName
      });

      // Optimistic updates for current user
      setIsCurrentUserReady(newReadyState);
      
      // Also optimistically update the readiness map so tooltip shows immediate change
      setReadinessMap(prev => {
        const newMap = new Map(prev);
        newMap.set(broadcastUserId, {
          isReady: newReadyState,
          userName: currentUserName
        });
        console.log('🚀 Optimistic readiness update:', {
          userId: broadcastUserId,
          isReady: newReadyState,
          userName: currentUserName
        });
        return newMap;
      });

      toast({
        title: newReadyState ? "Marked as ready" : "Marked as not ready",
        description: newReadyState 
          ? "You're ready to move to the next stage" 
          : "You're not ready to move to the next stage",
      });

    } catch (error) {
      console.error('❌ Error toggling readiness:', error);
      toast({
        title: "Error updating readiness",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }, [boardId, currentStage, isCurrentUserReady, broadcastReadinessChange, getCurrentUserId, activeUsers, sessionId, toast]);

  // Listen for readiness change broadcasts
  useEffect(() => {
    if (!boardId || !currentStage) return;

    console.log('🔧 Setting up readiness broadcast listener:', {
      boardId,
      currentStage
    });

    const handleReadinessChange = (event: CustomEvent) => {
      const readinessData = event.detail;
      
      console.log('📡 [Broadcast] Readiness change received:', readinessData);

      // Only handle changes for our current board and stage
      if (readinessData.boardId !== boardId || readinessData.stage !== currentStage) {
        console.log('⏭️ Ignoring readiness change for different board/stage');
        return;
      }

      // Check if this is a stage reset broadcast
      if (readinessData.userName === 'STAGE_RESET') {
        console.log('🔄 Stage reset broadcast received - clearing all readiness');
        setReadinessMap(new Map());
        setIsCurrentUserReady(false);
        setReadyUsers([]);
        setReadinessSummary({
          total_users: activeUsers.length,
          ready_users: 0,
          all_ready: false,
          ready_percentage: 0,
        });
        return;
      }

      // Update readiness map for individual user changes
      const userKey = readinessData.userId;
      if (userKey) {
        console.log('📋 Updating readiness for user:', userKey, 'to ready:', readinessData.isReady);
        
        setReadinessMap(prev => {
          const newMap = new Map(prev);
          newMap.set(userKey, {
            isReady: readinessData.isReady,
            userName: readinessData.userName || 'Unknown'
          });
          console.log('📋 Updated readiness map:', Array.from(newMap.entries()));
          return newMap;
        });

        // Check if this change affects the current user
        getCurrentUserId().then(currentUserId => {
          console.log('🔍 Checking if change affects current user:', {
            broadcastUserKey: userKey,
            currentUserId,
            matches: userKey === currentUserId
          });
          
          if (userKey === currentUserId) {
            console.log('✅ Updating current user ready state:', readinessData.isReady);
            setIsCurrentUserReady(readinessData.isReady);
          }
        });
      }
    };

    // Listen for readiness changes
    window.addEventListener('readiness-change', handleReadinessChange as EventListener);

    return () => {
      console.log('🔌 Cleaning up readiness broadcast listener');
      window.removeEventListener('readiness-change', handleReadinessChange as EventListener);
    };
  }, [boardId, currentStage, getCurrentUserId, activeUsers]);

  // Load initial readiness data from database
  useEffect(() => {
    if (!boardId || !currentStage) return;

    const loadInitialReadiness = async () => {
      try {
        console.log('📥 Loading initial readiness data from database...', {
          boardId,
          currentStage
        });

        // Load all readiness records for this board and stage
        const { data: readinessRecords, error } = await supabase
          .from('retro_user_readiness')
          .select('*')
          .eq('board_id', boardId)
          .eq('current_stage', currentStage);

        if (error) {
          console.error('❌ Error loading initial readiness:', error);
          return;
        }

        if (readinessRecords && readinessRecords.length > 0) {
          console.log('📊 Loaded readiness records:', readinessRecords);

          // Build readiness map from database records
          const newReadinessMap = new Map<string, { isReady: boolean; userName: string }>();
          let currentUserReady = false;
          const currentUserId = await getCurrentUserId();

          readinessRecords.forEach(record => {
            const userKey = record.user_id || record.session_id;
            if (userKey) {
              // Find the user name from activeUsers
              const user = activeUsers.find(u => (u.user_id || u.id) === userKey);
              const userName = user?.user_name || 'Unknown User';

              newReadinessMap.set(userKey, {
                isReady: record.is_ready,
                userName
              });

              // Check if this is the current user
              if (userKey === currentUserId) {
                currentUserReady = record.is_ready;
              }
            }
          });

          console.log('✅ Restored readiness state:', {
            mapSize: newReadinessMap.size,
            currentUserReady,
            entries: Array.from(newReadinessMap.entries())
          });

          // Update state with loaded data
          setReadinessMap(newReadinessMap);
          setIsCurrentUserReady(currentUserReady);
        } else {
          console.log('📭 No existing readiness records found');
        }
      } catch (error) {
        console.error('❌ Error loading initial readiness:', error);
      }
    };

    // Only load if we have active users (so we can map usernames)
    if (activeUsers.length > 0) {
      loadInitialReadiness();
    }
  }, [boardId, currentStage, activeUsers, getCurrentUserId]);

  // Recalculate summary when activeUsers or readinessMap changes
  useEffect(() => {
    if (activeUsers.length > 0) {
      calculateReadinessSummary();
    }
  }, [activeUsers, calculateReadinessSummary]);

  // Reset readiness when stage changes (but not on initial mount)
  const [previousStage, setPreviousStage] = useState<RetroStage | null>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  useEffect(() => {
    console.log('🔍 Stage effect triggered:', {
      currentStage,
      previousStage,
      isInitialMount,
      shouldReset: !isInitialMount && previousStage !== null && previousStage !== currentStage
    });

    if (!isInitialMount && previousStage !== null && previousStage !== currentStage) {
      console.log('🔄 Stage changed from', previousStage, 'to', currentStage, '- resetting readiness for all users');
      
      // Reset local state immediately
      setReadinessMap(new Map());
      setIsCurrentUserReady(false);
      setReadyUsers([]);
      setReadinessSummary({
        total_users: activeUsers.length,
        ready_users: 0,
        all_ready: false,
        ready_percentage: 0,
      });

      // Also broadcast a stage reset to ensure all users are synchronized
      if (broadcastReadinessChange) {
        const broadcastStageReset = async () => {
          try {
            const currentUserId = await getCurrentUserId();
            await broadcastReadinessChange({
              boardId,
              stage: currentStage,
              userId: currentUserId,
              isReady: false,
              userName: 'STAGE_RESET' // Special marker for stage reset
            });
            console.log('📡 Broadcasted stage reset to all users');
          } catch (error) {
            console.error('❌ Error broadcasting stage reset:', error);
          }
        };
        broadcastStageReset();
      }
    }
    
    setPreviousStage(currentStage);
    if (isInitialMount) {
      setIsInitialMount(false);
    }
  }, [currentStage, activeUsers.length, broadcastReadinessChange, getCurrentUserId, boardId]);

  return {
    isCurrentUserReady,
    readinessSummary,
    readyUsers,
    loading,
    toggleReadiness,
  };
};
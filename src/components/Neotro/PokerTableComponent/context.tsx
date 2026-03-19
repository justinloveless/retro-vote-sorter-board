import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PlayerSelection, PokerSessionState, getPointsWithMostVotes } from '@/hooks/usePokerSession';
import { supabase } from '@/integrations/supabase/client';
import { usePokerSessionHistory, PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { usePokerSessionChat } from '@/hooks/usePokerSessionChat';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';
import { useJiraIntegration } from '@/hooks/useJiraIntegration';
import { usePokerSlackNotification } from '@/hooks/usePokerSlackNotification';
import { PokerSessionConfig } from '../PokerConfig';
import { ReactNode, Dispatch, SetStateAction } from 'react';
import { TicketQueueItem } from '@/hooks/useTicketQueue';

interface PokerTableContextProps {
  session: PokerSessionState | null;
  activeUserId: string | undefined;
  updateUserSelection: (points: number) => void;
  toggleLockUserSelection: () => void;
  toggleAbstainUserSelection: () => void;
  playHand: () => void;
  /**
   * Reset the currently-selected round back to the "active" pre-reveal state
   * so players can change their locked-in cards.
   */
  replayRound: () => void;
  nextRound: (ticketNumber?: string) => void;
  updateTicketNumber: (ticketNumber: string) => void;
  updateSessionConfig: (config: { presence_enabled?: boolean; send_to_slack?: boolean; observer_ids?: string[] }) => void;
  leaveObserverMode: () => void;
  enterObserverMode: () => void;
  deleteAllRounds: () => void;
  presentUserIds: string[];
  teamId?: string;
  isMobile: boolean;
  userRole?: string;

  // Derived state and handlers
  displayTicketNumber: string;
  isTicketInputFocused: boolean;
  shake: boolean;
  isDrawerOpen: boolean;
  isChatDrawerOpen: boolean;
  isSending: boolean;
  isSlackInstalled: boolean;
  rounds: ReturnType<typeof usePokerSessionHistory>['rounds'];
  currentRound: ReturnType<typeof usePokerSessionHistory>['currentRound'];
  isViewingHistory: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  goToPreviousRound: () => void;
  goToNextRound: () => void;
  goToCurrentRound: () => void;
  goToRound: (roundNumber: number) => void;
  deleteRound: (roundId: string) => Promise<boolean>;
  chatMessagesForRound: ReturnType<typeof usePokerSessionChat>['messages'];
  chatUnreadCount: number;
  markChatAsRead: () => void;
  isChatLoading: boolean;
  sendMessage: (messageText: string, replyToMessageId?: string) => Promise<boolean>;
  sendSystemMessage: (messageText: string) => Promise<boolean>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  uploadChatImage: (file: File) => Promise<string | null>;
  handleSendToSlack: () => Promise<void>;
  displaySession: PokerSessionState | PokerSessionRound | null;
  /** Mode (most votes) - computed from selections when Playing */
  displayWinningPoints: number;
  cardGroups: { points: number; selections: (PlayerSelection & { userId: string; })[]; }[] | null;
  activeUserSelection: PlayerSelection & { points: number; locked: boolean; name: string; };
  totalPlayers: number;
  isObserver: boolean;
  pointOptions: number[];
  handlePointChange: (increment: boolean) => void;
  handleTicketNumberChange: (value: string) => void;
  handleTicketNumberFocus: () => void;
  handleTicketNumberBlur: () => void;
  setDisplayTicketNumber: React.Dispatch<React.SetStateAction<string>>;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsChatDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isJiraConfigured: boolean;
  isNextRoundDialogOpen: boolean;
  setNextRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
  onNextRoundRequest: () => void;
  isStartNewRoundDialogOpen: boolean;
  setStartNewRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
  onStartNewRoundRequest: () => void;
  ticketQueue: TicketQueueItem[];
  addTicketToQueue: (ticketKey: string, ticketSummary: string | null) => Promise<void>;
  removeTicketFromQueue: (id: string) => Promise<void>;
  reorderQueue: (items: TicketQueueItem[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  isQueuePanelOpen: boolean;
  setQueuePanelOpen: Dispatch<SetStateAction<boolean>>;
}

export const PokerTableContext = createContext<PokerTableContextProps | undefined>(undefined);

export const usePokerTable = () => {
  const context = useContext(PokerTableContext);
  if (!context) {
    throw new Error('usePokerTable must be used within a PokerTableProvider');
  }
  return context;
};

export interface PokerTableProviderProps {
  session: PokerSessionState | null;
  activeUserId: string | undefined;
  updateUserSelection: (points: number) => void;
  toggleLockUserSelection: () => void;
  toggleAbstainUserSelection: () => void;
  playHand: () => void;
  nextRound: (ticketNumber?: string) => void;
  updateTicketNumber: (ticketNumber: string) => void;
  updateSessionConfig: (config: { presence_enabled?: boolean; send_to_slack?: boolean; observer_ids?: string[] }) => void;
  leaveObserverMode: () => void;
  enterObserverMode: () => void;
  deleteAllRounds: () => void;
  presentUserIds: string[];
  children: ReactNode;
  isMobile: boolean;
  teamId?: string;
  userRole?: string;
  requestedRoundNumber?: number | null;
  isNextRoundDialogOpen: boolean;
  setNextRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
  onNextRoundRequest: () => void;
  isStartNewRoundDialogOpen: boolean;
  setStartNewRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
  onStartNewRoundRequest: () => void;
  ticketQueue: {
    queue: TicketQueueItem[];
    addTicket: (ticketKey: string, ticketSummary: string | null) => Promise<void>;
    removeTicket: (id: string) => Promise<void>;
    reorderQueue: (items: TicketQueueItem[]) => Promise<void>;
    clearQueue: () => Promise<void>;
  };
  isQueuePanelOpen: boolean;
  setQueuePanelOpen: Dispatch<SetStateAction<boolean>>;
}

export const PokerTableProvider: React.FC<PokerTableProviderProps> = ({ children, ...props }) => {
  const {
    session, activeUserId, teamId, isMobile,
    deleteAllRounds, updateSessionConfig, leaveObserverMode, enterObserverMode,
    nextRound,
    userRole, presentUserIds, requestedRoundNumber,
    isNextRoundDialogOpen, setNextRoundDialogOpen,
    onNextRoundRequest,
    isStartNewRoundDialogOpen, setStartNewRoundDialogOpen,
    onStartNewRoundRequest,
    ticketQueue: ticketQueueHook, isQueuePanelOpen, setQueuePanelOpen
  } = props;

  const [displayTicketNumber, setDisplayTicketNumber] = useState('');
  const [isTicketInputFocused, setIsTicketInputFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatSeenPerRound = useRef<Record<number, number>>({});
  const [chatLastSeenCount, setChatLastSeenCount] = useState(0);

  const { isSlackInstalled } = useSlackIntegration(teamId);
  const { isJiraConfigured } = useJiraIntegration(teamId);
  const { sendPokerRoundToSlack } = usePokerSlackNotification();

  const {
    rounds,
    currentRound,
    isViewingHistory,
    canGoBack,
    canGoForward,
    goToPreviousRound,
    goToNextRound,
    goToCurrentRound,
    goToRound,
    deleteRound,
  } = usePokerSessionHistory(session?.session_id || null, requestedRoundNumber || undefined);

  const [optimisticRoundsById, setOptimisticRoundsById] = useState<Record<string, PokerSessionRound>>({});

  const effectiveCurrentRound =
    currentRound && optimisticRoundsById[currentRound.id]
      ? optimisticRoundsById[currentRound.id]
      : currentRound;

  const normalizeForStableStringify = (value: any): any => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(normalizeForStableStringify);
    const out: Record<string, any> = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) out[key] = normalizeForStableStringify(value[key]);
    return out;
  };

  const stableStringify = (value: any): string => JSON.stringify(normalizeForStableStringify(value));

  // Optimistic rounds array so both the selector + hand state update immediately
  // across navigation between multiple active rounds.
  const roundsForUI = useMemo(() => {
    if (Object.keys(optimisticRoundsById).length === 0) return rounds;
    return rounds.map((r) => optimisticRoundsById[r.id] ?? r);
  }, [rounds, optimisticRoundsById]);

  // Clear optimistic state once the server state matches for that round.
  useEffect(() => {
    if (Object.keys(optimisticRoundsById).length === 0) return;

    const serverById = new Map(rounds.map((r) => [r.id, r]));
    const toClear: string[] = [];

    for (const [id, optimistic] of Object.entries(optimisticRoundsById)) {
      const server = serverById.get(id);
      if (!server) continue;
      if (
        server.is_active === optimistic.is_active &&
        server.game_state === optimistic.game_state &&
        server.ticket_number === optimistic.ticket_number &&
        Number(server.average_points) === Number(optimistic.average_points) &&
        stableStringify(server.selections) === stableStringify(optimistic.selections)
      ) {
        toClear.push(id);
      }
    }

    if (toClear.length > 0) {
      setOptimisticRoundsById((prev) => {
        const next = { ...prev };
        for (const id of toClear) delete next[id];
        return next;
      });
    }
  }, [rounds, optimisticRoundsById]);

  const activeRounds = useMemo(
    () => roundsForUI.filter((r) => r.is_active).slice().sort((a, b) => a.round_number - b.round_number),
    [roundsForUI]
  );

  const isViewingHistoryEffective = effectiveCurrentRound ? !effectiveCurrentRound.is_active : isViewingHistory;

  const handleNextRoundRequest = () => {
    // If we only have a single active round, "Next Round" creates a new one.
    if (activeRounds.length <= 1) {
      // Optimistically deactivate the current round so the UI doesn't lag.
      const currentRoundId = effectiveCurrentRound?.id;
      if (currentRoundId) {
        setOptimisticRoundsById((prev) => ({
          ...prev,
          [currentRoundId]: { ...(effectiveCurrentRound as PokerSessionRound), is_active: false },
        }));
      }
      onNextRoundRequest();
      return;
    }

    // Otherwise, just move to the next active round in order.
    const currentRoundNumber = effectiveCurrentRound?.round_number;
    if (currentRoundNumber == null) return;

    const idx = activeRounds.findIndex((r) => r.round_number === currentRoundNumber);
    if (idx < 0) return;

    const next = activeRounds[(idx + 1) % activeRounds.length];
    if (!next) return;

    // "Next Round" always deactivates the currently selected round first.
    const currentRoundId = effectiveCurrentRound?.id;
    if (!currentRoundId) {
      goToRound(next.round_number);
      return;
    }

    void (async () => {
      try {
        setOptimisticRoundsById((prev) => ({
          ...prev,
          [currentRoundId]: { ...(effectiveCurrentRound as PokerSessionRound), is_active: false },
        }));
        const { error } = await supabase
          .from('poker_session_rounds')
          .update({ is_active: false })
          .eq('id', currentRoundId);

        if (error) console.error('Error deactivating current round:', error);
      } catch (e) {
        console.error('Unexpected error deactivating current round:', e);
      } finally {
        goToRound(next.round_number);
      }
    })();
  };

  const {
    messages: chatMessagesForRound,
    loading: isChatLoading,
    sendMessage,
    sendSystemMessage,
    addReaction,
    removeReaction,
    uploadImage: uploadChatImage,
  } = usePokerSessionChat(
    session?.session_id || null,
    currentRound?.round_number || session?.round_number || 1,
    activeUserId,
    effectiveCurrentRound?.selections?.[activeUserId || '']?.name
  );

  const currentRoundNumber = currentRound?.round_number ?? session?.round_number ?? 1;

  const markChatAsRead = useCallback(() => {
    setChatLastSeenCount(chatMessagesForRound.length);
    chatSeenPerRound.current[currentRoundNumber] = chatMessagesForRound.length;
  }, [chatMessagesForRound.length, currentRoundNumber]);

  useEffect(() => {
    setChatLastSeenCount(chatSeenPerRound.current[currentRoundNumber] ?? 0);
  }, [currentRoundNumber]);

  const chatUnreadCount = useMemo(
    () => Math.max(0, chatMessagesForRound.length - chatLastSeenCount),
    [chatMessagesForRound.length, chatLastSeenCount]
  );

  const displaySession = useMemo(() => {
    if (!effectiveCurrentRound) return session;
    if (!session) return effectiveCurrentRound;
    return { ...session, ...effectiveCurrentRound };
  }, [session, effectiveCurrentRound]);

  /** Mode (most votes) - computed from selections so we always show correct value */
  const displayWinningPoints = useMemo(() => {
    if (!displaySession || displaySession.game_state !== 'Playing') return 0;
    const participating = (Object.values(displaySession.selections) as PlayerSelection[]).filter(
      (s) => s.points !== -1
    );
    return getPointsWithMostVotes(participating);
  }, [displaySession]);

  const handleSendToSlack = async () => {
    if (!displaySession || !teamId) return;
    setIsSending(true);
    const pressedBy = (activeUserSelection?.name || '').trim() || 'Someone';
    // Log the button press into chat before posting the round to Slack.
    await sendSystemMessage(
      `<p>Round sent to Slack by ${pressedBy}</p>`
    );
    // Slack round results should not include our system messages.
    const userChatMessages = chatMessagesForRound.filter((m) => m.user_id !== null);
    await sendPokerRoundToSlack(
      teamId,
      displaySession.ticket_number,
      displaySession.ticket_title,
      displaySession.selections,
      displayWinningPoints,
      userChatMessages
    );
    setIsSending(false);
  };

  const cardGroups = useMemo(() => {
    if (!displaySession || displaySession.game_state !== 'Playing') {
      return null;
    }
    const selections = Object.entries(displaySession.selections)
      .filter(([, selection]) => (selection as PlayerSelection).name?.trim());
    type SelectionWithUserId = PlayerSelection & { userId: string };
    const groups = selections.reduce((acc, [userId, selection]) => {
      const points = (selection as PlayerSelection).points;
      if (!acc[points]) {
        acc[points] = [];
      }
      acc[points].push({ userId, ...(selection as PlayerSelection) });
      return acc;
    }, {} as Record<number, SelectionWithUserId[]>);
    const sortedGroupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
    const allAbstained = sortedGroupKeys.length === 1 && sortedGroupKeys[0] === -1;
    return sortedGroupKeys
      .filter(points => allAbstained || points !== -1)
      .map(points => ({
        points,
        selections: groups[points],
      }));
  }, [displaySession]);

  const updateTicketNumberForSelectedRound = async (ticketNumber: string) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active) return;

    // Optimistic UI: update immediately, then persist.
    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...effectiveCurrentRound, ticket_number: ticketNumber },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ ticket_number: ticketNumber })
      .eq('id', effectiveCurrentRound.id);

    if (error) {
      console.error('Error updating ticket number:', error);
    }
  };

  const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    const debouncedFunc = (...args: Parameters<F>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
    debouncedFunc.cancel = () => {
      clearTimeout(timeoutId);
    };
    return debouncedFunc;
  };

  const debouncedUpdateTicketNumber = useCallback(
    debounce((value: string) => {
      updateTicketNumberForSelectedRound(value);
    }, 500),
    [updateTicketNumberForSelectedRound]
  );

  React.useEffect(() => {
    if (isTicketInputFocused) return;

    // Keep `displayTicketNumber` tied to the active/latest round:
    // - If we're currently on the active round, use `displaySession.ticket_number` so optimistic updates
    //   (while editing) reflect immediately.
    // - If we're viewing history (inactive round), use `session.ticket_number` so the selector's
    //   "latest/current" chip doesn't get overwritten by history navigation.
    const nextTicketNumber = effectiveCurrentRound?.is_active
      ? displaySession?.ticket_number || ''
      : session?.ticket_number || '';

    setDisplayTicketNumber(nextTicketNumber);
  }, [displaySession?.ticket_number, session?.ticket_number, isTicketInputFocused, effectiveCurrentRound?.is_active]);

  const pointOptions = [1, 2, 3, 5, 8, 13, 21];

  const activeUserSelection = useMemo(() => {
    if (displaySession && activeUserId && displaySession.selections[activeUserId]) {
      return displaySession.selections[activeUserId];
    }
    return { points: 0, locked: false, name: '' };
  }, [displaySession, activeUserId]);

  const observerIds = useMemo(() => (session as { observer_ids?: string[] } | null)?.observer_ids ?? [], [session]);
  const isObserver = !!(activeUserId && observerIds.includes(activeUserId));
  const totalPlayers = displaySession ? Object.keys(displaySession.selections).length : 0;

  const updateUserSelectionForSelectedRound = async (points: number) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;

    const selections = effectiveCurrentRound.selections || {};
    const userSelection = selections[activeUserId] as PlayerSelection | undefined;
    if (!userSelection || userSelection.locked) return;

    const newSelections = {
      ...selections,
      [activeUserId]: { ...userSelection, points },
    };

    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...effectiveCurrentRound, selections: newSelections },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ selections: newSelections })
      .eq('id', effectiveCurrentRound.id);

    if (error) {
      console.error('Error updating user selection:', error);
    }
  };

  const toggleLockUserSelectionForSelectedRound = async () => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;

    const selections = effectiveCurrentRound.selections || {};
    const userSelection = selections[activeUserId] as PlayerSelection | undefined;
    if (!userSelection || userSelection.points === -1) return;

    const newSelections = {
      ...selections,
      [activeUserId]: { ...userSelection, locked: !userSelection.locked },
    };

    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...effectiveCurrentRound, selections: newSelections },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ selections: newSelections })
      .eq('id', effectiveCurrentRound.id);

    if (error) {
      console.error('Error toggling lock:', error);
    }
  };

  const toggleAbstainUserSelectionForSelectedRound = async () => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;

    const selections = effectiveCurrentRound.selections || {};
    const userSelection = selections[activeUserId] as PlayerSelection | undefined;
    if (!userSelection) return;

    const isCurrentlyAbstained = userSelection.points === -1;
    const newSelection = {
      ...userSelection,
      points: isCurrentlyAbstained ? 1 : -1,
      locked: !isCurrentlyAbstained,
    };

    const newSelections = {
      ...selections,
      [activeUserId]: newSelection,
    };

    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...effectiveCurrentRound, selections: newSelections },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ selections: newSelections })
      .eq('id', effectiveCurrentRound.id);

    if (error) {
      console.error('Error toggling abstain:', error);
    }
  };

  const playHandForSelectedRound = async () => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active) return;
    if (effectiveCurrentRound.game_state === 'Playing') return;

    const newSelections = { ...(effectiveCurrentRound.selections || {}) } as Record<
      string,
      PlayerSelection
    >;

    // Unlocked selections go to abstain during reveal.
    Object.values(newSelections).forEach((s) => {
      if (!s.locked) s.points = -1;
    });

    const participating = Object.values(newSelections).filter((s) => s.points !== -1);
    const winning_points = getPointsWithMostVotes(participating as { points: number }[]);

    const newState = {
      game_state: 'Playing' as const,
      selections: newSelections,
      average_points: winning_points,
    };

    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...effectiveCurrentRound, ...newState },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update(newState)
      .eq('id', effectiveCurrentRound.id);

    if (error) {
      console.error('Error playing hand:', error);
      return;
    }

    // Notify once for round 1 only; not when playing hands on new rounds.
    try {
      const participantIds = Object.keys(newSelections);
      if (
        participantIds.length > 0 &&
        session?.room_id &&
        effectiveCurrentRound.round_number === 1
      ) {
        await supabase.functions.invoke('admin-send-notification', {
          body: {
            recipients: participantIds.map((id) => ({ userId: id })),
            type: 'poker_session',
            title: `Poker session started`,
            message: 'Click to join the session.',
            url: `/poker/${session.room_id}`,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to emit poker notifications', e);
    }
  };

  // Auto-reveal: when every participant has locked in or abstained, reveal cards automatically.
  const autoRevealTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active) return;
    if (effectiveCurrentRound.game_state === 'Playing') return;

    const selections = effectiveCurrentRound.selections || {};
    const entries = Object.entries(selections);
    // Need at least 1 player to auto-reveal
    if (entries.length === 0) return;

    const allReady = entries.every(([, sel]) => {
      const s = sel as PlayerSelection;
      return s.locked || s.points === -1;
    });

    if (allReady && autoRevealTriggeredRef.current !== effectiveCurrentRound.id) {
      autoRevealTriggeredRef.current = effectiveCurrentRound.id;
      // Small delay so the last lock-in animation is visible before reveal
      setTimeout(() => {
        playHandForSelectedRound();
      }, 600);
    }
  }, [effectiveCurrentRound]);

  const replayRoundForSelectedRound = async () => {
    if (!effectiveCurrentRound) return;
    if (effectiveCurrentRound.game_state !== 'Playing') return;

    const pressedBy = (activeUserSelection?.name || '').trim() || 'Someone';

    const selections = effectiveCurrentRound.selections || {};
    const resetSelections: Record<string, PlayerSelection> = {};

    for (const [userId, sel] of Object.entries(selections)) {
      const s = sel as PlayerSelection;
      resetSelections[userId] = {
        ...s,
        locked: false,
        // Put everyone back into a selectable state (not abstained).
        points: s.points === -1 ? 1 : s.points,
      };
    }

    const nextState = {
      is_active: true,
      game_state: 'Selection' as const,
      selections: resetSelections,
      average_points: 0,
    };

    // Reset auto-reveal guard so it can trigger again after replay.
    autoRevealTriggeredRef.current = null;

    // Optimistic update so the hand UI flips back immediately.
    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...(effectiveCurrentRound as PokerSessionRound), ...nextState },
    }));

    void sendSystemMessage(`<p>Round replayed by ${pressedBy}</p>`).catch(() => undefined);

    const { error } = await supabase
      .from('poker_session_rounds')
      .update(nextState)
      .eq('id', effectiveCurrentRound.id);

    if (error) {
      console.error('Error replaying round:', error);
    }
  };

  const handlePointChange = (increment: boolean) => {
    if (!effectiveCurrentRound?.is_active) return;
    const currentIndex = pointOptions.indexOf(activeUserSelection.points);
    let newIndex = increment ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= pointOptions.length) {
      newIndex = pointOptions.length - 1;
      if (increment) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }
    updateUserSelectionForSelectedRound(pointOptions[newIndex]);
  };

  const handleTicketNumberChange = (value: string) => {
    if (!effectiveCurrentRound?.is_active) return;
    setDisplayTicketNumber(value);
    debouncedUpdateTicketNumber(value);
  }

  const handleTicketNumberFocus = () => {
    setIsTicketInputFocused(true);
  }

  const handleTicketNumberBlur = () => {
    setIsTicketInputFocused(false);
    debouncedUpdateTicketNumber.cancel();
    if (effectiveCurrentRound && displayTicketNumber !== (effectiveCurrentRound.ticket_number || '')) {
      updateTicketNumberForSelectedRound(displayTicketNumber);
    }
  }

  const value: PokerTableContextProps = {
    session,
    activeUserId,
    updateUserSelection: updateUserSelectionForSelectedRound,
    toggleLockUserSelection: toggleLockUserSelectionForSelectedRound,
    toggleAbstainUserSelection: toggleAbstainUserSelectionForSelectedRound,
    playHand: playHandForSelectedRound,
    replayRound: replayRoundForSelectedRound,
    nextRound,
    updateTicketNumber: updateTicketNumberForSelectedRound,
    updateSessionConfig,
    leaveObserverMode,
    enterObserverMode,
    deleteAllRounds,
    presentUserIds,
    teamId,
    isMobile,
    userRole,
    displayTicketNumber,
    isTicketInputFocused,
    shake,
    isDrawerOpen,
    isChatDrawerOpen,
    isSending,
    isSlackInstalled,
    rounds: roundsForUI,
    currentRound,
    isViewingHistory: isViewingHistoryEffective,
    canGoBack,
    canGoForward,
    goToPreviousRound,
    goToNextRound,
    goToCurrentRound,
    goToRound,
    deleteRound,
    chatMessagesForRound,
    chatUnreadCount,
    markChatAsRead,
    isChatLoading,
    sendMessage,
    sendSystemMessage,
    addReaction,
    removeReaction,
    uploadChatImage,
    handleSendToSlack,
    displaySession,
    displayWinningPoints,
    cardGroups,
    activeUserSelection,
    totalPlayers,
    isObserver,
    pointOptions,
    handlePointChange,
    handleTicketNumberChange,
    handleTicketNumberFocus,
    handleTicketNumberBlur,
    setDisplayTicketNumber,
    setIsDrawerOpen,
    setIsChatDrawerOpen,
    isJiraConfigured,
    isNextRoundDialogOpen,
    setNextRoundDialogOpen,
    onNextRoundRequest: handleNextRoundRequest,
    isStartNewRoundDialogOpen,
    setStartNewRoundDialogOpen,
    onStartNewRoundRequest,
    ticketQueue: ticketQueueHook.queue,
    addTicketToQueue: ticketQueueHook.addTicket,
    removeTicketFromQueue: ticketQueueHook.removeTicket,
    reorderQueue: ticketQueueHook.reorderQueue,
    clearQueue: ticketQueueHook.clearQueue,
    isQueuePanelOpen,
    setQueuePanelOpen,
  };

  return (
    <PokerTableContext.Provider value={value}>
      {children}
    </PokerTableContext.Provider>
  );
}; 
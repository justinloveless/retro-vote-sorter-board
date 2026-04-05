import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  PlayerSelection,
  PokerSession,
  PokerSessionState,
  getPointsWithMostVotes,
  getWinningVoteFromSelections,
  winningVoteToStoredAveragePoints,
  type WinningPoints,
} from '@/hooks/usePokerSession';
import { supabase } from '@/integrations/supabase/client';
import {
  usePokerSessionHistory,
  PokerSessionRound,
  type PokerHistoryTeamRoute,
  POKER_FOLLOW_CURRENT_ROUND_EVENT,
  POKER_SPOTLIGHT_SERVER_ALIGNED_EVENT,
  type PokerSpotlightServerAlignedDetail,
} from '@/hooks/usePokerSessionHistory';
import { usePokerSessionChat } from '@/hooks/usePokerSessionChat';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';
import { useJiraIntegration } from '@/hooks/useJiraIntegration';
import { usePokerSlackNotification } from '@/hooks/usePokerSlackNotification';
import { PokerSessionConfig } from '../PokerConfig';
import { ReactNode, Dispatch, SetStateAction } from 'react';
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
import { isSyntheticRoundTicket, roundTicketPlaceholder } from '@/lib/pokerRoundTicketPlaceholder';
import { usePokerSpotlightClientId } from '@/hooks/use-poker-spotlight-client-id';
import { deriveDisplayGameState } from '@/lib/pokerRoundDisplayGameState';
import { POKER_DECK_POINT_VALUES } from '@/lib/pokerPointDeck';

interface PokerTableContextProps {
  session: PokerSessionState | null;
  activeUserId: string | undefined;
  updateUserSelection: (points: number) => void;
  updateUserSelectionBetween: (low: number, high: number) => void;
  /** Set between vote and lock in one update (e.g. side-zone hold complete). */
  lockInUserSelectionBetween: (low: number, high: number) => void;
  /** Set the user's card to these points and lock in one update (e.g. drag-to-play). */
  lockInUserSelectionAtPoints: (points: number) => void;
  toggleLockUserSelection: () => void;
  toggleAbstainUserSelection: () => void;
  playHand: () => void;
  /**
   * Reset the currently-selected round to Selection (pre-reveal). Preserves each vote
   * including between/mixed ranges; non-abstainers stay locked. Abstentions unchanged.
   */
  replayRound: () => void;
  /** Set `is_active: true` on an inactive round that is still in Selection (strip context menu). */
  activateRoundById: (roundId: string) => Promise<void>;
  nextRound: (ticketNumber?: string) => void;
  updateTicketNumber: (
    ticketNumber: string,
    ticketTitle?: string | null,
    ticketParent?: { key: string; summary: string } | null
  ) => void;
  updateSessionConfig: (config: Partial<PokerSession>) => void;
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
  /** Selected round merged with optimistic updates (ticket/selections). */
  effectiveCurrentRound: PokerSessionRound | null;
  isViewingHistory: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Index into `rounds` for the selected round; changes when navigating history. */
  currentRoundIndex: number;
  goToPreviousRound: () => void;
  goToNextRound: () => void;
  goToCurrentRound: () => void;
  goToRound: (roundNumber: number) => void;
  deleteRound: (roundId: string, options?: { suppressToast?: boolean }) => Promise<boolean>;
  chatMessagesForRound: ReturnType<typeof usePokerSessionChat>['messages'];
  /** New chat messages on other rounds while viewing a different round (for round strip badges). */
  chatNewMessageCountByRound: Record<number, number>;
  chatUnreadCount: number;
  markChatAsRead: () => void;
  isChatLoading: boolean;
  sendMessage: (messageText: string, replyToMessageId?: string) => Promise<boolean>;
  sendSystemMessage: (messageText: string) => Promise<boolean>;
  sendBotMessage: (botName: string, messageText: string) => Promise<string | null>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  uploadChatImage: (file: File) => Promise<string | null>;
  handleSendToSlack: () => Promise<void>;
  displaySession: PokerSessionState | PokerSessionRound | null;
  /** Mode (most votes) - numeric storage / legacy (between → lower bound) */
  displayWinningPoints: number;
  displayWinningVote: WinningPoints;
  cardGroups: {
    points: number;
    betweenHighPoints?: number;
    selections: (PlayerSelection & { userId: string })[];
  }[] | null;
  activeUserSelection: PlayerSelection & { points: number; locked: boolean; name: string; };
  totalPlayers: number;
  isObserver: boolean;
  pointOptions: number[];
  /** Team-defined labels for deck values; shown under Your Hand when non-empty. */
  pokerPointValueDescriptions: Record<number, string>;
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
  /** End/deactivate the current round without creating a new one. */
  onEndRoundOnly: () => void;
  isStartNewRoundDialogOpen: boolean;
  setStartNewRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
  onStartNewRoundRequest: () => void;
  addTicketToQueue: (
    ticketKey: string,
    ticketSummary: string | null,
    ticketParent?: { key: string; summary: string } | null,
    opts?: { forceNewRound?: boolean; pendingRound?: boolean }
  ) => Promise<string | null>;
  /** Clear spotlight browse preview flag after the user commits "Add to rounds". */
  commitPendingBrowseRound: (roundId: string) => Promise<void>;
  addTicketsToQueueBatch: (
    tickets: Array<{
      ticketKey: string;
      ticketSummary: string | null;
      ticketParent?: { key: string; summary: string } | null;
    }>
  ) => Promise<void>;
  isQueuePanelOpen: boolean;
  setQueuePanelOpen: Dispatch<SetStateAction<boolean>>;
  onPokerBack?: () => void;
  pokerToolbarExtras?: ReactNode;

  spotlightRoundNumber: number | null;
  isSpotlightMine: boolean;
  onSpotlightClick: () => void;
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
  /** Fallback display name for chat when the user has no selection row (e.g. observer or impersonation edge cases). */
  activeUserDisplayName?: string;
  updateUserSelection: (points: number) => void;
  toggleLockUserSelection: () => void;
  toggleAbstainUserSelection: () => void;
  playHand: () => void;
  nextRound: (ticketNumber?: string) => void;
  /** Add a new active round without deactivating existing active rounds (parallel rounds). */
  startNewRound: (
    ticketNumber?: string,
    ticketTitle?: string | null,
    ticketParent?: { key: string; summary: string } | null,
    options?: { pendingRound?: boolean }
  ) => Promise<string | null> | void;
  startNewRounds?: (
    tickets: Array<{
      ticketNumber: string;
      ticketTitle?: string | null;
      ticketParent?: { key: string; summary: string } | null;
    }>
  ) => Promise<void>;
  updateTicketNumber: (
    ticketNumber: string,
    ticketTitle?: string | null,
    ticketParent?: { key: string; summary: string } | null
  ) => void;
  updateSessionConfig: (config: Partial<PokerSession>) => void;
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
  isQueuePanelOpen: boolean;
  setQueuePanelOpen: Dispatch<SetStateAction<boolean>>;
  pokerRouteContext?: PokerHistoryTeamRoute | null;
  onPokerBack?: () => void;
  pokerToolbarExtras?: ReactNode;
  pokerPointValueDescriptions?: Record<number, string>;
}

export const PokerTableProvider: React.FC<PokerTableProviderProps> = ({ children, ...props }) => {
  const {
    session, activeUserId, activeUserDisplayName, teamId, isMobile,
    deleteAllRounds, updateSessionConfig, leaveObserverMode, enterObserverMode,
    nextRound,
    startNewRound,
    startNewRounds,
    updateTicketNumber: updateLiveRoundTicketNumber,
    userRole, presentUserIds, requestedRoundNumber,
    isNextRoundDialogOpen, setNextRoundDialogOpen,
    onNextRoundRequest,
    isStartNewRoundDialogOpen, setStartNewRoundDialogOpen,
    onStartNewRoundRequest,
    isQueuePanelOpen, setQueuePanelOpen,
    pokerRouteContext,
    onPokerBack,
    pokerToolbarExtras,
    pokerPointValueDescriptions: pokerPointValueDescriptionsProp,
  } = props;

  const pokerPointValueDescriptions = pokerPointValueDescriptionsProp ?? {};

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

  const mySpotlightClientId = usePokerSpotlightClientId();
  const spotlightUserId = session?.spotlight_user_id ?? null;
  const sessionSpotlightClientId = session?.spotlight_client_id ?? null;
  const spotlightRoundNumber =
    session?.spotlight_user_id != null && session?.spotlight_round_number != null
      ? session.spotlight_round_number
      : null;
  /** Same user may only hold spotlight in one browser tab; `spotlight_client_id` null means legacy row before any client pinned it (any of that user's tabs may control until pinned). */
  const isSpotlightMine = !!(
    activeUserId &&
    spotlightUserId === activeUserId &&
    (sessionSpotlightClientId === null || sessionSpotlightClientId === mySpotlightClientId)
  );

  /** URL `?round=` wins; otherwise new joiners land on the spotlight holder's round (not the last round in the list). */
  const historyInitialRound = useMemo(() => {
    if (requestedRoundNumber != null) return requestedRoundNumber;
    if (session?.spotlight_follow_enabled === false) return undefined;
    if (!spotlightUserId || session?.spotlight_round_number == null) return undefined;
    if (isSpotlightMine) return undefined;
    return session.spotlight_round_number;
  }, [
    requestedRoundNumber,
    session?.spotlight_follow_enabled,
    spotlightUserId,
    session?.spotlight_round_number,
    isSpotlightMine,
  ]);

  const {
    rounds,
    currentRound,
    currentRoundIndex,
    isViewingHistory,
    canGoBack,
    canGoForward,
    goToPreviousRound,
    goToNextRound,
    goToCurrentRound,
    goToRound,
    deleteRound,
  } = usePokerSessionHistory(
    session?.session_id || null,
    historyInitialRound ?? undefined,
    pokerRouteContext ?? null
  );

  /** While local strip lags behind a new round, don't write spotlight_round_number back to a stale viewed round. */
  const spotlightSyncGuardRef = useRef<{ floorRound: number } | null>(null);

  const clearSpotlightSyncGuard = useCallback(() => {
    spotlightSyncGuardRef.current = null;
  }, []);

  const goToRoundWithGuardClear = useCallback(
    (roundNumber: number) => {
      clearSpotlightSyncGuard();
      goToRound(roundNumber);
    },
    [goToRound, clearSpotlightSyncGuard]
  );

  const goToPreviousRoundWithGuardClear = useCallback(() => {
    clearSpotlightSyncGuard();
    goToPreviousRound();
  }, [goToPreviousRound, clearSpotlightSyncGuard]);

  const goToNextRoundWithGuardClear = useCallback(() => {
    clearSpotlightSyncGuard();
    goToNextRound();
  }, [goToNextRound, clearSpotlightSyncGuard]);

  const goToCurrentRoundWithGuardClear = useCallback(() => {
    clearSpotlightSyncGuard();
    goToCurrentRound();
  }, [goToCurrentRound, clearSpotlightSyncGuard]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<PokerSpotlightServerAlignedDetail>;
      const d = ce.detail;
      if (!d?.sessionId || d.sessionId !== session?.session_id || typeof d.roundNumber !== 'number') return;
      spotlightSyncGuardRef.current = { floorRound: d.roundNumber };
    };
    window.addEventListener(POKER_SPOTLIGHT_SERVER_ALIGNED_EVENT, handler);
    return () => window.removeEventListener(POKER_SPOTLIGHT_SERVER_ALIGNED_EVENT, handler);
  }, [session?.session_id]);

  const [optimisticRoundsById, setOptimisticRoundsById] = useState<Record<string, PokerSessionRound>>({});

  const effectiveCurrentRound =
    currentRound && optimisticRoundsById[currentRound.id]
      ? optimisticRoundsById[currentRound.id]
      : currentRound;

  const selectionChatName = effectiveCurrentRound?.selections?.[activeUserId || '']?.name?.trim();
  const chatUserName =
    selectionChatName && selectionChatName.length > 0
      ? selectionChatName
      : (activeUserDisplayName?.trim() || 'Player');

  const addTicketToQueue = useCallback(
    async (
      ticketKey: string,
      ticketSummary: string | null,
      ticketParent?: { key: string; summary: string } | null,
      opts?: { forceNewRound?: boolean; pendingRound?: boolean }
    ): Promise<string | null> => {
      const normalizedTicketKey = ticketKey.trim();
      if (!normalizedTicketKey) return null;
      const sess = session;
      const noTicketOnCurrentRound = sess && isSyntheticRoundTicket(sess.ticket_number);
      if (noTicketOnCurrentRound && !opts?.forceNewRound) {
        const liveRoundId = sess.id;
        const baseRound =
          rounds.find((r) => r.id === liveRoundId) ??
          (currentRound?.id === liveRoundId ? currentRound : undefined);
        if (baseRound) {
          setOptimisticRoundsById((prev) => ({
            ...prev,
            [liveRoundId]: {
              ...baseRound,
              ticket_number: normalizedTicketKey,
              ticket_title: ticketSummary,
              ...(ticketParent !== undefined
                ? {
                    ticket_parent_key: ticketParent?.key ?? null,
                    ticket_parent_summary: ticketParent?.summary ?? null,
                  }
                : {}),
            },
          }));
          if (currentRound?.id === liveRoundId && currentRound.is_active) {
            setDisplayTicketNumber(normalizedTicketKey);
          }
        }
        await updateLiveRoundTicketNumber(normalizedTicketKey, ticketSummary, ticketParent);
        return typeof liveRoundId === 'string' ? liveRoundId : null;
      }
      const out = startNewRound(
        normalizedTicketKey,
        ticketSummary,
        ticketParent,
        opts?.pendingRound ? { pendingRound: true } : undefined
      ) as Promise<string | null | void> | string | null | void;
      const resolved: unknown = await Promise.resolve(out);
      return typeof resolved === 'string' ? resolved : null;
    },
    [
      session,
      rounds,
      currentRound,
      startNewRound,
      updateLiveRoundTicketNumber,
    ]
  );

  const commitPendingBrowseRound = useCallback(async (roundId: string) => {
    const id = roundId.trim();
    if (!id) return;
    setOptimisticRoundsById((prev) => {
      const base = prev[id];
      if (!base) return prev;
      return { ...prev, [id]: { ...base, is_pending_round: false } };
    });
    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ is_pending_round: false })
      .eq('id', id);
    if (error) console.error('commitPendingBrowseRound', error);
  }, []);

  const addTicketsToQueueBatch = useCallback(
    async (
      tickets: Array<{
        ticketKey: string;
        ticketSummary: string | null;
        ticketParent?: { key: string; summary: string } | null;
      }>
    ) => {
      const uniqueTicketMap = new Map<
        string,
        { ticketSummary: string | null; ticketParent?: { key: string; summary: string } | null }
      >();
      for (const ticket of tickets) {
        const key = ticket.ticketKey.trim();
        if (!key || uniqueTicketMap.has(key)) continue;
        uniqueTicketMap.set(key, {
          ticketSummary: ticket.ticketSummary,
          ticketParent: ticket.ticketParent,
        });
      }
      if (uniqueTicketMap.size === 0) return;

      const normalizedTickets = Array.from(uniqueTicketMap.entries()).map(([ticketKey, v]) => ({
        ticketKey,
        ticketSummary: v.ticketSummary,
        ticketParent: v.ticketParent,
      }));

      const sess = session;
      const noTicketOnCurrentRound = sess && isSyntheticRoundTicket(sess.ticket_number);
      let startIndex = 0;

      if (noTicketOnCurrentRound) {
        const firstTicket = normalizedTickets[0];
        if (firstTicket) {
          const liveRoundId = sess.id;
          const baseRound =
            rounds.find((r) => r.id === liveRoundId) ??
            (currentRound?.id === liveRoundId ? currentRound : undefined);
          if (baseRound) {
            setOptimisticRoundsById((prev) => ({
              ...prev,
              [liveRoundId]: {
                ...baseRound,
                ticket_number: firstTicket.ticketKey,
                ticket_title: firstTicket.ticketSummary,
                ...(firstTicket.ticketParent !== undefined
                  ? {
                      ticket_parent_key: firstTicket.ticketParent?.key ?? null,
                      ticket_parent_summary: firstTicket.ticketParent?.summary ?? null,
                    }
                  : {}),
              },
            }));
            if (currentRound?.id === liveRoundId && currentRound.is_active) {
              setDisplayTicketNumber(firstTicket.ticketKey);
            }
          }
          await updateLiveRoundTicketNumber(
            firstTicket.ticketKey,
            firstTicket.ticketSummary,
            firstTicket.ticketParent
          );
          startIndex = 1;
        }
      }

      const remaining = normalizedTickets.slice(startIndex).map((ticket) => ({
        ticketNumber: ticket.ticketKey,
        ticketTitle: ticket.ticketSummary,
        ticketParent: ticket.ticketParent,
      }));
      if (remaining.length === 0) return;

      if (startNewRounds) {
        await startNewRounds(remaining);
        return;
      }

      for (const ticket of remaining) {
        await startNewRound(ticket.ticketNumber, ticket.ticketTitle);
      }
    },
    [
      session,
      rounds,
      currentRound,
      startNewRound,
      startNewRounds,
      updateLiveRoundTicketNumber,
    ]
  );

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

  const spotlightOtherDisplayName = useMemo(() => {
    if (!spotlightUserId) return '';
    if (spotlightUserId === activeUserId) {
      return isSpotlightMine ? '' : 'You (another window)';
    }
    const rn = session?.spotlight_round_number;
    if (typeof rn === 'number') {
      const spotlightRound = roundsForUI.find((r) => r.round_number === rn);
      const fromSpotlightRound = spotlightRound?.selections?.[spotlightUserId]?.name?.trim();
      if (fromSpotlightRound) return fromSpotlightRound;
    }
    const fromViewedRound = session?.selections?.[spotlightUserId]?.name?.trim();
    if (fromViewedRound) return fromViewedRound;
    for (const r of roundsForUI) {
      const n = r.selections?.[spotlightUserId]?.name?.trim();
      if (n) return n;
    }
    return '';
  }, [
    spotlightUserId,
    activeUserId,
    isSpotlightMine,
    session?.selections,
    session?.spotlight_round_number,
    roundsForUI,
  ]);

  const [spotlightTakeoverOpen, setSpotlightTakeoverOpen] = useState(false);

  const onSpotlightClick = useCallback(() => {
    if (!session || !activeUserId || !effectiveCurrentRound) return;
    const holder = session.spotlight_user_id ?? null;
    const holderClient = session.spotlight_client_id ?? null;
    const roundNum = effectiveCurrentRound.round_number;

    if (holder === activeUserId) {
      if (holderClient != null && holderClient !== mySpotlightClientId) {
        setSpotlightTakeoverOpen(true);
        return;
      }
      void updateSessionConfig({
        spotlight_user_id: null,
        spotlight_round_number: null,
        spotlight_client_id: null,
      });
      return;
    }
    if (holder && holder !== activeUserId) {
      setSpotlightTakeoverOpen(true);
      return;
    }
    void updateSessionConfig({
      spotlight_user_id: activeUserId,
      spotlight_round_number: roundNum,
      spotlight_client_id: mySpotlightClientId,
    });
  }, [session, activeUserId, effectiveCurrentRound, mySpotlightClientId, updateSessionConfig]);

  const confirmSpotlightTakeover = useCallback(() => {
    if (!session || !activeUserId || !effectiveCurrentRound) return;
    setSpotlightTakeoverOpen(false);
    void updateSessionConfig({
      spotlight_user_id: activeUserId,
      spotlight_round_number: effectiveCurrentRound.round_number,
      spotlight_client_id: mySpotlightClientId,
    });
  }, [session, activeUserId, effectiveCurrentRound, mySpotlightClientId, updateSessionConfig]);

  const cancelSpotlightTakeover = useCallback(() => {
    setSpotlightTakeoverOpen(false);
  }, []);

  useEffect(() => {
    if (!isSpotlightMine || !effectiveCurrentRound || activeUserId == null) return;
    const rn = effectiveCurrentRound.round_number;

    const g = spotlightSyncGuardRef.current;
    if (g && rn >= g.floorRound) {
      spotlightSyncGuardRef.current = null;
    }

    if (session?.spotlight_round_number === rn) return;

    const g2 = spotlightSyncGuardRef.current;
    if (g2 && rn < g2.floorRound) {
      return;
    }

    const t = window.setTimeout(() => {
      void updateSessionConfig({
        spotlight_round_number: rn,
        spotlight_client_id: mySpotlightClientId,
      });
    }, 220);

    return () => clearTimeout(t);
  }, [
    isSpotlightMine,
    effectiveCurrentRound?.round_number,
    activeUserId,
    session?.spotlight_round_number,
    session?.current_round_number,
    mySpotlightClientId,
    updateSessionConfig,
  ]);

  useEffect(() => {
    if (session?.spotlight_follow_enabled === false) return;
    if (!session?.spotlight_user_id || session.spotlight_round_number == null) return;
    if (isSpotlightMine) return;

    window.dispatchEvent(
      new CustomEvent(POKER_FOLLOW_CURRENT_ROUND_EVENT, {
        detail: { sessionId: session.session_id, roundNumber: session.spotlight_round_number },
      })
    );
  }, [
    session?.spotlight_follow_enabled,
    session?.spotlight_user_id,
    session?.spotlight_round_number,
    isSpotlightMine,
    session?.session_id,
  ]);

  const deactivateCurrentRound = async () => {
    const currentRoundId = effectiveCurrentRound?.id;
    if (!currentRoundId) return;
    setOptimisticRoundsById((prev) => ({
      ...prev,
      [currentRoundId]: { ...(effectiveCurrentRound as PokerSessionRound), is_active: false },
    }));
    try {
      const { error } = await supabase
        .from('poker_session_rounds')
        .update({ is_active: false })
        .eq('id', currentRoundId);
      if (error) console.error('Error deactivating current round:', error);
    } catch (e) {
      console.error('Unexpected error deactivating current round:', e);
    }
  };

  /** Deactivates current round and navigates to next active without creating a new one. */
  const handleEndRoundOnly = () => {
    const currentRoundNumber = effectiveCurrentRound?.round_number;

    // Find the next active round to navigate to (skip the current one).
    const remaining = activeRounds.filter((r) => r.round_number !== currentRoundNumber);
    const navigateTo = remaining.length > 0 ? remaining[0] : null;

    void deactivateCurrentRound().then(() => {
      if (navigateTo) goToRoundWithGuardClear(navigateTo.round_number);
    });
  };

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
      goToRoundWithGuardClear(next.round_number);
      return;
    }

    void deactivateCurrentRound().then(() => {
      goToRoundWithGuardClear(next.round_number);
    });
  };

  const {
    messages: chatMessagesForRound,
    loading: isChatLoading,
    newMessageCountByRound: chatNewMessageCountByRound,
    sendMessage,
    sendSystemMessage,
    sendBotMessage,
    addReaction,
    removeReaction,
    uploadImage: uploadChatImage,
  } = usePokerSessionChat(
    session?.session_id || null,
    currentRound?.round_number || session?.round_number || 1,
    activeUserId,
    chatUserName
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
    // effectiveCurrentRound carries history + optimisticRoundsById; the table's *ForSelectedRound
    // handlers only update those + DB (not usePokerSession state). Spreading stale `session` last
    // would clobber lock/points UI. Remote peers refresh via postgres_changes merging into rounds state
    // (poker_session_rounds in supabase_realtime) and optional round_updated broadcast on session.
    const merged = { ...session, ...effectiveCurrentRound } as PokerSessionState;
    const game_state = deriveDisplayGameState(merged, effectiveCurrentRound);
    return game_state === merged.game_state ? merged : { ...merged, game_state };
  }, [session, effectiveCurrentRound]);

  const displayWinningVote = useMemo((): WinningPoints => {
    if (!displaySession || displaySession.game_state !== 'Playing') {
      return { kind: 'single', points: 0 };
    }
    const participating = (Object.values(displaySession.selections) as PlayerSelection[]).filter(
      (s) => s.points !== -1
    );
    return getWinningVoteFromSelections(participating);
  }, [displaySession]);

  const displayWinningPoints = useMemo(() => {
    return winningVoteToStoredAveragePoints(displayWinningVote);
  }, [displayWinningVote]);

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

    const groupKey = (sel: PlayerSelection): string => {
      if (sel.betweenHighPoints != null) {
        const low = Math.min(sel.points, sel.betweenHighPoints);
        const high = Math.max(sel.points, sel.betweenHighPoints);
        return `between:${low}:${high}`;
      }
      return `single:${sel.points}`;
    };

    const groups = selections.reduce((acc, [userId, selection]) => {
      const sel = selection as PlayerSelection;
      const key = groupKey(sel);
      if (!acc[key]) acc[key] = [];
      acc[key].push({ userId, ...sel });
      return acc;
    }, {} as Record<string, SelectionWithUserId[]>);

    const toTuple = (key: string): [number, number] => {
      if (key.startsWith('between:')) {
        const [, low, high] = key.split(':');
        return [Number(low), 1];
      }
      const p = Number(key.slice(7));
      return [p, 0];
    };

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const [aLow, aTier] = toTuple(a);
      const [bLow, bTier] = toTuple(b);
      if (aLow !== bLow) return aLow - bLow;
      return aTier - bTier;
    });

    const allAbstained =
      sortedKeys.length === 1 && sortedKeys[0] === 'single:-1';

    return sortedKeys
      .filter((key) => allAbstained || key !== 'single:-1')
      .map((key) => {
        const list = groups[key];
        const first = list[0];
        if (key.startsWith('between:')) {
          const low = Math.min(first.points, first.betweenHighPoints!);
          const high = Math.max(first.points, first.betweenHighPoints!);
          return { points: low, betweenHighPoints: high, selections: list };
        }
        return { points: first.points, selections: list };
      });
  }, [displaySession]);

  const updateTicketNumberForSelectedRound = async (ticketNumber: string) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active) return;

    const persisted =
      ticketNumber.trim() || roundTicketPlaceholder(effectiveCurrentRound.round_number);

    // Optimistic UI: update immediately, then persist.
    setOptimisticRoundsById((prev) => ({
      ...prev,
      [effectiveCurrentRound.id]: { ...effectiveCurrentRound, ticket_number: persisted },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ ticket_number: persisted })
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
    const rawActive = displaySession?.ticket_number || '';
    const rawLatest = session?.ticket_number || '';
    const nextTicketNumber = effectiveCurrentRound?.is_active
      ? isSyntheticRoundTicket(rawActive)
        ? ''
        : rawActive
      : isSyntheticRoundTicket(rawLatest)
        ? ''
        : rawLatest;

    setDisplayTicketNumber(nextTicketNumber);
  }, [displaySession?.ticket_number, session?.ticket_number, isTicketInputFocused, effectiveCurrentRound?.is_active]);

  const pointOptions = [...POKER_DECK_POINT_VALUES];

  const activeUserSelection = useMemo(() => {
    if (displaySession && activeUserId && displaySession.selections[activeUserId]) {
      return displaySession.selections[activeUserId];
    }
    return { points: 0, locked: false, name: '' };
  }, [displaySession, activeUserId]);

  const observerIds = useMemo(() => (session as { observer_ids?: string[] } | null)?.observer_ids ?? [], [session]);
  const isObserver = !!(activeUserId && observerIds.includes(activeUserId));
  const totalPlayers = displaySession ? Object.keys(displaySession.selections).length : 0;

  /** Round JSON can omit a player (e.g. roster drift); merge a row so updates match re-join behavior. */
  const ensureActiveUserRoundSelection = useCallback(
    (selections: Record<string, PlayerSelection>): {
      next: Record<string, PlayerSelection>;
      user: PlayerSelection;
      synthetic: boolean;
    } => {
      const existing = selections[activeUserId!];
      if (existing) {
        return { next: selections, user: existing, synthetic: false };
      }
      const fromSession = session?.selections?.[activeUserId!];
      const name =
        (fromSession?.name && String(fromSession.name).trim()) ||
        activeUserDisplayName?.trim() ||
        'Player';
      const synthetic: PlayerSelection = {
        points: 0,
        locked: false,
        name,
      };
      return {
        next: { ...selections, [activeUserId!]: synthetic },
        user: synthetic,
        synthetic: true,
      };
    },
    [activeUserId, session?.selections, activeUserDisplayName]
  );

  const updateUserSelectionForSelectedRound = async (points: number) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;

    const raw = effectiveCurrentRound.selections || {};
    const { next, user } = ensureActiveUserRoundSelection(raw);

    if (user.locked) return;

    const { betweenHighPoints: _omitBetween, ...userRest } = user;
    const newSelections = {
      ...next,
      [activeUserId]: { ...userRest, points },
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

  const updateUserSelectionBetweenForSelectedRound = async (low: number, high: number) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;
    if (low === high) {
      await updateUserSelectionForSelectedRound(low);
      return;
    }
    const a = Math.min(low, high);
    const b = Math.max(low, high);

    const raw = effectiveCurrentRound.selections || {};
    const { next, user } = ensureActiveUserRoundSelection(raw);

    if (user.locked) return;

    const { betweenHighPoints: _b, ...userRest } = user;
    const newSelections = {
      ...next,
      [activeUserId]: { ...userRest, points: a, betweenHighPoints: b },
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
      console.error('Error updating between selection:', error);
    }
  };

  const lockInUserSelectionAtPointsForSelectedRound = async (points: number) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;

    const raw = effectiveCurrentRound.selections || {};
    const { next, user } = ensureActiveUserRoundSelection(raw);
    if (user.locked || user.points === -1) return;

    const { betweenHighPoints: _bd, ...userForLock } = user;
    const newSelections = {
      ...next,
      [activeUserId]: { ...userForLock, points, locked: true },
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
      console.error('Error locking in selection at points:', error);
    }
  };

  const lockInUserSelectionBetweenForSelectedRound = async (low: number, high: number) => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;
    if (low === high) {
      await lockInUserSelectionAtPointsForSelectedRound(low);
      return;
    }
    const a = Math.min(low, high);
    const b = Math.max(low, high);

    const raw = effectiveCurrentRound.selections || {};
    const { next, user } = ensureActiveUserRoundSelection(raw);

    if (user.locked) return;
    if (user.points === -1) return;

    const { betweenHighPoints: _b, ...userRest } = user;
    const newSelections = {
      ...next,
      [activeUserId]: { ...userRest, points: a, betweenHighPoints: b, locked: true },
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
      console.error('Error locking in between selection:', error);
    }
  };

  const toggleLockUserSelectionForSelectedRound = async () => {
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !activeUserId) return;

    const raw = effectiveCurrentRound.selections || {};
    const { next, user } = ensureActiveUserRoundSelection(raw);
    if (user.points === -1) return;

    const newSelections = {
      ...next,
      [activeUserId]: { ...user, locked: !user.locked },
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

    const raw = effectiveCurrentRound.selections || {};
    const { next, user } = ensureActiveUserRoundSelection(raw);

    const isCurrentlyAbstained = user.points === -1;
    const { betweenHighPoints: _ba, ...userForAbstain } = user;
    const newSelection = {
      ...userForAbstain,
      points: isCurrentlyAbstained ? 1 : -1,
      locked: !isCurrentlyAbstained,
    };

    const newSelections = {
      ...next,
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
    if (!effectiveCurrentRound || !effectiveCurrentRound.is_active || !session) return;
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
        (session?.room_id?.trim() || session?.session_id) &&
        effectiveCurrentRound.round_number === 1
      ) {
        const pathSlug = session!.room_id?.trim() || session!.session_id;
        const notificationUrl = teamId
          ? `/teams/${teamId}/poker/${pathSlug}`
          : `/poker/${pathSlug}`;
        await supabase.functions.invoke('admin-send-notification', {
          body: {
            recipients: participantIds.map((id) => ({ userId: id })),
            type: 'poker_session',
            title: `Poker session started`,
            message: 'Click to join the session.',
            url: notificationUrl,
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
    // Replayed rounds require manual reveal; auto-reveal only for fresh rounds (DB default true).
    if (effectiveCurrentRound.auto_reveal_enabled === false) return;

    const selections = effectiveCurrentRound.selections || {};
    const entries = Object.entries(selections);
    // Need at least 1 player to auto-reveal
    if (entries.length === 0) return;

    const allReady = entries.every(([, sel]) => {
      const s = sel as PlayerSelection;
      return s.locked || s.points === -1;
    });

    // Not everyone ready (e.g. someone unlocked): allow a future auto-reveal for this round.
    if (!allReady) {
      autoRevealTriggeredRef.current = null;
      return;
    }

    if (autoRevealTriggeredRef.current !== effectiveCurrentRound.id) {
      autoRevealTriggeredRef.current = effectiveCurrentRound.id;
      // Small delay so the last lock-in animation is visible before reveal
      setTimeout(() => {
        playHandForSelectedRound();
      }, 600);
    }
  }, [effectiveCurrentRound]);

  const replayRoundForSelectedRound = async () => {
    if (!effectiveCurrentRound || !session) return;

    const mergedForDisplay = { ...session, ...effectiveCurrentRound } as PokerSessionState;
    if (deriveDisplayGameState(mergedForDisplay, effectiveCurrentRound) !== 'Playing') return;

    const reactivatingHistory = !effectiveCurrentRound.is_active;

    const pressedBy = (activeUserSelection?.name || '').trim() || 'Someone';

    const selections = effectiveCurrentRound.selections || {};
    const resetSelections: Record<string, PlayerSelection> = {};

    for (const [userId, sel] of Object.entries(selections)) {
      const s = sel as PlayerSelection;
      // Preserve mixed votes (betweenHighPoints) and keep non-abstainers locked so replay
      // returns to Selection without wiping between ranges or forcing re-lock.
      resetSelections[userId] = {
        ...s,
        locked: s.points === -1 ? s.locked : true,
      };
    }

    const nextState = {
      game_state: 'Selection' as const,
      selections: resetSelections,
      average_points: 0,
      auto_reveal_enabled: false as const,
      ...(reactivatingHistory ? { is_active: true as const } : {}),
    };

    const replayedRoundId = effectiveCurrentRound.id;

    setOptimisticRoundsById((prev) => ({
      ...prev,
      [replayedRoundId]: {
        ...((prev[replayedRoundId] ?? effectiveCurrentRound) as PokerSessionRound),
        ...nextState,
      },
    }));

    void sendSystemMessage(`<p>Round replayed by ${pressedBy}</p>`).catch(() => undefined);

    try {
      const { error } = await supabase
        .from('poker_session_rounds')
        .update(nextState)
        .eq('id', replayedRoundId);

      if (error) {
        console.error('Error replaying round:', error);
      }
    } catch (e) {
      console.error('Error replaying round:', e);
    }
  };

  const activateRoundById = async (roundId: string) => {
    const row = roundsForUI.find((r) => r.id === roundId);
    if (!row || row.is_active) return;

    const merged = (session
      ? ({ ...session, ...row } as PokerSessionState)
      : row) as Pick<PokerSessionState, 'game_state' | 'average_points' | 'selections'>;
    if (deriveDisplayGameState(merged, row) !== 'Selection') return;

    setOptimisticRoundsById((prev) => ({
      ...prev,
      [roundId]: { ...((prev[roundId] ?? row) as PokerSessionRound), is_active: true },
    }));

    const { error } = await supabase
      .from('poker_session_rounds')
      .update({ is_active: true })
      .eq('id', roundId);

    if (error) {
      console.error('Error activating round:', error);
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
    if (!effectiveCurrentRound) return;
    const nextPersisted =
      displayTicketNumber.trim() || roundTicketPlaceholder(effectiveCurrentRound.round_number);
    if (nextPersisted !== effectiveCurrentRound.ticket_number) {
      updateTicketNumberForSelectedRound(displayTicketNumber);
    }
  }

  const value: PokerTableContextProps = {
    session,
    activeUserId,
    updateUserSelection: updateUserSelectionForSelectedRound,
    updateUserSelectionBetween: updateUserSelectionBetweenForSelectedRound,
    lockInUserSelectionBetween: lockInUserSelectionBetweenForSelectedRound,
    lockInUserSelectionAtPoints: lockInUserSelectionAtPointsForSelectedRound,
    toggleLockUserSelection: toggleLockUserSelectionForSelectedRound,
    toggleAbstainUserSelection: toggleAbstainUserSelectionForSelectedRound,
    playHand: playHandForSelectedRound,
    replayRound: replayRoundForSelectedRound,
    activateRoundById,
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
    effectiveCurrentRound,
    isViewingHistory: isViewingHistoryEffective,
    canGoBack,
    canGoForward,
    currentRoundIndex,
    goToPreviousRound: goToPreviousRoundWithGuardClear,
    goToNextRound: goToNextRoundWithGuardClear,
    goToCurrentRound: goToCurrentRoundWithGuardClear,
    goToRound: goToRoundWithGuardClear,
    deleteRound,
    chatMessagesForRound,
    chatNewMessageCountByRound,
    chatUnreadCount,
    markChatAsRead,
    isChatLoading,
    sendMessage,
    sendSystemMessage,
    sendBotMessage,
    addReaction,
    removeReaction,
    uploadChatImage,
    handleSendToSlack,
    displaySession,
    displayWinningPoints,
    displayWinningVote,
    cardGroups,
    activeUserSelection,
    totalPlayers,
    isObserver,
    pointOptions,
    pokerPointValueDescriptions,
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
    onEndRoundOnly: handleEndRoundOnly,
    isStartNewRoundDialogOpen,
    setStartNewRoundDialogOpen,
    onStartNewRoundRequest,
    addTicketToQueue,
    commitPendingBrowseRound,
    addTicketsToQueueBatch,
    isQueuePanelOpen,
    setQueuePanelOpen,
    onPokerBack,
    pokerToolbarExtras,
    spotlightRoundNumber,
    isSpotlightMine,
    onSpotlightClick,
  };

  return (
    <>
      <PokerTableContext.Provider value={value}>
        {children}
      </PokerTableContext.Provider>
      <AlertDialog open={spotlightTakeoverOpen} onOpenChange={setSpotlightTakeoverOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take spotlight?</AlertDialogTitle>
            <AlertDialogDescription>
              {spotlightOtherDisplayName
                ? spotlightOtherDisplayName === 'You (another window)'
                  ? 'Spotlight is active in another window. Move it here?'
                  : `${spotlightOtherDisplayName} is currently spotlighting a round. Do you want to take the spotlight?`
                : 'Someone else is currently spotlighting a round. Do you want to take the spotlight?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelSpotlightTakeover}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSpotlightTakeover}>Take spotlight</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}; 
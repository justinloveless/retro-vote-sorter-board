import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { PlayerSelection, PokerSessionState } from '@/hooks/usePokerSession';
import { usePokerSessionHistory, PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { usePokerSessionChat } from '@/hooks/usePokerSessionChat';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';
import { usePokerSlackNotification } from '@/hooks/usePokerSlackNotification';
import { PokerSessionConfig } from '../PokerConfig';
import { ReactNode, Dispatch, SetStateAction } from 'react';

interface PokerTableContextProps {
  session: PokerSessionState | null;
  activeUserId: string | undefined;
  updateUserSelection: (points: number) => void;
  toggleLockUserSelection: () => void;
  toggleAbstainUserSelection: () => void;
  playHand: () => void;
  nextRound: (ticketNumber?: string) => void;
  updateTicketNumber: (ticketNumber: string) => void;
  updateSessionConfig: (config: { presence_enabled?: boolean; send_to_slack?: boolean; }) => void;
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
  chatMessagesForRound: ReturnType<typeof usePokerSessionChat>['messages'];
  isChatLoading: boolean;
  sendMessage: (messageText: string, replyToMessageId?: string) => Promise<boolean>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  uploadChatImage: (file: File) => Promise<string | null>;
  handleSendToSlack: () => Promise<void>;
  displaySession: PokerSessionState | PokerSessionRound | null;
  cardGroups: { points: number; selections: (PlayerSelection & { userId: string; })[]; }[] | null;
  activeUserSelection: PlayerSelection & { points: number; locked: boolean; name: string; };
  totalPlayers: number;
  pointOptions: number[];
  handlePointChange: (increment: boolean) => void;
  handleTicketNumberChange: (value: string) => void;
  handleTicketNumberFocus: () => void;
  handleTicketNumberBlur: () => void;
  setDisplayTicketNumber: React.Dispatch<React.SetStateAction<string>>;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsChatDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNextRoundDialogOpen: boolean;
  setNextRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
}

const PokerTableContext = createContext<PokerTableContextProps | undefined>(undefined);

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
  updateSessionConfig: (config: { presence_enabled?: boolean; send_to_slack?: boolean; }) => void;
  deleteAllRounds: () => void;
  presentUserIds: string[];
  children: ReactNode;
  isMobile: boolean;
  teamId?: string;
  userRole?: string;
  requestedRoundNumber?: number | null;
  isNextRoundDialogOpen: boolean;
  setNextRoundDialogOpen: Dispatch<SetStateAction<boolean>>;
}

export const PokerTableProvider: React.FC<PokerTableProviderProps> = ({ children, ...props }) => {
  const {
    session, activeUserId, updateUserSelection, teamId, isMobile,
    toggleLockUserSelection, toggleAbstainUserSelection, playHand,
    deleteAllRounds, updateSessionConfig,
    nextRound,
    updateTicketNumber, userRole, presentUserIds, requestedRoundNumber,
    isNextRoundDialogOpen, setNextRoundDialogOpen
  } = props;

  const [displayTicketNumber, setDisplayTicketNumber] = useState('');
  const [isTicketInputFocused, setIsTicketInputFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { isSlackInstalled } = useSlackIntegration(teamId);
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
  } = usePokerSessionHistory(session?.session_id || null, requestedRoundNumber || undefined);

  const {
    messages: chatMessagesForRound,
    loading: isChatLoading,
    sendMessage,
    addReaction,
    removeReaction,
    uploadImage: uploadChatImage,
  } = usePokerSessionChat(
    session?.session_id || null,
    currentRound?.round_number || session?.round_number || 1,
    activeUserId,
    session?.selections[activeUserId || '']?.name
  );

  const displaySession = useMemo(() => {
    return isViewingHistory && currentRound ? currentRound : session;
  }, [isViewingHistory, currentRound, session]);

  const handleSendToSlack = async () => {
    if (!displaySession || !teamId) return;
    setIsSending(true);
    await sendPokerRoundToSlack(
      teamId,
      displaySession.ticket_number,
      displaySession.ticket_title,
      displaySession.selections,
      displaySession.average_points,
      chatMessagesForRound
    );
    setIsSending(false);
  };

  const cardGroups = useMemo(() => {
    if (!displaySession || displaySession.game_state !== 'Playing') {
      return null;
    }
    const selections = Object.entries(displaySession.selections);
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
    return sortedGroupKeys.map(points => ({
      points,
      selections: groups[points],
    }));
  }, [displaySession]);

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
      updateTicketNumber(value);
    }, 500),
    [updateTicketNumber]
  );

  React.useEffect(() => {
    if (displaySession?.ticket_number && !isTicketInputFocused) {
      setDisplayTicketNumber(displaySession.ticket_number);
    } else if (!isTicketInputFocused) {
      setDisplayTicketNumber(displaySession?.ticket_number || '');
    }
  }, [displaySession?.ticket_number, isTicketInputFocused]);

  const pointOptions = [1, 2, 3, 5, 8, 13, 21];

  const activeUserSelection = useMemo(() => {
    if (displaySession && activeUserId && displaySession.selections[activeUserId]) {
      return displaySession.selections[activeUserId];
    }
    return { points: 0, locked: false, name: '' };
  }, [displaySession, activeUserId]);

  const totalPlayers = displaySession ? Object.keys(displaySession.selections).length : 0;

  const handlePointChange = (increment: boolean) => {
    if (isViewingHistory) return;
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
    updateUserSelection(pointOptions[newIndex]);
  };

  const handleTicketNumberChange = (value: string) => {
    if (isViewingHistory) return;
    setDisplayTicketNumber(value);
    debouncedUpdateTicketNumber(value);
  }

  const handleTicketNumberFocus = () => {
    setIsTicketInputFocused(true);
  }

  const handleTicketNumberBlur = () => {
    setIsTicketInputFocused(false);
    debouncedUpdateTicketNumber.cancel();
    if (session && displayTicketNumber !== session.ticket_number) {
      updateTicketNumber(displayTicketNumber);
    }
  }

  const value: PokerTableContextProps = {
    session,
    activeUserId,
    updateUserSelection,
    toggleLockUserSelection,
    toggleAbstainUserSelection,
    playHand,
    nextRound,
    updateTicketNumber,
    updateSessionConfig,
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
    rounds,
    currentRound,
    isViewingHistory,
    canGoBack,
    canGoForward,
    goToPreviousRound,
    goToNextRound,
    goToCurrentRound,
    chatMessagesForRound,
    isChatLoading,
    sendMessage,
    addReaction,
    removeReaction,
    uploadChatImage,
    handleSendToSlack,
    displaySession,
    cardGroups,
    activeUserSelection,
    totalPlayers,
    pointOptions,
    handlePointChange,
    handleTicketNumberChange,
    handleTicketNumberFocus,
    handleTicketNumberBlur,
    setDisplayTicketNumber,
    setIsDrawerOpen,
    setIsChatDrawerOpen,
    isNextRoundDialogOpen,
    setNextRoundDialogOpen,
  };

  return (
    <PokerTableContext.Provider value={value}>
      {children}
    </PokerTableContext.Provider>
  );
}; 
import { PokerSessionState } from "@/hooks/usePokerSession";
import type { PokerHistoryTeamRoute } from "@/hooks/usePokerSessionHistory";
import React, { useState } from "react";
import { PokerTableProvider, usePokerTable } from "./PokerTableComponent/context";
import { PokerTableContent } from "./PokerTableComponent";
import { NextRoundDialog } from "./NextRoundDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTicketQueue } from "@/hooks/useTicketQueue";
import { TicketQueuePanel } from "./TicketQueuePanel";

interface PokerTableProps {
    session: PokerSessionState | null;
    activeUserId: string | undefined;
    updateUserSelection: (points: number) => void;
    toggleLockUserSelection: () => void;
    toggleAbstainUserSelection: () => void;
    playHand: () => void;
    nextRound: (ticketNumber?: string) => void;
    startNewRound: (ticketNumber?: string) => void;
    updateTicketNumber: (ticketNumber: string) => void;
    updateSessionConfig: (config: any) => void;
    deleteAllRounds: () => void;
    presentUserIds: string[];
    teamId?: string;
    userRole?: string;
    requestedRoundNumber?: number | null;
    /** When set (team poker page), round history resolves session id from URL — avoids wrong session_id on merged state. */
    pokerRouteContext?: PokerHistoryTeamRoute | null;
}

const TicketQueuePanelConnected: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    const {
        addTicketToQueue,
        ticketQueue,
        removeTicketFromQueue,
        reorderQueue,
        clearQueue,
        isQueuePanelOpen,
        setQueuePanelOpen,
        teamId,
        rounds,
        playQueueTicketNow,
        playQueueTicketNowDisabled,
        playQueueNowBusyId,
    } = usePokerTable();
    return (
        <TicketQueuePanel
            isOpen={isQueuePanelOpen}
            onOpenChange={setQueuePanelOpen}
            teamId={teamId}
            rounds={rounds}
            queue={ticketQueue}
            onAddTicket={addTicketToQueue}
            onRemoveTicket={removeTicketFromQueue}
            onReorderQueue={reorderQueue}
            onClearQueue={clearQueue}
            onPlayQueueTicketNow={playQueueTicketNow}
            playQueueTicketNowDisabled={playQueueTicketNowDisabled}
            playQueueNowBusyId={playQueueNowBusyId}
            isMobile={isMobile}
        />
    );
};

const PokerTable: React.FC<PokerTableProps> = (props) => {
    const isMobile = useIsMobile();
    const { startNewRound, ...providerProps } = props;
    const [isNextRoundDialogOpen, setNextRoundDialogOpen] = useState(false);
    const [isStartNewRoundDialogOpen, setStartNewRoundDialogOpen] = useState(false);
    const [isQueuePanelOpen, setQueuePanelOpen] = useState(false);
    const ticketQueue = useTicketQueue(providerProps.teamId);

    const leaveObserverMode = () => {
        const observerIds = (props.session as { observer_ids?: string[] })?.observer_ids ?? [];
        props.updateSessionConfig({ observer_ids: observerIds.filter(id => id !== props.activeUserId) });
    };

    const enterObserverMode = () => {
        const observerIds = (props.session as { observer_ids?: string[] })?.observer_ids ?? [];
        if (!props.activeUserId || observerIds.includes(props.activeUserId)) return;
        props.updateSessionConfig({ observer_ids: [...observerIds, props.activeUserId] });
    };

    const handleNextRoundRequest = async () => {
        // Auto-advance: if there are queued tickets, pop the next one
        const next = await ticketQueue.popNext();
        if (next) {
            props.nextRound(next.ticket_key);
        } else {
            setNextRoundDialogOpen(true);
        }
    };

    const handleNextRoundConfirm = (ticketNumber?: string) => {
        props.nextRound(ticketNumber);
        setNextRoundDialogOpen(false);
    };

    const handleStartNewRoundRequest = async () => {
        // Start a parallel round without deactivating other active rounds.
        const next = await ticketQueue.popNext();
        if (next) {
            startNewRound(next.ticket_key);
        } else {
            setStartNewRoundDialogOpen(true);
        }
    };

    const handleStartNewRoundConfirm = (ticketNumber?: string) => {
        startNewRound(ticketNumber);
        setStartNewRoundDialogOpen(false);
    };

    return (
        <PokerTableProvider 
            {...providerProps}
            startNewRound={startNewRound}
            leaveObserverMode={leaveObserverMode}
            enterObserverMode={enterObserverMode}
            isMobile={isMobile}
            isNextRoundDialogOpen={isNextRoundDialogOpen}
            setNextRoundDialogOpen={setNextRoundDialogOpen}
            onNextRoundRequest={handleNextRoundRequest}
            isStartNewRoundDialogOpen={isStartNewRoundDialogOpen}
            setStartNewRoundDialogOpen={setStartNewRoundDialogOpen}
            onStartNewRoundRequest={handleStartNewRoundRequest}
            ticketQueue={ticketQueue}
            isQueuePanelOpen={isQueuePanelOpen}
            setQueuePanelOpen={setQueuePanelOpen}
        >
            <PokerTableContent />
            <NextRoundDialog 
                isOpen={isNextRoundDialogOpen}
                onOpenChange={setNextRoundDialogOpen}
                onConfirm={handleNextRoundConfirm}
            />
            <NextRoundDialog
                isOpen={isStartNewRoundDialogOpen}
                onOpenChange={setStartNewRoundDialogOpen}
                onConfirm={handleStartNewRoundConfirm}
                title="Start New Round"
                description="Start another active round in parallel. You can enter a ticket number, or leave it blank."
                confirmLabel="Start Round"
            />
            <TicketQueuePanelConnected isMobile={isMobile} />
        </PokerTableProvider>
    )
}

export default PokerTable; 
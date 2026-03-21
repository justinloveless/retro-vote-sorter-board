import { PokerSessionState } from "@/hooks/usePokerSession";
import type { PokerHistoryTeamRoute } from "@/hooks/usePokerSessionHistory";
import React, { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { PokerTableProvider, usePokerTable } from "./PokerTableComponent/context";
import { PokerTableContent } from "./PokerTableComponent";
import { NextRoundDialog } from "./NextRoundDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { TicketQueuePanel } from "./TicketQueuePanel";

interface PokerTableProps {
    session: PokerSessionState | null;
    activeUserId: string | undefined;
    /** Used for chat sender name when there is no row in round selections (observers, impersonation). */
    activeUserDisplayName?: string;
    updateUserSelection: (points: number) => void;
    toggleLockUserSelection: () => void;
    toggleAbstainUserSelection: () => void;
    playHand: () => void;
    nextRound: (ticketNumber?: string) => void;
    startNewRound: (ticketNumber?: string, ticketTitle?: string | null) => void;
    startNewRounds?: (tickets: Array<{ ticketNumber: string; ticketTitle?: string | null }>) => Promise<void>;
    updateTicketNumber: (ticketNumber: string, ticketTitle?: string | null) => void;
    updateSessionConfig: (config: any) => void;
    deleteAllRounds: () => void;
    presentUserIds: string[];
    teamId?: string;
    userRole?: string;
    requestedRoundNumber?: number | null;
    /** When set (team poker page), round history resolves session id from URL — avoids wrong session_id on merged state. */
    pokerRouteContext?: PokerHistoryTeamRoute | null;
    onPokerBack?: () => void;
    pokerToolbarExtras?: ReactNode;
}

/** Writes the viewed round to `?round=` so session links can target a specific round. */
const PokerRoundUrlSync: React.FC = () => {
    const { currentRound } = usePokerTable();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const n = currentRound?.round_number;
        if (n == null || !Number.isFinite(n)) return;

        if (searchParams.get('round') === String(n)) return;

        const next = new URLSearchParams(searchParams);
        next.set('round', String(n));
        setSearchParams(next, { replace: true });
    }, [currentRound?.round_number, searchParams, setSearchParams]);

    return null;
};

const TicketQueuePanelConnected: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    const {
        addTicketToQueue,
        addTicketsToQueueBatch,
        isQueuePanelOpen,
        setQueuePanelOpen,
        teamId,
        rounds,
    } = usePokerTable();
    return (
        <TicketQueuePanel
            key={teamId ?? 'no-team'}
            isOpen={isQueuePanelOpen}
            onOpenChange={setQueuePanelOpen}
            teamId={teamId}
            rounds={rounds}
            onAddTicket={addTicketToQueue}
            onAddTicketsBatch={addTicketsToQueueBatch}
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

    const leaveObserverMode = () => {
        const observerIds = (props.session as { observer_ids?: string[] })?.observer_ids ?? [];
        props.updateSessionConfig({ observer_ids: observerIds.filter(id => id !== props.activeUserId) });
    };

    const enterObserverMode = () => {
        const observerIds = (props.session as { observer_ids?: string[] })?.observer_ids ?? [];
        if (!props.activeUserId || observerIds.includes(props.activeUserId)) return;
        props.updateSessionConfig({ observer_ids: [...observerIds, props.activeUserId] });
    };

    const handleNextRoundRequest = () => {
        setNextRoundDialogOpen(true);
    };

    const handleNextRoundConfirm = (ticketNumber?: string) => {
        props.nextRound(ticketNumber);
        setNextRoundDialogOpen(false);
    };

    const handleStartNewRoundRequest = () => {
        setStartNewRoundDialogOpen(true);
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
            isQueuePanelOpen={isQueuePanelOpen}
            setQueuePanelOpen={setQueuePanelOpen}
        >
            <PokerRoundUrlSync />
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
                description="Start another active round in parallel. Enter the ticket key for the new round."
                confirmLabel="Start Round"
            />
            <TicketQueuePanelConnected isMobile={isMobile} />
        </PokerTableProvider>
    )
}

export default PokerTable; 
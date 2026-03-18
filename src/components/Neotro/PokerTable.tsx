import { PokerSessionState } from "@/hooks/usePokerSession";
import React, { useState } from "react";
import { PokerTableProvider } from "./PokerTableComponent/context";
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
    updateTicketNumber: (ticketNumber: string) => void;
    updateSessionConfig: (config: any) => void;
    deleteAllRounds: () => void;
    presentUserIds: string[];
    teamId?: string;
    userRole?: string;
    requestedRoundNumber?: number | null;
}

const PokerTable: React.FC<PokerTableProps> = (props) => {
    const isMobile = useIsMobile();
    const [isNextRoundDialogOpen, setNextRoundDialogOpen] = useState(false);
    const [isQueuePanelOpen, setQueuePanelOpen] = useState(false);
    const ticketQueue = useTicketQueue(props.teamId);

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

    return (
        <PokerTableProvider 
            {...props} 
            leaveObserverMode={leaveObserverMode}
            enterObserverMode={enterObserverMode}
            isMobile={isMobile}
            isNextRoundDialogOpen={isNextRoundDialogOpen}
            setNextRoundDialogOpen={setNextRoundDialogOpen}
            onNextRoundRequest={handleNextRoundRequest}
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
            <TicketQueuePanel
                isOpen={isQueuePanelOpen}
                onOpenChange={setQueuePanelOpen}
                teamId={props.teamId}
                queue={ticketQueue.queue}
                onAddTicket={ticketQueue.addTicket}
                onRemoveTicket={ticketQueue.removeTicket}
                onReorderQueue={ticketQueue.reorderQueue}
                onClearQueue={ticketQueue.clearQueue}
                isMobile={isMobile}
            />
        </PokerTableProvider>
    )
}

export default PokerTable; 
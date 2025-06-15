import { PokerSessionState } from "@/hooks/usePokerSession";
import React, { useState } from "react";
import { PokerTableProvider } from "./PokerTableComponent/context";
import { PokerTableContent } from "./PokerTableComponent";
import { NextRoundDialog } from "./NextRoundDialog";
import { useIsMobile } from "@/hooks/use-mobile";

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
}

const PokerTable: React.FC<PokerTableProps> = (props) => {
    const isMobile = useIsMobile();
    const [isNextRoundDialogOpen, setNextRoundDialogOpen] = useState(false);

    const handleNextRoundConfirm = (ticketNumber?: string) => {
        props.nextRound(ticketNumber);
        setNextRoundDialogOpen(false);
    };

    return (
        <PokerTableProvider 
            {...props} 
            isMobile={isMobile}
            isNextRoundDialogOpen={isNextRoundDialogOpen}
            setNextRoundDialogOpen={setNextRoundDialogOpen}
        >
            <PokerTableContent />
            <NextRoundDialog 
                isOpen={isNextRoundDialogOpen}
                onOpenChange={setNextRoundDialogOpen}
                onConfirm={handleNextRoundConfirm}
            />
        </PokerTableProvider>
    )
}

export default PokerTable; 
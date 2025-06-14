import React from 'react';
import { PokerSession } from '@/hooks/usePokerSession';
import { useIsMobile } from '@/hooks/use-mobile';
import { PokerTableProvider, usePokerTable } from './context';
import { MobileView } from './MobileView';
import { DesktopView } from './DesktopView';
import { PokerSessionConfig } from '../PokerConfig';
import "@/components/Neotro/neotro.css";

interface PokerTableProps {
  session: PokerSession | null;
  activeUserId: string | undefined;
  updateUserSelection: (points: number) => void;
  toggleLockUserSelection: () => void;
  toggleAbstainUserSelection: () => void;
  playHand: () => void;
  nextRound: () => void;
  updateTicketNumber: (ticketNumber: string) => void;
  updateSessionConfig: (config: Partial<PokerSessionConfig>) => void;
  deleteAllRounds: () => void;
  presentUserIds: string[];
  teamId?: string;
  userRole?: string;
}

const PokerTableContent: React.FC = () => {
    const { isMobile, session } = usePokerTable();

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
            </div>
        );
    }

    return isMobile ? <MobileView /> : <DesktopView />;
}

const PokerTable: React.FC<PokerTableProps> = (props) => {
    const isMobile = useIsMobile();

    return (
        <PokerTableProvider {...props} isMobile={isMobile}>
            <PokerTableContent />
        </PokerTableProvider>
    );
};

export default PokerTable; 
import React, { useContext } from 'react';
import { PokerTableContext } from './context';
import { MobileView } from './MobileView';
import { DesktopView } from './DesktopView';
import { PokerAdvisorPanel } from '@/components/Neotro/PokerAdvisorPanel';
import "@/components/Neotro/neotro.css";

export const PokerTableContent: React.FC = () => {
    const context = useContext(PokerTableContext);

    if (!context) {
        // During HMR the provider context can temporarily be unavailable
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg text-muted-foreground">Loading Session...</div>
            </div>
        );
    }

    const { isMobile, session } = context;

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg text-muted-foreground">Loading Session...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {isMobile ? <MobileView /> : <DesktopView />}
            </div>
            <PokerAdvisorPanel />
        </div>
    );
}
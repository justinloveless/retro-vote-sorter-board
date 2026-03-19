import React, { useContext } from 'react';
import { PokerTableContext, type PokerTableContextProps } from './context';
import { MobileView } from './MobileView';
import { DesktopView } from './DesktopView';
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

    return isMobile ? <MobileView /> : <DesktopView />;
}
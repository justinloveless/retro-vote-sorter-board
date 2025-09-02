import React from 'react';
import { usePokerTable } from './context.tsx';
import { MobileView } from './MobileView.tsx';
import { DesktopView } from './DesktopView.tsx';
import "../neotro.css";

export const PokerTableContent: React.FC = () => {
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
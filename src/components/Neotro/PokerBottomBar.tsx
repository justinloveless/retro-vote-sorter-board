import React from 'react';
import { MessageCircle, ListOrdered, Search, GalleryHorizontalEnd, Settings, Eye, EyeOff, Menu } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';

export interface PanelVisibility {
  chat: boolean;
  queue: boolean;
  jiraBrowser: boolean;
  roundSelector: boolean;
  settings: boolean;
  details?: boolean;
}

interface PokerBottomBarProps {
  visibility: PanelVisibility;
  onToggle: (panel: keyof PanelVisibility) => void;
  isJiraConfigured: boolean;
  onSettingsClick?: () => void;
  isObserver?: boolean;
  isViewingHistory?: boolean;
  onEnterObserverMode?: () => void;
  onLeaveObserverMode?: () => void;
  chatUnreadCount?: number;
  /** When true, shows Details panel (for mobile) */
  isMobile?: boolean;
  /** When isMobile, only show these panels (default: all) */
  mobilePanelKeys?: (keyof PanelVisibility)[];
}

const PANELS: { key: keyof PanelVisibility; icon: React.ElementType; label: string; requiresJira?: boolean; mobileOnly?: boolean }[] = [
  { key: 'details', icon: Menu, label: 'Details', mobileOnly: true },
  { key: 'queue', icon: ListOrdered, label: 'Queue' },
  { key: 'jiraBrowser', icon: Search, label: 'Jira Browser', requiresJira: true },
  { key: 'roundSelector', icon: GalleryHorizontalEnd, label: 'Round Selector' },
  { key: 'chat', icon: MessageCircle, label: 'Chat' },
  { key: 'settings', icon: Settings, label: 'Settings' },
];

export const PokerBottomBar: React.FC<PokerBottomBarProps> = ({
  visibility,
  onToggle,
  isJiraConfigured,
  onSettingsClick,
  isObserver = false,
  isViewingHistory = false,
  onEnterObserverMode,
  onLeaveObserverMode,
  chatUnreadCount = 0,
  isMobile = false,
  mobilePanelKeys,
}) => {
  const showObserverButton = !isViewingHistory && (onEnterObserverMode || onLeaveObserverMode);
  const panels = PANELS.filter(
    (p) => (!p.requiresJira || isJiraConfigured) &&
      (p.key !== 'settings' || visibility.settings) &&
      (!p.mobileOnly || isMobile) &&
      (!isMobile || !mobilePanelKeys || mobilePanelKeys.includes(p.key)) &&
      !(isMobile && p.key === 'details')
  );
  return (
    <div className="w-full flex items-center justify-center gap-1 py-2 px-3 bg-background/80 backdrop-blur border-t border-border">
      {showObserverButton && (
        <>
        <Tooltip>
          <TooltipTrigger asChild>
            <NeotroPressableButton
              isActive={isObserver}
              onClick={() => (isObserver ? onLeaveObserverMode : onEnterObserverMode)?.()}
              aria-label={isObserver ? 'Leave observer mode' : 'Join as observer'}
            >
              {isObserver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </NeotroPressableButton>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isObserver ? 'Leave observer mode' : 'Join as observer'}
          </TooltipContent>
        </Tooltip>
        <div className="w-px h-5 bg-border mx-1" aria-hidden />
        </>
      )}
      {panels.map(({ key, icon: Icon, label }) => {
        const isSettings = key === 'settings';
        const isActive = isSettings ? false : visibility[key];
        const showChatBadge = key === 'chat' && chatUnreadCount > 0;
        const badgeDisplay = chatUnreadCount > 9 ? '9+' : String(chatUnreadCount);
        return (
        <React.Fragment key={key}>
        {isSettings && <div className="w-px h-5 bg-border mx-1" aria-hidden />}
        <Tooltip>
          <TooltipTrigger asChild>
            <NeotroPressableButton
              isActive={isActive}
              onClick={() => (isSettings && onSettingsClick ? onSettingsClick() : onToggle(key))}
              aria-label={isSettings ? 'Open Settings' : `${visibility[key] ? 'Hide' : 'Show'} ${label}`}
              className="relative"
            >
              <Icon className="h-4 w-4" />
              {showChatBadge && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-medium">
                  {badgeDisplay}
                </span>
              )}
            </NeotroPressableButton>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isSettings ? 'Settings' : (visibility[key] ? 'Hide' : 'Show') + ' ' + label}
          </TooltipContent>
        </Tooltip>
        </React.Fragment>
      );})}
    </div>
  );
};

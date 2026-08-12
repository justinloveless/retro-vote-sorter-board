import React from 'react';
import { MessageCircle, Search, GalleryHorizontalEnd, Settings, Eye, EyeOff, Menu, Spotlight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';

function spotlightHolderInitials(name: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

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
  isViewingHistory: _isViewingHistory = false,
  onEnterObserverMode,
  onLeaveObserverMode,
  chatUnreadCount = 0,
  isMobile = false,
  mobilePanelKeys,
}) => {
  const showObserverButton = !!(onEnterObserverMode || onLeaveObserverMode);
  const {
    isSpotlightMine,
    spotlightHolderDisplayName,
    spotlightHolderAvatarName,
    spotlightHolderAvatarUrl,
    onSpotlightClick,
  } = usePokerTable();
  const spotlightButtonLabel = isSpotlightMine
    ? 'Stop spotlighting'
    : spotlightHolderDisplayName
      ? `${spotlightHolderDisplayName} has the spotlight — click to take it`
      : 'Spotlight this round';
  const spotlightButtonAriaLabel = isSpotlightMine
    ? 'Stop spotlighting'
    : spotlightHolderDisplayName
      ? `Take spotlight from ${spotlightHolderDisplayName}`
      : 'Spotlight this round';
  const panels = PANELS.filter(
    (p) => (!p.requiresJira || isJiraConfigured) &&
      (p.key !== 'settings' || visibility.settings) &&
      (!p.mobileOnly || isMobile) &&
      (!isMobile || !mobilePanelKeys || mobilePanelKeys.includes(p.key)) &&
      !(isMobile && p.key === 'details')
  );
  return (
    <div className="w-full flex items-center justify-center gap-1 py-2 px-3 bg-background/95 border-t border-border supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-sm">
      {showObserverButton && (
        <div className="contents">
        {isMobile && (
          <div className="contents">
            {spotlightHolderDisplayName && (
              <span
                className="inline-flex px-0.5"
                title={`${spotlightHolderDisplayName} has the spotlight`}
                aria-live="polite"
              >
                <Avatar className="h-6 w-6 ring-2 ring-amber-400/70">
                  <AvatarImage
                    src={spotlightHolderAvatarUrl ?? undefined}
                    alt={spotlightHolderAvatarName || spotlightHolderDisplayName}
                  />
                  <AvatarFallback className="bg-amber-500/20 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                    {spotlightHolderInitials(
                      spotlightHolderAvatarName || spotlightHolderDisplayName
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">{`${spotlightHolderDisplayName} has the spotlight`}</span>
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <NeotroPressableButton
                  variant="gold"
                  isActive={isSpotlightMine}
                  onClick={onSpotlightClick}
                  aria-label={spotlightButtonAriaLabel}
                >
                  <Spotlight className="h-4 w-4" />
                </NeotroPressableButton>
              </TooltipTrigger>
              <TooltipContent side="top">
                {spotlightButtonLabel}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
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
        </div>
      )}
      {panels.map(({ key, icon: Icon, label }) => {
        const isSettings = key === 'settings';
        const isActive = isSettings ? false : visibility[key];
        const showChatBadge = key === 'chat' && chatUnreadCount > 0;
        const badgeDisplay = chatUnreadCount > 9 ? '9+' : String(chatUnreadCount);
        return (
        <div key={key} className="contents">
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
        </div>
      );})}
    </div>
  );
};

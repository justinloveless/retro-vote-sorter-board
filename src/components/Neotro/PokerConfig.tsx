import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBackground } from '@/contexts/BackgroundContext';

const POKER_HIDE_BG_KEY = 'poker-disable-background-effects';

export interface PokerSessionConfig {
  room_id?: string | null;
  presence_enabled?: boolean;
  send_to_slack?: boolean;
  /** When true (default), non-spotlight users follow the spotlight holder's round. */
  spotlight_follow_enabled?: boolean;
  observer_ids?: string[];
  selections?: Record<string, { name?: string }>;
  team_id?: string | null;
}

interface Participant {
  userId: string;
  name: string;
}

interface PokerConfigProps {
  config: PokerSessionConfig;
  onUpdateConfig: (config: Partial<PokerSessionConfig>) => void;
  onDeleteAllRounds: () => void;
  isSlackIntegrated: boolean;
  userRole?: string;
  teamId?: string | null;
  /** When true, renders icon-only trigger with tooltip */
  iconOnly?: boolean;
  /** Controlled mode: when provided, dialog open state is controlled by parent (no trigger rendered) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const PokerConfig: React.FC<PokerConfigProps> = ({
  config,
  onUpdateConfig,
  onDeleteAllRounds,
  isSlackIntegrated,
  userRole,
  teamId,
  iconOnly = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange : setInternalOpen;
  const [presenceEnabled, setPresenceEnabled] = useState(config.presence_enabled !== false);
  const [sendToSlack, setSendToSlack] = useState(config.send_to_slack === true);
  const [spotlightFollowEnabled, setSpotlightFollowEnabled] = useState(
    config.spotlight_follow_enabled !== false
  );
  const [observerIds, setObserverIds] = useState<string[]>(config.observer_ids ?? []);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const { hideEffects, setHideEffects } = useBackground();
  const [bgDisabled, setBgDisabled] = useState(() => localStorage.getItem(POKER_HIDE_BG_KEY) === 'true');

  const canDelete = !userRole || userRole === 'admin' || userRole === 'owner';

  useEffect(() => {
    setPresenceEnabled(config.presence_enabled !== false);
    setSendToSlack(config.send_to_slack === true);
    setSpotlightFollowEnabled(config.spotlight_follow_enabled !== false);
    setObserverIds(config.observer_ids ?? []);
  }, [config.presence_enabled, config.send_to_slack, config.spotlight_follow_enabled, config.observer_ids]);

  useEffect(() => {
    if (!isOpen) return;
    const loadParticipants = async () => {
      setParticipantsLoading(true);
      const effectiveTeamId = teamId ?? config.team_id;
      if (effectiveTeamId) {
        const { data: members } = await supabase.from('team_members').select('user_id').eq('team_id', effectiveTeamId);
        const userIds = (members ?? []).map(m => m.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, nickname').in('id', userIds);
          setParticipants((profiles ?? []).map(p => ({ userId: p.id, name: p.nickname || p.full_name || 'Player' })));
        } else {
          setParticipants([]);
        }
      } else {
        const selectionIds = Object.keys(config.selections ?? {});
        const obsIds = config.observer_ids ?? [];
        const allIds = [...new Set([...selectionIds, ...obsIds])];
        if (allIds.length === 0) {
          setParticipants([]);
          setParticipantsLoading(false);
          return;
        }
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, nickname').in('id', allIds);
        const nameFromSelections = (uid: string) => (config.selections ?? {})[uid]?.name;
        setParticipants(allIds.map(uid => ({
          userId: uid,
          name: nameFromSelections(uid) ?? (profiles ?? []).find(p => p.id === uid)?.nickname ?? (profiles ?? []).find(p => p.id === uid)?.full_name ?? 'Player',
        })));
      }
      setParticipantsLoading(false);
    };
    loadParticipants();
  }, [isOpen, teamId, config.team_id, config.selections, config.observer_ids]);

  const handleSave = () => {
    onUpdateConfig({
      presence_enabled: presenceEnabled,
      send_to_slack: sendToSlack,
      spotlight_follow_enabled: spotlightFollowEnabled,
      observer_ids: observerIds,
    });
    setIsOpen(false);
  };

  const handleConfigChange = (key: keyof PokerSessionConfig, value: any) => {
    setPresenceEnabled(key === 'presence_enabled' ? value : presenceEnabled);
    setSendToSlack(key === 'send_to_slack' ? value : sendToSlack);
    setSpotlightFollowEnabled(key === 'spotlight_follow_enabled' ? value : spotlightFollowEnabled);
  };

  const toggleObserver = (userId: string) => {
    setObserverIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const triggerButton = iconOnly ? (
    <Button variant="outline" size="icon" className="h-8 w-8">
      <Settings className="h-4 w-4" />
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="bg-primary/20 backdrop-blur border-primary/30 text-primary hover:bg-white/30">
      <Settings className="h-4 w-4 mr-2" />
      Settings
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (iconOnly ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                {triggerButton}
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>
          {triggerButton}
        </DialogTrigger>
      ))}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="presence-enabled">Enable Presence Detection</Label>
                <Switch
                  id="presence-enabled"
                  checked={presenceEnabled}
                  onCheckedChange={(checked) => handleConfigChange('presence_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="send-to-slack">Send Round Results to Slack</Label>
                <Switch
                  id="send-to-slack"
                  checked={sendToSlack}
                  onCheckedChange={(checked) => handleConfigChange('send_to_slack', checked)}
                  disabled={!isSlackIntegrated}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="spotlight-follow">Follow spotlight ticket</Label>
                  <p className="text-xs text-muted-foreground">
                    When someone has the spotlight, everyone else jumps to the ticket they select.
                  </p>
                </div>
                <Switch
                  id="spotlight-follow"
                  checked={spotlightFollowEnabled}
                  onCheckedChange={(checked) => handleConfigChange('spotlight_follow_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="disable-bg-effects">Disable Background Effects</Label>
                <Switch
                  id="disable-bg-effects"
                  checked={bgDisabled}
                  onCheckedChange={(checked) => {
                    setBgDisabled(checked);
                    setHideEffects(checked);
                    localStorage.setItem(POKER_HIDE_BG_KEY, String(checked));
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {participants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Observers
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Observers can chat, use the queue, and see revealed cards, but do not play a hand or have a slot on the table.
                </p>
              </CardHeader>
              <CardContent>
                {participantsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading participants...</p>
                ) : (
                  <ScrollArea className="h-[180px] rounded-md border p-3">
                    <div className="space-y-2">
                      {participants.map(({ userId, name }) => (
                        <div key={userId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`observer-${userId}`}
                            checked={observerIds.includes(userId)}
                            onCheckedChange={() => toggleObserver(userId)}
                          />
                          <Label htmlFor={`observer-${userId}`} className="text-sm font-normal cursor-pointer flex-1">
                            {name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}

          {canDelete && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Delete All Previous Rounds
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all previous rounds and chat history for this session. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDeleteAllRounds}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 
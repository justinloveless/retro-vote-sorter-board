import React, { useState } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Label } from '../../components/ui/label.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog.tsx';
import { Settings } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '../../components/ui/alert-dialog.tsx';

export interface PokerSessionConfig {
  room_id?: string | null;
  presence_enabled?: boolean;
  send_to_slack?: boolean;
}

interface PokerConfigProps {
  config: PokerSessionConfig;
  onUpdateConfig: (config: Partial<PokerSessionConfig>) => void;
  onDeleteAllRounds: () => void;
  isSlackIntegrated: boolean;
  userRole?: string;
}

export const PokerConfig: React.FC<PokerConfigProps> = ({
  config,
  onUpdateConfig,
  onDeleteAllRounds,
  isSlackIntegrated,
  userRole,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [presenceEnabled, setPresenceEnabled] = useState(config.presence_enabled !== false);
  const [sendToSlack, setSendToSlack] = useState(config.send_to_slack === true);

  const canDelete = !userRole || userRole === 'admin' || userRole === 'owner';

  const handleSave = () => {
    onUpdateConfig({
      presence_enabled: presenceEnabled,
      send_to_slack: sendToSlack,
    });
    setIsOpen(false);
  };

  const handleConfigChange = (key: keyof PokerSessionConfig, value: any) => {
    setPresenceEnabled(key === 'presence_enabled' ? value : presenceEnabled);
    setSendToSlack(key === 'send_to_slack' ? value : sendToSlack);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-primary/20 backdrop-blur border-primary/30 text-primary hover:bg-white/30">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
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
            </CardContent>
          </Card>

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
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface PokerSessionConfig {
  presence_enabled: boolean;
  send_to_slack: boolean;
}

interface PokerConfigProps {
  config: Partial<PokerSessionConfig> | null;
  onUpdateConfig: (config: Partial<PokerSessionConfig>) => void;
  onDeleteAllRounds: () => void;
}

export const PokerConfig: React.FC<PokerConfigProps> = ({ config, onUpdateConfig, onDeleteAllRounds }) => {
  const [localConfig, setLocalConfig] = useState<Partial<PokerSessionConfig>>(config || {});
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleSave = () => {
    onUpdateConfig(localConfig);
    setOpen(false);
  };

  const handleDeleteRounds = () => {
    onDeleteAllRounds();
    setDeleteInput('');
    setDeleteConfirmOpen(false);
    setOpen(false);
  };

  const handleConfigChange = (key: keyof PokerSessionConfig, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-white/20 backdrop-blur border-white/30 text-white hover:bg-white/30">
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
                  checked={localConfig.presence_enabled ?? true}
                  onCheckedChange={(checked) => handleConfigChange('presence_enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="send-to-slack">Send Round Results to Slack</Label>
                <Switch
                  id="send-to-slack"
                  checked={localConfig.send_to_slack ?? false}
                  onCheckedChange={(checked) => handleConfigChange('send_to_slack', checked)}
                  disabled={true}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    Delete All Previous Rounds
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you absolutely sure?</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>
                      This action cannot be undone. This will permanently delete all
                      previous round history for this session.
                    </p>
                    <Label htmlFor="delete-confirm">Please type "delete" to confirm.</Label>
                    <Input
                      id="delete-confirm"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleDeleteRounds}
                      disabled={deleteInput !== 'delete'}
                    >
                      I understand the consequence, delete all rounds
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';

interface RetroBoardConfig {
  id: string;
  board_id: string;
  allow_anonymous: boolean;
  voting_enabled: boolean;
  max_votes_per_user: number | null;
  show_author_names: boolean;
  retro_stages_enabled: boolean | null;
  enforce_stage_readiness: boolean | null;
}

interface BoardConfigProps {
  config: RetroBoardConfig | null;
  onUpdateConfig: (config: Partial<RetroBoardConfig>) => void;
}

export const BoardConfig: React.FC<BoardConfigProps> = ({ config, onUpdateConfig }) => {
  const [localConfig, setLocalConfig] = useState<Partial<RetroBoardConfig>>(config || {});
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onUpdateConfig(localConfig);
    setOpen(false);
  };

  const handleConfigChange = (key: keyof RetroBoardConfig, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Board Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Board Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-anonymous">Allow Anonymous Posts</Label>
                <Switch
                  id="allow-anonymous"
                  checked={localConfig.allow_anonymous ?? true}
                  onCheckedChange={(checked) => handleConfigChange('allow_anonymous', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-author-names">Show Author Names</Label>
                <Switch
                  id="show-author-names"
                  checked={localConfig.show_author_names ?? true}
                  onCheckedChange={(checked) => handleConfigChange('show_author_names', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voting Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="voting-enabled">Enable Voting</Label>
                <Switch
                  id="voting-enabled"
                  checked={localConfig.voting_enabled ?? true}
                  onCheckedChange={(checked) => handleConfigChange('voting_enabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-votes">Max Votes Per User (optional)</Label>
                <Input
                  id="max-votes"
                  type="number"
                  placeholder="Unlimited"
                  value={localConfig.max_votes_per_user || ''}
                  onChange={(e) => handleConfigChange('max_votes_per_user', e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Retro Stages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="retro-stages-enabled">Enable Structured Retro Stages</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Guide the retrospective through thinking, voting, discussing, and closing stages
                  </p>
                </div>
                <Switch
                  id="retro-stages-enabled"
                  checked={localConfig.retro_stages_enabled ?? false}
                  onCheckedChange={(checked) => handleConfigChange('retro_stages_enabled', checked)}
                />
              </div>

              {/* Show readiness enforcement setting only when stages are enabled */}
              {localConfig.retro_stages_enabled && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="space-y-0.5">
                    <Label htmlFor="enforce-stage-readiness">Enforce Stage Readiness</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Require all users to be ready before allowing admins to advance stages
                    </p>
                  </div>
                  <Switch
                    id="enforce-stage-readiness"
                    checked={localConfig.enforce_stage_readiness ?? false}
                    onCheckedChange={(checked) => handleConfigChange('enforce_stage_readiness', checked)}
                  />
                </div>
              )}
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

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, MessageSquare } from 'lucide-react';

export interface TeamSettings {
  name: string;
  description: string;
  slack_webhook_url: string;
}

interface TeamSettingsFormProps {
  settings: TeamSettings;
  onSettingsChange: (newSettings: TeamSettings) => void;
}

export const TeamSettingsForm: React.FC<TeamSettingsFormProps> = ({
  settings,
  onSettingsChange
}) => {
  const handleChange = (field: keyof TeamSettings, value: string) => {
    onSettingsChange({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={settings.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter team name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-description">Description (optional)</Label>
            <Textarea
              id="team-description"
              value={settings.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter team description"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Slack Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-webhook">Slack Webhook URL (optional)</Label>
            <Input
              id="slack-webhook"
              value={settings.slack_webhook_url}
              onChange={(e) => handleChange('slack_webhook_url', e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              type="url"
            />
            <p className="text-xs text-gray-500">
              Get a webhook URL from your Slack workspace to receive notifications when retros start.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

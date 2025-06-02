
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Users, MessageSquare } from 'lucide-react';

interface TeamSettingsFormProps {
  team: {
    name: string;
    description?: string;
    slack_webhook_url?: string;
  };
  onSave: (data: { name: string; description: string; slack_webhook_url: string }) => void;
  onCancel: () => void;
  saving: boolean;
}

export const TeamSettingsForm: React.FC<TeamSettingsFormProps> = ({
  team,
  onSave,
  onCancel,
  saving
}) => {
  const [formData, setFormData] = useState({
    name: team.name || '',
    description: team.description || '',
    slack_webhook_url: team.slack_webhook_url || ''
  });

  const handleSave = () => {
    if (formData.name.trim()) {
      onSave(formData);
    }
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
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter team name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-description">Description (optional)</Label>
            <Textarea
              id="team-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
              value={formData.slack_webhook_url}
              onChange={(e) => setFormData(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/..."
              type="url"
            />
            <p className="text-xs text-gray-500">
              Get a webhook URL from your Slack workspace to receive notifications when retros start.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

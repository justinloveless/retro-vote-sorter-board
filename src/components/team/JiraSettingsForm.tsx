import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Label } from '../../components/ui/label.tsx';

export interface JiraSettings {
  jira_domain: string;
  jira_email: string;
  jira_api_key: string;
  jira_ticket_prefix: string;
}

interface JiraSettingsFormProps {
  settings: JiraSettings;
  onSettingsChange: (newSettings: JiraSettings) => void;
}

export const JiraSettingsForm: React.FC<JiraSettingsFormProps> = ({ settings, onSettingsChange }) => {
  const handleChange = (field: keyof JiraSettings, value: string) => {
    onSettingsChange({ ...settings, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jira Integration</CardTitle>
        <CardDescription>Configure your team's Jira connection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="jira-domain">Jira Domain</Label>
          <Input
            id="jira-domain"
            value={settings.jira_domain}
            onChange={(e) => handleChange('jira_domain', e.target.value)}
            placeholder="https://your-company.atlassian.net"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jira-ticket-prefix">Default Ticket Prefix</Label>
          <Input
            id="jira-ticket-prefix"
            value={settings.jira_ticket_prefix}
            onChange={(e) => handleChange('jira_ticket_prefix', e.target.value)}
            placeholder="e.g., RNMT"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jira-email">Jira User Email</Label>
          <Input
            id="jira-email"
            type="email"
            value={settings.jira_email}
            onChange={(e) => handleChange('jira_email', e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="jira-api-key">Jira API Key</Label>
            <Button variant="link" asChild>
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
                Create API Token
              </a>
            </Button>
          </div>
          <Input
            id="jira-api-key"
            type="password"
            value={settings.jira_api_key}
            onChange={(e) => handleChange('jira_api_key', e.target.value)}
            placeholder="Enter your Jira API key"
          />
        </div>
      </CardContent>
    </Card>
  );
}; 
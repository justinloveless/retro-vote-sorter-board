import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface JiraSettingsFormProps {
  teamId: string;
}

export const JiraSettingsForm: React.FC<JiraSettingsFormProps> = ({ teamId }) => {
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiKey, setJiraApiKey] = useState('');
  const [jiraTicketPrefix, setJiraTicketPrefix] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchJiraSettings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('jira_domain, jira_email, jira_api_key, jira_ticket_prefix')
        .eq('id', teamId)
        .single();

      if (error) {
        toast({ title: 'Error fetching Jira settings', variant: 'destructive' });
      } else if (data) {
        setJiraDomain(data.jira_domain || '');
        setJiraEmail(data.jira_email || '');
        setJiraApiKey(data.jira_api_key || '');
        setJiraTicketPrefix(data.jira_ticket_prefix || '');
      }
      setLoading(false);
    };

    fetchJiraSettings();
  }, [teamId, toast]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('teams')
      .update({
        jira_domain: jiraDomain,
        jira_email: jiraEmail,
        jira_api_key: jiraApiKey,
        jira_ticket_prefix: jiraTicketPrefix,
      })
      .eq('id', teamId);

    if (error) {
      toast({ title: 'Error saving Jira settings', variant: 'destructive' });
    } else {
      toast({ title: 'Jira settings saved successfully' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jira Integration</CardTitle>
        <CardDescription>Configure your team's Jira connection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p>Loading Jira settings...</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="jira-domain">Jira Domain</Label>
              <Input
                id="jira-domain"
                value={jiraDomain}
                onChange={(e) => setJiraDomain(e.target.value)}
                placeholder="https://your-company.atlassian.net"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jira-ticket-prefix">Default Ticket Prefix</Label>
              <Input
                id="jira-ticket-prefix"
                value={jiraTicketPrefix}
                onChange={(e) => setJiraTicketPrefix(e.target.value)}
                placeholder="e.g., RNMT"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jira-email">Jira User Email</Label>
              <Input
                id="jira-email"
                type="email"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
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
                value={jiraApiKey}
                onChange={(e) => setJiraApiKey(e.target.value)}
                placeholder="Enter your Jira API key"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Jira Settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}; 
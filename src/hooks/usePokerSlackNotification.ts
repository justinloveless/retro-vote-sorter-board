import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Selections } from './usePokerSession';

export const usePokerSlackNotification = () => {
  const { toast } = useToast();

  const sendPokerRoundToSlack = useCallback(async (
    teamId: string,
    ticketNumber: string | null,
    ticketTitle: string | null,
    selections: Selections,
    averagePoints: number,
    chatMessages: { user_name: string; message: string; created_at: string }[] | undefined
  ) => {
    try {
      // Fetch Jira domain for the team
      let jiraUrl: string | null = null;
      if (teamId && ticketNumber) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('jira_domain')
          .eq('id', teamId)
          .single();

        if (teamError) {
          console.error("Could not fetch team's Jira settings.", teamError);
          // Non-critical, so we don't block the notification
        }

        if (teamData?.jira_domain) {
          let domain = teamData.jira_domain;
          // Ensure the domain has a protocol and remove any trailing slashes
          if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            domain = `https://${domain}`;
          }
          domain = domain.replace(/\/$/, '');
          jiraUrl = `${domain}/browse/${ticketNumber}`;
        }
      }
      
      const { error } = await supabase.functions.invoke('send-poker-round-to-slack', {
        body: {
          teamId,
          ticketNumber,
          ticketTitle,
          selections,
          averagePoints,
          chatMessages: chatMessages, // Pass raw HTML messages
          jiraUrl,
        }
      });

      if (error) {
        toast({
          title: "Slack notification failed",
          description: "The round results could not be sent to Slack.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Slack notification sent",
          description: "The round results have been posted to Slack.",
        });
      }
    } catch (error) {
      // Error is already handled by the toast in the invoke call
    }
  }, [toast]);

  return {
    sendPokerRoundToSlack,
  };
}; 
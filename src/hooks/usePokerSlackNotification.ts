import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Selections } from './usePokerSession';
import htmlToMd from 'html-to-md';

export const usePokerSlackNotification = () => {
  const { toast } = useToast();

  const sendPokerRoundToSlack = useCallback(async (
    teamId: string,
    ticketNumber: string | null,
    ticketTitle: string | null,
    selections: Selections,
    averagePoints: number,
    chatMessages: { user_name: string; message: string }[] | undefined
  ) => {
    try {
      // Convert chat messages from HTML to Markdown for Slack
      const chatMessagesMarkdown = chatMessages?.map(msg => ({
        user_name: msg.user_name,
        message: htmlToMd(msg.message).trim(),
      }));
      console.log('Sending poker round to Slack', {
        teamId,
        ticketNumber,
        ticketTitle,
        selections,
        averagePoints,
        chatMessages: chatMessagesMarkdown
      });
      const { error } = await supabase.functions.invoke('send-poker-round-to-slack', {
        body: {
          teamId,
          ticketNumber,
          ticketTitle,
          selections,
          averagePoints,
          chatMessages: chatMessagesMarkdown
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

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSlackNotification = () => {
  const { toast } = useToast();

  const sendSlackNotification = useCallback(async (
    boardId: string,
    teamId: string | null,
    boardTitle: string,
    roomId: string,
    startedBy: string
  ) => {
    if (!teamId) {
      console.log('No team ID provided, skipping Slack notification');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-slack-notification', {
        body: {
          boardId,
          teamId,
          boardTitle,
          roomId,
          startedBy
        }
      });

      if (error) {
        console.error('Error sending Slack notification:', error);
        toast({
          title: "Slack notification failed",
          description: "The retro started but we couldn't send the Slack notification.",
          variant: "destructive",
        });
      } else {
        console.log('Slack notification sent successfully');
      }
    } catch (error) {
      console.error('Error invoking Slack notification function:', error);
    }
  }, [toast]);

  const createRetroSession = useCallback(async (
    boardId: string,
    teamId: string | null,
    startedBy: string
  ) => {
    if (!teamId || !startedBy) return null;

    try {
      const { data, error } = await supabase
        .from('retro_board_sessions')
        .insert([{
          board_id: boardId,
          team_id: teamId,
          started_by: startedBy
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating retro session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating retro session:', error);
      return null;
    }
  }, []);

  return {
    sendSlackNotification,
    createRetroSession
  };
};

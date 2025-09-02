import { supabase } from '../../integrations/supabase/client.ts';

export const fetchChatMessagesForRound = async (sessionId: string, roundNumber: number) => {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from('poker_session_chat')
    .select('user_name, message')
    .eq('session_id', sessionId)
    .eq('round_number', roundNumber)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
  return data || [];
}; 
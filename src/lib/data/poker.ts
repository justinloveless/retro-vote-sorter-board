import { supabase } from '@/integrations/supabase/client';

// Poker Sessions

export async function getPokerSessionByRoom(roomId: string): Promise<any | null> {
    const { data, error } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('room_id', roomId)
        .single();
    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

export async function createPokerSession(roomId: string): Promise<any> {
    const { data, error } = await supabase
        .from('poker_sessions')
        .insert({ room_id: roomId, current_round_number: 1 })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getPokerRound(sessionId: string, roundNumber: number): Promise<any | null> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', roundNumber)
        .single();
    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

export async function createPokerRound(sessionId: string, roundNumber: number, selections: any, ticketNumber?: string): Promise<any> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .insert({ session_id: sessionId, round_number: roundNumber, selections, ticket_number: ticketNumber || '' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePokerRoundById(roundId: string, fields: any): Promise<any> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .update(fields)
        .eq('id', roundId)
        .select()
        .single();
    return { data, error };
}

export async function updatePokerSessionById(sessionId: string, fields: any): Promise<void> {
    const { error } = await supabase
        .from('poker_sessions')
        .update(fields)
        .eq('id', sessionId);
    if (error) throw error;
}

export async function deletePokerSessionData(sessionId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-session-data', { body: { session_id: sessionId } });
    if (error) throw new Error(`Function invocation failed: ${error.message}`);
}

export async function fetchPokerRounds(sessionId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .select('*')
        .eq('session_id', sessionId)
        .order('round_number', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Poker Session Chat

export async function fetchPokerChatMessages(sessionId: string, roundNumber: number): Promise<any[]> {
    const { data, error } = await supabase
        .from('poker_session_chat_with_details')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', roundNumber)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function sendPokerChatMessage(params: { sessionId: string; roundNumber: number; userId: string; userName: string; messageText: string; replyToMessageId?: string }): Promise<void> {
    const { error } = await supabase
        .from('poker_session_chat')
        .insert({
            session_id: params.sessionId,
            round_number: params.roundNumber,
            user_id: params.userId,
            user_name: params.userName,
            message: params.messageText,
            reply_to_message_id: params.replyToMessageId,
        });
    if (error) throw error;
}

export async function addPokerChatReaction(params: { sessionId: string; messageId: string; userId: string; userName: string; emoji: string }): Promise<void> {
    const { error } = await supabase.from('poker_session_chat_message_reactions').insert({
        message_id: params.messageId,
        user_id: params.userId,
        user_name: params.userName,
        emoji: params.emoji,
        session_id: params.sessionId
    });
    if (error) throw error;
}

export async function removePokerChatReaction(params: { messageId: string; userId: string; emoji: string }): Promise<void> {
    const { error } = await supabase
        .from('poker_session_chat_message_reactions')
        .delete()
        .eq('message_id', params.messageId)
        .eq('user_id', params.userId)
        .eq('emoji', params.emoji);
    if (error) throw error;
}

export async function uploadPokerChatImage(sessionId: string, roundNumber: number, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${sessionId}/${roundNumber}/${fileName}`;
    const bucketName = 'poker-session-chat-images';

    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    if (!data.publicUrl) throw new Error('Failed to get public URL');
    return data.publicUrl;
}

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
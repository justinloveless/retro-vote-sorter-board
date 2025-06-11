import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  session_id: string;
  round_number: number;
  user_id: string | null;
  user_name: string;
  message: string;
  created_at: string;
}

export const usePokerSessionChat = (
  sessionId: string | null,
  currentRoundNumber: number,
  currentUserId: string | undefined,
  currentUserName: string | undefined
) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('poker_session_chat')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', currentRoundNumber)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat messages:', error);
        toast({ title: 'Error loading chat', variant: 'destructive' });
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      toast({ title: 'Error loading chat', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [sessionId, currentRoundNumber, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`poker_chat:${sessionId}:${currentRoundNumber}`);
    channelRef.current = channel;

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'poker_session_chat',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const newMessage = payload.new as ChatMessage;
        // Only add messages for the current round
        if (newMessage.round_number === currentRoundNumber) {
          setMessages((prev) => [...prev, newMessage]);
        }
      }
    );

    channel.subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, currentRoundNumber]);

  const sendMessage = async (messageText: string) => {
    if (!sessionId || !currentUserId || !currentUserName || !messageText.trim()) return;

    try {
      const { error } = await supabase
        .from('poker_session_chat')
        .insert({
          session_id: sessionId,
          round_number: currentRoundNumber,
          user_id: currentUserId,
          user_name: currentUserName,
          message: messageText.trim(),
        });

      if (error) {
        console.error('Error sending message:', error);
        toast({ title: 'Error sending message', variant: 'destructive' });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error sending message', variant: 'destructive' });
      return false;
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!sessionId) {
      toast({ title: 'Session ID is missing', variant: 'destructive' });
      return null;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${sessionId}/${currentRoundNumber}/${fileName}`;
    const bucketName = 'poker-session-chat-images';

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      toast({ title: 'Failed to upload image', variant: 'destructive' });
      return null;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    if (!data.publicUrl) {
      toast({ title: 'Failed to get image URL', variant: 'destructive' });
      return null;
    }
    
    return data.publicUrl;
  };

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages,
    uploadImage,
  };
};

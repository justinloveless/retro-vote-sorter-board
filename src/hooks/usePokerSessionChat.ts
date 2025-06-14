import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessageReaction {
  user_id: string;
  user_name: string;
  emoji: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  round_number: number;
  user_id: string | null;
  user_name: string;
  message: string;
  created_at: string;
  reply_to_message_id?: string;
  reply_to_message_user?: string;
  reply_to_message_content?: string;
  reactions: ChatMessageReaction[];
}

export type UploadImageFn = (file: File) => Promise<string | null>;

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
        .from('poker_session_chat_with_details')
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

    // Listen for the custom event to refetch rounds
    const handleRoundEnded = () => fetchMessages();
    window.addEventListener('round-ended', handleRoundEnded);

    const handleChatsDeleted = () => fetchMessages();
    window.addEventListener('chats-deleted', handleChatsDeleted);

    return () => {
      window.removeEventListener('round-ended', handleRoundEnded);
      window.removeEventListener('chats-deleted', handleChatsDeleted);
    };
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
      async (payload) => {
        const newMessage = payload.new as ChatMessage;

        if (newMessage.round_number !== currentRoundNumber) {
          return;
        }

        // If it's a reply, we need to fetch the original message content
        if (newMessage.reply_to_message_id) {
          const { data: repliedToMessage, error } = await supabase
            .from('poker_session_chat')
            .select('user_name, message')
            .eq('id', newMessage.reply_to_message_id)
            .single();
          
          if (!error && repliedToMessage) {
            newMessage.reply_to_message_user = repliedToMessage.user_name;
            newMessage.reply_to_message_content = repliedToMessage.message;
          }
        }
        
        // Initialize reactions array if it doesn't exist
        if (!newMessage.reactions) {
          newMessage.reactions = [];
        }

        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      }
    );

    const reactionChannel = supabase.channel(`poker_chat_reactions:${sessionId}:${currentRoundNumber}`);
    reactionChannel
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'poker_session_chat_message_reactions',
        filter: `session_id=eq.${sessionId}`
      }, 
        (payload) => {
          const newReaction = payload.new as { message_id: string; user_id: string; user_name: string; emoji: string };
          setMessages(prevMessages => prevMessages.map(msg => {
            if (msg.id === newReaction.message_id) {
              // Avoid adding duplicate reactions from the user's own action
              if (msg.reactions.some(r => r.user_id === newReaction.user_id && r.emoji === newReaction.emoji)) {
                return msg;
              }
              const updatedReactions = [...msg.reactions, {
                user_id: newReaction.user_id,
                user_name: newReaction.user_name,
                emoji: newReaction.emoji
              }];
              return { ...msg, reactions: updatedReactions };
            }
            return msg;
          }));
        }
      )
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'poker_session_chat_message_reactions',
        filter: `session_id=eq.${sessionId}`
      },
        () => {}
      )
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'poker_session_chat_message_reactions',
        filter: `session_id=eq.${sessionId}`
      }, 
        (payload) => {
          const oldReaction = payload.old as { message_id: string; user_id: string; emoji: string };
          setMessages(prevMessages => prevMessages.map(msg => {
            if (msg.id === oldReaction.message_id) {
              const updatedReactions = msg.reactions.filter(
                r => !(r.user_id === oldReaction.user_id && r.emoji === oldReaction.emoji)
              );
              return { ...msg, reactions: updatedReactions };
            }
            return msg;
          }));
        }
      )
      .subscribe();

    channel.subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      supabase.removeChannel(reactionChannel);
    };
  }, [sessionId, currentRoundNumber]);

  const sendMessage = async (messageText: string, replyToMessageId?: string) => {
    if (!sessionId || !currentUserId || !currentUserName || !messageText.trim()) return false;

    try {
      const { error } = await supabase
        .from('poker_session_chat')
        .insert({
          session_id: sessionId,
          round_number: currentRoundNumber,
          user_id: currentUserId,
          user_name: currentUserName,
          message: messageText.trim(),
          reply_to_message_id: replyToMessageId,
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

  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId || !currentUserName || !sessionId) return;
    const { error } = await supabase.from('poker_session_chat_message_reactions').insert({
      message_id: messageId,
      user_id: currentUserId,
      user_name: currentUserName,
      emoji: emoji,
      session_id: sessionId
    });
    if (error) {
      console.error('Error adding reaction:', error.message);
    }
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('poker_session_chat_message_reactions').delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUserId)
      .eq('emoji', emoji);

    if (error) {
      console.error('Error removing reaction:', error);
      toast({ title: 'Error removing reaction', variant: 'destructive' });
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
    addReaction,
    removeReaction,
    fetchMessages,
    uploadImage,
  };
};

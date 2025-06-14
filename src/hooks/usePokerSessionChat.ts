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
  console.log('usePokerSessionChat initialized with sessionId:', sessionId, 'and currentRoundNumber:', currentRoundNumber);

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

      console.log('setting messages to', data);
      
      setMessages(data || []);
      console.log('Messages fetched successfully:', messages);
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
    console.log('Messages state updated:', messages);
    
  }, [messages]);

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
        console.log('New message received:', payload);
        const newMessage = payload.new as ChatMessage;

        if (newMessage.round_number !== currentRoundNumber) {
          console.warn('Message received for a different round:', newMessage.round_number);
          return;
        }

        // If it's a reply, we need to fetch the original message content
        if (newMessage.reply_to_message_id) {
          console.log('Fetching replied message details for:', newMessage.reply_to_message_id);
          const { data: repliedToMessage, error } = await supabase
            .from('poker_session_chat')
            .select('user_name, message')
            .eq('id', newMessage.reply_to_message_id)
            .single();
          
          if (!error && repliedToMessage) {
            console.log('Replied message details:', repliedToMessage);
            newMessage.reply_to_message_user = repliedToMessage.user_name;
            newMessage.reply_to_message_content = repliedToMessage.message;
          }
        }
        
        // Initialize reactions array if it doesn't exist
        if (!newMessage.reactions) {
          newMessage.reactions = [];
        }

        console.log('current messages state before adding new message:', messages);
        console.log('Adding new message to state:', newMessage);
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMessage.id)) {
            console.log('Message already exists in state, not adding:', newMessage.id);
            return prev;
          }
          console.log('Adding new message to state:', newMessage);
          return [...prev, newMessage];
        });
        console.log('Updated messages state:', messages);
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
        (payload) => {
          const updatedReaction = payload.new as { message_id: string; user_id: string; emoji: string; user_name: string };
          setMessages(prevMessages => prevMessages.map(msg => {
            if (msg.id === updatedReaction.message_id) {
              const reactionExists = msg.reactions.some(r => r.user_id === updatedReaction.user_id);
              let updatedReactions;
              if (reactionExists) {
                updatedReactions = msg.reactions.map(r => 
                  r.user_id === updatedReaction.user_id ? { ...r, emoji: updatedReaction.emoji } : r
                );
              } else {
                updatedReactions = [...msg.reactions, {
                  user_id: updatedReaction.user_id,
                  user_name: updatedReaction.user_name,
                  emoji: updatedReaction.emoji
                }];
              }
              return { ...msg, reactions: updatedReactions };
            }
            return msg;
          }));
        }
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
                r => !(r.user_id === oldReaction.user_id)
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
    console.log('Sending message', messageText, replyToMessageId);
    console.log('Session ID', sessionId);
    console.log('Current User ID', currentUserId);
    console.log('Current User Name', currentUserName);
    console.log('Message Text', messageText);
    console.log('Reply To Message ID', replyToMessageId);
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
    const { error } = await supabase.from('poker_session_chat_message_reactions').upsert({
      message_id: messageId,
      user_id: currentUserId,
      user_name: currentUserName,
      emoji: emoji,
      session_id: sessionId
    }, {
      onConflict: 'message_id,user_id'
    });
    if (error) {
      console.error('Error adding reaction:', error);
      toast({ title: 'Error adding reaction', variant: 'destructive' });
    }
  };

  const removeReaction = async (messageId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('poker_session_chat_message_reactions').delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUserId);

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

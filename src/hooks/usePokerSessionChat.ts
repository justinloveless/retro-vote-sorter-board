import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

function upsertMessageIdToRound(
  map: Map<string, number>,
  messages: ChatMessage[] | undefined,
  roundNumber: number
) {
  if (!messages) return;
  for (const m of messages) {
    map.set(m.id, roundNumber);
  }
}

export const usePokerSessionChat = (
  sessionId: string | null,
  currentRoundNumber: number,
  currentUserId: string | undefined,
  currentUserName: string | undefined
) => {
  const [messagesByRound, setMessagesByRound] = useState<Record<number, ChatMessage[]>>({});
  const [fetchingRound, setFetchingRound] = useState<number | null>(null);
  const [newMessageCountByRound, setNewMessageCountByRound] = useState<Record<number, number>>({});
  const { toast } = useToast();

  const loadedRoundsRef = useRef<Set<number>>(new Set());
  const messageIdToRoundRef = useRef<Map<string, number>>(new Map());
  const currentRoundNumberRef = useRef(currentRoundNumber);
  const sessionIdRef = useRef(sessionId);
  const insertChannelRef = useRef<RealtimeChannel | null>(null);
  const reactionChannelRef = useRef<RealtimeChannel | null>(null);

  currentRoundNumberRef.current = currentRoundNumber;
  sessionIdRef.current = sessionId;

  const messages = useMemo(
    () => messagesByRound[currentRoundNumber] ?? [],
    [messagesByRound, currentRoundNumber]
  );

  const isChatLoading = fetchingRound === currentRoundNumber;

  const resetSessionCaches = useCallback(() => {
    loadedRoundsRef.current = new Set();
    messageIdToRoundRef.current = new Map();
    setMessagesByRound({});
    setNewMessageCountByRound({});
  }, []);

  const fetchRoundMessages = useCallback(
    async (roundNumber: number, force: boolean) => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      if (!force && loadedRoundsRef.current.has(roundNumber)) {
        return;
      }

      setFetchingRound(roundNumber);
      try {
        const { data, error } = await supabase
          .from('poker_session_chat_with_details')
          .select('*')
          .eq('session_id', sid)
          .eq('round_number', roundNumber)
          .order('created_at', { ascending: true });

        if (sessionIdRef.current !== sid) return;

        if (error) {
          console.error('Error fetching chat messages:', error);
          toast({ title: 'Error loading chat', variant: 'destructive' });
          return;
        }

        const list = data || [];
        for (const id of messageIdToRoundRef.current.keys()) {
          if (messageIdToRoundRef.current.get(id) === roundNumber) {
            messageIdToRoundRef.current.delete(id);
          }
        }
        upsertMessageIdToRound(messageIdToRoundRef.current, list, roundNumber);

        setMessagesByRound((prev) => ({ ...prev, [roundNumber]: list }));
        loadedRoundsRef.current.add(roundNumber);
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        toast({ title: 'Error loading chat', variant: 'destructive' });
      } finally {
        setFetchingRound((prev) => (prev === roundNumber ? null : prev));
      }
    },
    [toast]
  );

  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = sessionId;
    resetSessionCaches();
  }, [sessionId, resetSessionCaches]);

  useEffect(() => {
    if (!sessionId) return;
    void fetchRoundMessages(currentRoundNumber, false);
  }, [sessionId, currentRoundNumber, fetchRoundMessages]);

  useEffect(() => {
    setNewMessageCountByRound((prev) => {
      if (!prev[currentRoundNumber]) return prev;
      const next = { ...prev };
      delete next[currentRoundNumber];
      return next;
    });
  }, [currentRoundNumber]);

  useEffect(() => {
    const handleRoundEnded = () => {
      void fetchRoundMessages(currentRoundNumberRef.current, true);
    };
    const handleChatsDeleted = () => {
      resetSessionCaches();
      void fetchRoundMessages(currentRoundNumberRef.current, true);
    };
    window.addEventListener('round-ended', handleRoundEnded);
    window.addEventListener('chats-deleted', handleChatsDeleted);
    return () => {
      window.removeEventListener('round-ended', handleRoundEnded);
      window.removeEventListener('chats-deleted', handleChatsDeleted);
    };
  }, [fetchRoundMessages, resetSessionCaches]);

  const applyReactionInsert = useCallback(
    (newReaction: { message_id: string; user_id: string; user_name: string; emoji: string }) => {
      const roundNumber = messageIdToRoundRef.current.get(newReaction.message_id);
      if (roundNumber === undefined) return;

      setMessagesByRound((prev) => {
        const list = prev[roundNumber];
        if (!list) return prev;
        const nextList = list.map((msg) => {
          if (msg.id !== newReaction.message_id) return msg;
          if (msg.reactions.some((r) => r.user_id === newReaction.user_id && r.emoji === newReaction.emoji)) {
            return msg;
          }
          return {
            ...msg,
            reactions: [
              ...msg.reactions,
              {
                user_id: newReaction.user_id,
                user_name: newReaction.user_name,
                emoji: newReaction.emoji,
              },
            ],
          };
        });
        return { ...prev, [roundNumber]: nextList };
      });
    },
    []
  );

  const applyReactionDelete = useCallback(
    (oldReaction: { message_id: string; user_id: string; emoji: string }) => {
      const roundNumber = messageIdToRoundRef.current.get(oldReaction.message_id);
      if (roundNumber === undefined) return;

      setMessagesByRound((prev) => {
        const list = prev[roundNumber];
        if (!list) return prev;
        const nextList = list.map((msg) => {
          if (msg.id !== oldReaction.message_id) return msg;
          return {
            ...msg,
            reactions: msg.reactions.filter(
              (r) => !(r.user_id === oldReaction.user_id && r.emoji === oldReaction.emoji)
            ),
          };
        });
        return { ...prev, [roundNumber]: nextList };
      });
    },
    []
  );

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`poker_chat:${sessionId}`);
    insertChannelRef.current = channel;

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
        const rn = newMessage.round_number;
        const viewingRound = currentRoundNumberRef.current;

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

        if (!newMessage.reactions) {
          newMessage.reactions = [];
        }

        messageIdToRoundRef.current.set(newMessage.id, rn);

        setMessagesByRound((prev) => {
          const existing = prev[rn] ?? [];
          if (existing.some((m) => m.id === newMessage.id)) {
            return prev;
          }
          return { ...prev, [rn]: [...existing, newMessage] };
        });

        if (rn !== viewingRound) {
          const isOwn =
            newMessage.user_id != null && newMessage.user_id === currentUserId;
          if (!isOwn) {
            setNewMessageCountByRound((prev) => ({
              ...prev,
              [rn]: (prev[rn] ?? 0) + 1,
            }));
          }
        }
      }
    );

    const reactionChannel = supabase.channel(`poker_chat_reactions:${sessionId}`);
    reactionChannelRef.current = reactionChannel;

    reactionChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'poker_session_chat_message_reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newReaction = payload.new as {
            message_id: string;
            user_id: string;
            user_name: string;
            emoji: string;
          };
          applyReactionInsert(newReaction);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'poker_session_chat_message_reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {}
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'poker_session_chat_message_reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const oldReaction = payload.old as { message_id: string; user_id: string; emoji: string };
          applyReactionDelete(oldReaction);
        }
      )
      .subscribe();

    channel.subscribe();

    return () => {
      if (insertChannelRef.current) {
        supabase.removeChannel(insertChannelRef.current);
        insertChannelRef.current = null;
      }
      if (reactionChannelRef.current) {
        supabase.removeChannel(reactionChannelRef.current);
        reactionChannelRef.current = null;
      }
    };
  }, [sessionId, currentUserId, applyReactionInsert, applyReactionDelete]);

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

  const sendSystemMessage = async (messageText: string) => {
    if (!sessionId || !messageText.trim()) return false;

    try {
      const { error } = await supabase.from('poker_session_chat').insert({
        session_id: sessionId,
        round_number: currentRoundNumber,
        user_id: null,
        user_name: 'System',
        message: messageText.trim(),
      });

      if (error) {
        console.error('Error sending system message:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending system message:', error);
      return false;
    }
  };

  const sendBotMessage = async (botName: string, messageText: string): Promise<string | null> => {
    if (!sessionId || !botName.trim() || !messageText.trim()) return null;

    try {
      const { data, error } = await supabase
        .from('poker_session_chat')
        .insert({
          session_id: sessionId,
          round_number: currentRoundNumber,
          user_id: null,
          user_name: botName.trim(),
          message: messageText.trim(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error sending bot message:', error);
        return null;
      }

      return data?.id ?? null;
    } catch (error) {
      console.error('Error sending bot message:', error);
      return null;
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId || !currentUserName || !sessionId) return;
    const { error } = await supabase.from('poker_session_chat_message_reactions').insert({
      message_id: messageId,
      user_id: currentUserId,
      user_name: currentUserName,
      emoji: emoji,
      session_id: sessionId,
    });
    if (error) {
      console.error('Error adding reaction:', error.message);
    }
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    const { error } = await supabase
      .from('poker_session_chat_message_reactions')
      .delete()
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

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, {
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

  const fetchMessages = useCallback(async () => {
    await fetchRoundMessages(currentRoundNumberRef.current, true);
  }, [fetchRoundMessages]);

  return {
    messages,
    loading: isChatLoading,
    newMessageCountByRound,
    sendMessage,
    sendSystemMessage,
    sendBotMessage,
    addReaction,
    removeReaction,
    fetchMessages,
    uploadImage,
  };
};

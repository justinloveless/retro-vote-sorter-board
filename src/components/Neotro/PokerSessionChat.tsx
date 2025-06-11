import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MessageCircle, Smile, CornerUpLeft, X } from 'lucide-react';
import { usePokerSessionChat, ChatMessage, ChatMessageReaction } from '@/hooks/usePokerSessionChat';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import linkifyHtml from 'linkify-html';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import * as emoji from 'node-emoji';
import './PokerSessionChat.css';
import { QuickReactionPicker } from './QuickReactionPicker';

interface PokerSessionChatProps {
  sessionId: string | null;
  currentRoundNumber: number;
  currentUserId: string | undefined;
  currentUserName: string | undefined;
  isViewingHistory: boolean;
}

export const PokerSessionChat: React.FC<PokerSessionChatProps> = ({
  sessionId,
  currentRoundNumber,
  currentUserId,
  currentUserName,
  isViewingHistory,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean | string>(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactingToId, setReactingToId] = useState<string | null>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<ReactQuill>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { 
    messages, 
    loading, 
    sendMessage, 
    uploadImage,
    addReaction,
    removeReaction
  } = usePokerSessionChat(
    sessionId,
    currentRoundNumber,
    currentUserId,
    currentUserName
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!userHasScrolledUp) {
      scrollToBottom();
    }
  }, [messages.length, userHasScrolledUp]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      // Consider user scrolled up if they are more than 20px from the bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
      setUserHasScrolledUp(!isAtBottom);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const editor = quillRef.current?.getEditor();
    const textContent = editor?.getText().trim() ?? '';
    
    if (!textContent || isViewingHistory) return;

    const processedMessage = newMessage.replace(/:(\w+):/g, (match, shortcode) => {
      const emojiChar = emoji.get(shortcode);
      return emojiChar || match;
    });

    const success = await sendMessage(processedMessage, replyingTo?.id);
    if (success) {
      setNewMessage('');
      setReplyingTo(null);
    }
  };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !event.clipboardData) return;

    const items = event.clipboardData.items;
    const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));

    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file || !uploadImage) return;
      
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      const imageUrl = await uploadImage(file);

      if (imageUrl) {
        quill.insertEmbed(range.index, 'image', imageUrl);
        quill.setSelection(range.index + 1, 0);
      } else {
        quill.insertText(range.index, ' [image upload failed] ');
      }
    }
  }, [uploadImage]);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      quill.root.addEventListener('paste', handlePaste as EventListener);
      return () => {
        quill.root.removeEventListener('paste', handlePaste as EventListener);
      };
    }
  }, [handlePaste]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      quill.insertText(range.index, emojiData.emoji);
      quill.setSelection(range.index + emojiData.emoji.length, 0);
      setShowEmojiPicker(false);
    }
  };

  const handleReactionClick = (message: ChatMessage, emoji: string) => {
    const existingReaction = message.reactions.find(
      (r) => r.user_id === currentUserId
    );

    if (existingReaction && existingReaction.emoji === emoji) {
      // User is clicking the same emoji again, so remove it
      removeReaction(message.id);
    } else {
      // User is adding a new reaction or changing an existing one
      addReaction(message.id, emoji);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: ChatMessage) => {
    const isCurrentUser = message.user_id === currentUserId;
    const messageWithLinks = linkifyHtml(message.message, {
      defaultProtocol: 'https',
      target: {
        url: '_blank',
      },
      validate: {
        url: (value) => /^https?:\/\//.test(value),
      }
    });
    const sanitizedMessage = DOMPurify.sanitize(messageWithLinks, {
      ADD_TAGS: ['img'],
      ADD_ATTR: ['src', 'alt', 'style'],
    });
    
    const aggregatedReactions = (message.reactions || []).reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction.user_name);
      return acc;
    }, {} as Record<string, string[]>);
    
    return (
      <div
        key={message.id}
        className={`group relative flex items-start ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-1`}
      >
        <div
          className={`max-w-[70%] rounded-lg px-3 py-2 ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {message.reply_to_message_id && (
            <div className="text-xs opacity-80 border-l-2 border-primary/50 pl-2 mb-1">
              <p className="font-semibold">{message.reply_to_message_user}</p>
              <p className="truncate">{message.reply_to_message_content?.replace(/<[^>]+>/g, '')}</p>
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{message.user_name}</span>
            <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
          </div>
          <div 
            className="text-sm prose dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizedMessage }} 
          />
          <div className="mt-2 pt-1 border-t border-primary-foreground/20 flex items-center justify-between">
            <TooltipProvider>
              <div className="flex gap-1 flex-wrap items-center">
                {Object.entries(aggregatedReactions).map(([emoji, userNames]) => {
                  const hasReacted = userNames.includes(currentUserName || '');
                  return (
                    <Tooltip key={emoji}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleReactionClick(message, emoji)}
                          className={`px-1.5 py-0.5 rounded-full text-xs ${
                            hasReacted ? 'bg-blue-500/30' : 'bg-gray-500/20'
                          }`}
                        >
                          {emoji} {userNames.length}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{userNames.join(', ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>

            {!isViewingHistory && (
              <div className="flex items-center shrink-0 ml-2">
                <div className="flex items-center rounded-full bg-primary-foreground/10">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyingTo(message)}>
                    <CornerUpLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReactingToId(message.id)}>
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          {reactingToId === message.id && (
            <div className="mt-2">
              <QuickReactionPicker
                onEmojiSelect={(emoji) => {
                  handleReactionClick(message, emoji);
                  setReactingToId(null);
                }}
                onShowMore={() => {
                  setReactingToId(null);
                  setShowEmojiPicker(message.id);
                }}
                onClose={() => setReactingToId(null)}
              />
            </div>
          )}
        </div>
        {showEmojiPicker === message.id && !isViewingHistory && (
           <div className="emoji-picker-container absolute z-10" style={{ bottom: '40px', [isCurrentUser ? 'right' : 'left']: '0px' }}>
            <EmojiPicker 
              onEmojiClick={(emojiData) => {
                handleReactionClick(message, emojiData.emoji);
                setShowEmojiPicker(false);
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['link'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Round {currentRoundNumber} Chat
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {messages.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              Loading chat...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {!isViewingHistory && (
          <div className="mt-3">
            {replyingTo && (
              <div className="flex items-center justify-between p-2 mb-2 text-sm bg-muted rounded-md">
                <div className="flex items-center gap-2 overflow-hidden">
                  <CornerUpLeft className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold">Replying to {replyingTo.user_name}</p>
                    <p className="truncate text-muted-foreground">{replyingTo.message.replace(/<[^>]+>/g, '')}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 pt-3 border-t">
              <div className="flex-1 min-w-0">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={newMessage}
                  onChange={setNewMessage}
                  modules={{ 
                    toolbar: null,
                    clipboard: {
                      matchVisual: false,
                    },
                    keyboard: {
                      bindings: {
                        enter: {
                          key: 13,
                          shiftKey: false,
                          handler: () => {
                            handleSendMessage();
                            return false;
                          }
                        }
                      }
                    }
                  }}
                  placeholder="Type a message..."
                />
              </div>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEmojiPicker(prev => prev ? false : 'main')}
                >
                  <Smile className="h-5 w-5" />
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || newMessage === '<p><br></p>'}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {showEmojiPicker === 'main' && (
                <div className="emoji-picker-container">
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </div>
              )}
            </form>
          </div>
        )}

        {isViewingHistory && (
          <div className="mt-3 pt-3 border-t text-center text-sm text-muted-foreground">
            Chat is read-only when viewing history
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MessageCircle, Smile, CornerUpLeft, X, GripVertical } from 'lucide-react';
import type { ChatMessage } from '@/hooks/usePokerSessionChat';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';
import { Badge } from '@/components/ui/badge';
import { processMentionsForDisplay } from './TiptapEditorWithMentions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Markdown } from '@/components/ui/markdown';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { TiptapEditor } from './TiptapEditor';
import { QuickReactionPicker } from './QuickReactionPicker';
import { displayTicketLabel } from '@/lib/pokerRoundTicketPlaceholder';

interface PokerSessionChatProps {
  onResizeStart?: (e: React.MouseEvent) => void;
  embedded?: boolean;
  wrapperClassName?: string;
}

export const PokerSessionChat: React.FC<PokerSessionChatProps> = ({
  onResizeStart,
  embedded = false,
  wrapperClassName,
}) => {
  const {
    activeUserId,
    isViewingHistory,
    currentRound,
    chatMessagesForRound: messages,
    isChatLoading: loading,
    sendMessage,
    addReaction,
    removeReaction,
    uploadChatImage: uploadImage,
    activeUserSelection,
  } = usePokerTable();

  const currentUserId = activeUserId;
  const currentUserName = activeUserSelection?.name;
  const currentRoundNumber = currentRound?.round_number || 1;
  const ticketLabel = displayTicketLabel(currentRound?.ticket_number);
  const chatTitle =
    ticketLabel === 'No ticket' ? `Round ${currentRoundNumber} Chat` : `${ticketLabel} Chat`;

  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean | string>(false);
  const [emojiPickerAnchorRect, setEmojiPickerAnchorRect] = useState<DOMRect | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactingToId, setReactingToId] = useState<string | null>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [advisorContextMarkdown, setAdvisorContextMarkdown] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    console.log('messages length changed:', messages.length);
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

  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || newMessage === '<p></p>') return;

    const success = await sendMessage(newMessage, replyingTo?.id);
    if (success) {
      setNewMessage('');
      setReplyingTo(null);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(newMessage + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleReactionClick = (message: ChatMessage, emoji: string) => {
    const userHasReactedWithEmoji = message.reactions.some(
      (r) => r.user_id === currentUserId && r.emoji === emoji
    );

    if (userHasReactedWithEmoji) {
      console.log('removing reaction', emoji);
      removeReaction(message.id, emoji);
    } else {
      console.log('adding reaction', emoji);
      addReaction(message.id, emoji);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc);
  };

  const handleAdvisorContextClick = (base64Utf8: string) => {
    try {
      const decoded = decodeURIComponent(escape(window.atob(base64Utf8)));
      const trimmed = (decoded || '').trim();
      if (!trimmed) return;
      setAdvisorContextMarkdown(trimmed);
    } catch {
      /* ignore */
    }
  };

  const toBase64Utf8 = (s: string) => window.btoa(unescape(encodeURIComponent(s)));

  const decodeHtmlEntities = (s: string) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

  const maybeReplaceAdvisorTicketContextWithButton = (message: ChatMessage): string => {
    if (message.user_name !== 'Advisor') return message.message;
    const raw = message.message || '';

    // Legacy context message shape we previously sent:
    // <h3>Ticket context</h3><pre><code>...escaped markdown...</code></pre>
    if (!raw.toLowerCase().includes('ticket context')) return raw;
    const m = raw.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/i);
    if (!m) return raw;

    const escapedMarkdown = m[1] ?? '';
    const markdown = decodeHtmlEntities(escapedMarkdown).trim();
    if (!markdown) return raw;

    const payload = toBase64Utf8(markdown.slice(0, 12000));
    return [
      '<div style="display:flex;align-items:center;gap:8px;">',
      '<strong>Advisor context</strong>',
      `<button style="cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid rgba(120,120,120,0.35);background:transparent;" onclick="window.showAdvisorContext('${payload}')">View</button>`,
      '</div>',
    ].join('');
  };

  const processMessageContent = (content: string) => {
    // Replace img tags with clickable images
    return content.replace(/<img([^>]*?)src="([^"]*?)"([^>]*?)>/g, (match, beforeSrc, src, afterSrc) => {
      return `<img${beforeSrc}src="${src}"${afterSrc} style="cursor: pointer; max-width: 200px; max-height: 150px; border-radius: 8px;" onclick="window.handleChatImageClick('${src}')" />`;
    });
  };

  // Make handleImageClick available globally for the onclick handler
  useEffect(() => {
    (window as any).handleChatImageClick = handleImageClick;
    (window as any).showAdvisorContext = handleAdvisorContextClick;
    return () => {
      delete (window as any).handleChatImageClick;
      delete (window as any).showAdvisorContext;
    };
  }, []);

  const renderMessage = (message: ChatMessage) => {
    const isCurrentUser = message.user_id === currentUserId;
    const isSystemMessage = message.user_id === null;

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
          className={isSystemMessage
            ? 'max-w-[90%] px-2 py-1 text-muted-foreground italic'
            : `max-w-[70%] rounded-lg px-3 py-2 ${isCurrentUser
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
            <span className={`text-xs font-medium ${isSystemMessage ? 'italic' : ''}`}>{message.user_name}</span>
            <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
          </div>
          <div
            className={`text-sm prose dark:prose-invert max-w-none ${isSystemMessage ? 'italic' : ''}`}
            dangerouslySetInnerHTML={{
              __html: processMentionsForDisplay(
                processMessageContent(maybeReplaceAdvisorTicketContextWithButton(message)),
              ),
            }}
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
                          className={`px-1.5 py-0.5 rounded-full text-xs ${hasReacted ? 'bg-blue-500/30' : 'bg-gray-500/20'
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

            {!isSystemMessage && (
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
                onShowMore={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setEmojiPickerAnchorRect(rect);
                  setReactingToId(null);
                  setShowEmojiPicker(message.id);
                }}
                onClose={() => setReactingToId(null)}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const Wrapper = embedded ? 'div' : Card;

  return (
    <>
      <Dialog open={advisorContextMarkdown != null} onOpenChange={(open) => (open ? null : setAdvisorContextMarkdown(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Advisor context</DialogTitle>
          </DialogHeader>
          {advisorContextMarkdown ? (
            <Markdown className="prose prose-sm dark:prose-invert max-w-none">
              {advisorContextMarkdown}
            </Markdown>
          ) : null}
        </DialogContent>
      </Dialog>

      <Wrapper className={`relative h-full flex flex-col ${wrapperClassName ?? ''}`}>
        {onResizeStart && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            className="absolute left-0 top-0 bottom-0 w-2 -ml-1 flex cursor-col-resize items-center justify-center z-10"
            onMouseDown={onResizeStart}
          >
            <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
              <GripVertical className="h-2.5 w-2.5" />
            </div>
          </div>
        )}
        {!embedded && (
          <CardHeader className="flex-shrink-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5" />
              <span>
                {chatTitle}
              </span>
              {messages.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {messages.length > 99 ? '99+' : messages.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-0">
          <ScrollArea ref={scrollAreaRef} className="neotro-scrollbar-radix flex-1 pr-4">
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
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center gap-2 pt-3 border-t">
                <div className="flex-1 min-w-0">
                  <TiptapEditor
                    content={newMessage}
                    onChange={setNewMessage}
                    onSubmit={handleSendMessage}
                    placeholder="Type a message..."
                    uploadImage={uploadImage}
                  />
                </div>
                <div className="flex items-center self-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      if (showEmojiPicker === 'main') {
                        setShowEmojiPicker(false);
                        setEmojiPickerAnchorRect(null);
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setEmojiPickerAnchorRect(rect);
                        setShowEmojiPicker('main');
                      }
                    }}
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!newMessage.trim() || newMessage === '<p></p>'}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          
        </CardContent>
      </Wrapper>

      {typeof showEmojiPicker === 'string' && emojiPickerAnchorRect && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setShowEmojiPicker(false); setEmojiPickerAnchorRect(null); }}
          />
          <div
            className="fixed z-50"
            style={(() => {
              const pickerH = 450;
              const pickerW = 350;
              const gap = 8;
              const spaceAbove = emojiPickerAnchorRect.top;
              const top = spaceAbove >= pickerH + gap
                ? emojiPickerAnchorRect.top - pickerH - gap
                : emojiPickerAnchorRect.bottom + gap;
              let left = emojiPickerAnchorRect.left;
              if (left + pickerW > window.innerWidth - gap) left = window.innerWidth - pickerW - gap;
              if (left < gap) left = gap;
              return { top: Math.max(gap, top), left };
            })()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                if (showEmojiPicker === 'main') {
                  handleEmojiClick(emojiData);
                } else {
                  const msgId = showEmojiPicker as string;
                  const msg = messages.find(m => m.id === msgId);
                  if (msg) handleReactionClick(msg, emojiData.emoji);
                }
                setShowEmojiPicker(false);
                setEmojiPickerAnchorRect(null);
              }}
            />
          </div>
        </>,
        document.body
      )}

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-0">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Full size preview"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

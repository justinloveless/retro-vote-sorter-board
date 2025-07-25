import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MessageCircle, Smile, CornerUpLeft, X, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '@/hooks/usePokerSessionChat';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';
import { Badge } from '@/components/ui/badge';
import { processMentionsForDisplay } from './TiptapEditorWithMentions';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { TiptapEditor } from './TiptapEditor';
import { QuickReactionPicker } from './QuickReactionPicker';

interface PokerSessionChatProps {
  isCollapsible?: boolean;
}

export const PokerSessionChat: React.FC<PokerSessionChatProps> = ({
  isCollapsible = true,
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

  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean | string>(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactingToId, setReactingToId] = useState<string | null>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    if (!newMessage.trim() || newMessage === '<p></p>' || isViewingHistory) return;

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

  const processMessageContent = (content: string) => {
    // Replace img tags with clickable images
    return content.replace(/<img([^>]*?)src="([^"]*?)"([^>]*?)>/g, (match, beforeSrc, src, afterSrc) => {
      return `<img${beforeSrc}src="${src}"${afterSrc} style="cursor: pointer; max-width: 200px; max-height: 150px; border-radius: 8px;" onclick="window.handleChatImageClick('${src}')" />`;
    });
  };

  // Make handleImageClick available globally for the onclick handler
  useEffect(() => {
    (window as any).handleChatImageClick = handleImageClick;
    return () => {
      delete (window as any).handleChatImageClick;
    };
  }, []);

  const renderMessage = (message: ChatMessage) => {
    const isCurrentUser = message.user_id === currentUserId;

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
          className={`max-w-[70%] rounded-lg px-3 py-2 ${isCurrentUser
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
            className="text-sm prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(processMessageContent(message.message)) }}
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

  const ChatHeader = ({ isCollapsible }: { isCollapsible: boolean }) => (
    <CardHeader className="flex-shrink-0 pb-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <MessageCircle className="h-5 w-5" />
        <span>
          Round {currentRoundNumber} Chat
        </span>
        {messages.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {messages.length > 99 ? '99+' : messages.length}
          </Badge>
        )}
        {isCollapsible && <ChevronDown className={`h-5 w-5 ml-auto transform transition-transform ${isChatOpen ? 'rotate-0' : '-rotate-90'}`} />}
      </CardTitle>
    </CardHeader>
  );

  const renderChatContent = () => (
    <ChatContent />
  );

  const ChatContent = () => (
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
                onClick={() => setShowEmojiPicker(prev => prev ? false : 'main')}
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
            {showEmojiPicker === 'main' && (
              <div className="absolute bottom-full right-0 mb-2 z-10">
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
  );

  if (!isCollapsible) {
    return (
      <>
        <Card className="h-full flex flex-col">
          <ChatHeader isCollapsible={false} />
          {renderChatContent()}
        </Card>

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
  }

  return (
    <>
      <Collapsible
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
        asChild
      >
        <Card className={`h-full flex flex-col ${!isChatOpen ? 'h-auto' : ''}`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex-shrink-0 pb-3 cursor-pointer">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5" />
                <span>
                  Round {currentRoundNumber} Chat
                </span>
                {messages.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {messages.length}
                  </Badge>
                )}
                <ChevronDown className={`h-5 w-5 ml-auto transform transition-transform ${isChatOpen ? 'rotate-0' : '-rotate-90'}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent asChild>
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
                        onClick={() => setShowEmojiPicker(prev => prev ? false : 'main')}
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
                    {showEmojiPicker === 'main' && (
                      <div className="absolute bottom-full right-0 mb-2 z-10">
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

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

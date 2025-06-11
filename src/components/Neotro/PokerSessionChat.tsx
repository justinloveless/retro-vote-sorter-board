import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MessageCircle, Smile } from 'lucide-react';
import { usePokerSessionChat, ChatMessage } from '@/hooks/usePokerSessionChat';
import { Badge } from '@/components/ui/badge';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import linkifyHtml from 'linkify-html';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import * as emoji from 'node-emoji';
import './PokerSessionChat.css';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<ReactQuill>(null);
  const { messages, loading, sendMessage, uploadImage } = usePokerSessionChat(
    sessionId,
    currentRoundNumber,
    currentUserId,
    currentUserName
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isViewingHistory) return;

    const processedMessage = newMessage.replace(/:(\w+):/g, (match, shortcode) => {
      const emojiChar = emoji.get(shortcode);
      return emojiChar || match;
    });

    const success = await sendMessage(processedMessage);
    if (success) {
      setNewMessage('');
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
    
    return (
      <div
        key={message.id}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}
      >
        <div
          className={`max-w-[70%] rounded-lg px-3 py-2 ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{message.user_name}</span>
            <span className="text-xs opacity-70">{formatTime(message.created_at)}</span>
          </div>
          <div 
            className="text-sm prose dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizedMessage }} 
          />
        </div>
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
        <ScrollArea className="flex-1 pr-4">
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
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 mt-3 pt-3 border-t">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={newMessage}
              onChange={setNewMessage}
              modules={{ 
                toolbar: false,
                clipboard: {
                  matchVisual: false,
                }
              }}
              placeholder="Type a message..."
              className="flex-1"
            />
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
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
            {showEmojiPicker && (
              <div className="emoji-picker-container">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </form>
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

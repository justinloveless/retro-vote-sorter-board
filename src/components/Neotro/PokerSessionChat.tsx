
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MessageCircle } from 'lucide-react';
import { usePokerSessionChat, ChatMessage } from '@/hooks/usePokerSessionChat';
import { Badge } from '@/components/ui/badge';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sendMessage } = usePokerSessionChat(
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

    const success = await sendMessage(newMessage);
    if (success) {
      setNewMessage('');
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
          <p className="text-sm">{message.message}</p>
        </div>
      </div>
    );
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
          <form onSubmit={handleSendMessage} className="flex gap-2 mt-3 pt-3 border-t">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              maxLength={500}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
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

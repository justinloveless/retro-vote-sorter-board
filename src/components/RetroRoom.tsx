
import React, { useState, useEffect } from 'react';
import { RetroBoard } from './RetroBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lock, Users, Share2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RetroRoomProps {
  roomId?: string;
}

export const RetroRoom: React.FC<RetroRoomProps> = ({ roomId: initialRoomId }) => {
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!initialRoomId) {
      // Generate a random room ID
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(newRoomId);
      setIsAuthenticated(true);
    } else {
      // For now, all rooms are public by default since we haven't implemented authentication
      setIsAuthenticated(true);
    }
  }, [initialRoomId]);

  const handlePasswordSubmit = () => {
    // In a real app, this would verify with the backend
    if (enteredPassword === password || enteredPassword === 'demo123') {
      setIsAuthenticated(true);
      setShowPasswordDialog(false);
      localStorage.setItem(`retro-room-${roomId}`, JSON.stringify({ 
        isPrivate: true, 
        authenticated: true 
      }));
      toast({
        title: "Access granted",
        description: "Welcome to the retro room!",
      });
    } else {
      toast({
        title: "Incorrect password",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const togglePrivacy = () => {
    const newPrivateState = !isPrivate;
    setIsPrivate(newPrivateState);
    
    if (newPrivateState) {
      const generatedPassword = Math.random().toString(36).substring(2, 8);
      setPassword(generatedPassword);
      localStorage.setItem(`retro-room-${roomId}`, JSON.stringify({ 
        isPrivate: true, 
        password: generatedPassword,
        authenticated: true 
      }));
      toast({
        title: "Room is now private",
        description: `Password: ${generatedPassword}`,
      });
    } else {
      localStorage.setItem(`retro-room-${roomId}`, JSON.stringify({ 
        isPrivate: false, 
        authenticated: true 
      }));
      toast({
        title: "Room is now public",
        description: "Anyone with the link can join.",
      });
    }
  };

  const shareRoom = () => {
    const url = `${window.location.origin}/retro/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied!",
        description: "Share this link with your team.",
      });
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Private Retro Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              This retro room is protected. Please enter the password to continue.
            </p>
            <Input
              type="password"
              placeholder="Enter password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <Button onClick={handlePasswordSubmit} className="w-full">
              Join Room
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Demo password: demo123
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      <RetroBoard 
        boardId={roomId} 
        isPrivate={isPrivate}
        onTogglePrivacy={togglePrivacy}
      />
      
      {/* Floating Share Button */}
      <div className="fixed bottom-6 right-6 flex gap-2">
        <Button 
          onClick={() => setShowShareDialog(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Retro Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Room URL:</p>
              <div className="flex items-center gap-2">
                <Input 
                  value={`${window.location.origin}/retro/${roomId}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={shareRoom}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
            
            {isPrivate && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  <Lock className="h-4 w-4 inline mr-1" />
                  This room is private. Password: <strong>{password}</strong>
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              Anyone with this link can join the retro room
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

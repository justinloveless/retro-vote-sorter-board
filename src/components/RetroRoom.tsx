
import React, { useState, useEffect } from 'react';
import { RetroBoard } from './RetroBoard';
import { AuthForm } from './AuthForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lock, Share2, Copy, Check, User, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface RetroRoomProps {
  roomId?: string;
}

// Generate random silly names for anonymous users
const generateSillyName = () => {
  const adjectives = ['Happy', 'Sneaky', 'Dancing', 'Bouncy', 'Giggly', 'Sparkly', 'Fuzzy', 'Mighty', 'Sleepy', 'Jolly'];
  const animals = ['Penguin', 'Koala', 'Llama', 'Panda', 'Dolphin', 'Octopus', 'Hedgehog', 'Platypus', 'Narwhal', 'Sloth'];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  return `${randomAdjective} ${randomAnimal}`;
};

export const RetroRoom: React.FC<RetroRoomProps> = ({ roomId: initialRoomId }) => {
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [boardData, setBoardData] = useState<any>(null);
  const [hasRoomAccess, setHasRoomAccess] = useState(false);
  const [anonymousName] = useState(() => generateSillyName());
  const [isTeamMember, setIsTeamMember] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialRoomId) {
      // Generate a random room ID
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(newRoomId);
      setHasRoomAccess(true);
    } else {
      // Check if room exists and is private
      checkRoomAccess();
    }
  }, [initialRoomId]);

  const checkRoomAccess = async () => {
    if (!roomId) return;

    try {
      const { data: board, error } = await supabase
        .from('retro_boards')
        .select(`
          *,
          teams!inner(
            id,
            name,
            team_members(user_id, role)
          )
        `)
        .eq('room_id', roomId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (board) {
        setBoardData(board);
        setIsPrivate(board.is_private);

        // Check if user is a team member for this board
        if (board.team_id && user && board.teams) {
          const teamMembers = board.teams.team_members || [];
          const isMember = teamMembers.some((member: any) => member.user_id === user.id);
          setIsTeamMember(isMember);
        }

        if (board.is_private && board.password_hash) {
          // If user is a team member, grant access automatically
          if (board.team_id && user && isTeamMember) {
            setHasRoomAccess(true);
          } else {
            // Check if user already authenticated for this room
            const savedAuth = localStorage.getItem(`retro-room-${roomId}`);
            if (savedAuth) {
              const authData = JSON.parse(savedAuth);
              if (authData.authenticated) {
                setHasRoomAccess(true);
              } else {
                setShowPasswordDialog(true);
              }
            } else {
              setShowPasswordDialog(true);
            }
          }
        } else {
          setHasRoomAccess(true);
        }
      } else {
        // Room doesn't exist, allow access to create it
        setHasRoomAccess(true);
      }
    } catch (error) {
      console.error('Error checking room access:', error);
      toast({
        title: "Error accessing room",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordSubmit = async () => {
    if (!boardData || !enteredPassword) return;

    // Simple password check (in production, you'd hash and compare)
    if (enteredPassword === 'demo123' || boardData.password_hash === enteredPassword) {
      setHasRoomAccess(true);
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

  const togglePrivacy = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to sign in to change room settings.",
        variant: "destructive",
      });
      return;
    }

    const newPrivateState = !isPrivate;
    setIsPrivate(newPrivateState);
    
    if (newPrivateState) {
      const generatedPassword = Math.random().toString(36).substring(2, 8);
      setPassword(generatedPassword);
      
      // Update board in database
      await supabase
        .from('retro_boards')
        .update({ 
          is_private: true, 
          password_hash: generatedPassword 
        })
        .eq('room_id', roomId);
      
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
      // Update board in database
      await supabase
        .from('retro_boards')
        .update({ 
          is_private: false, 
          password_hash: null 
        })
        .eq('room_id', roomId);
      
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (showPasswordDialog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Private Retro Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
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

  if (!hasRoomAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Checking room access...</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <RetroBoard 
        boardId={roomId} 
        isPrivate={isPrivate}
        onTogglePrivacy={togglePrivacy}
        anonymousName={anonymousName}
        isAnonymousUser={!user}
      />
      
      {/* Floating Buttons */}
      <div className="fixed bottom-6 right-6 flex gap-2">
        <Button 
          onClick={() => navigate('/')}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>
        
        <Button 
          onClick={() => setShowShareDialog(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        
        {!user && (
          <Button 
            onClick={() => setShowAuthDialog(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            Sign In
          </Button>
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Retro Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Room URL:</p>
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
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  <Lock className="h-4 w-4 inline mr-1" />
                  This room is private. Password: <strong>{password}</strong>
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              Share this link with your team members
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Dialog for Anonymous Users */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign In</DialogTitle>
          </DialogHeader>
          <AuthForm onAuthSuccess={() => setShowAuthDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

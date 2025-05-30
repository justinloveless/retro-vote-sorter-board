
import React, { useState, useEffect } from 'react';
import { RetroBoard } from './RetroBoard';
import { AuthForm } from './AuthForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PasswordDialog } from './retro/PasswordDialog';
import { ShareDialog } from './retro/ShareDialog';
import { FloatingButtons } from './retro/FloatingButtons';
import { useRoomAccess } from '@/hooks/useRoomAccess';

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
  const [password, setPassword] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [anonymousName] = useState(() => generateSillyName());
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    boardData,
    hasRoomAccess,
    isPrivate,
    showPasswordDialog,
    isTeamMember,
    handlePasswordSubmit,
    setIsPrivate
  } = useRoomAccess(roomId, user);

  useEffect(() => {
    if (!initialRoomId) {
      // Generate a random room ID
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(newRoomId);
    }
  }, [initialRoomId]);

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (showPasswordDialog) {
    return <PasswordDialog onPasswordSubmit={handlePasswordSubmit} />;
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
      
      <FloatingButtons
        onShare={() => setShowShareDialog(true)}
        onSignIn={() => setShowAuthDialog(true)}
        showSignIn={!user}
      />

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        roomId={roomId}
        isPrivate={isPrivate}
        password={password}
      />

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

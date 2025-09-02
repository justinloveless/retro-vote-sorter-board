import React, { useState, useEffect, useRef } from 'react';
import { RetroBoard } from './RetroBoard';
import { AuthForm } from './AuthForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog.tsx';
import { useToast } from '../hooks/use-toast.ts';
import { useAuth } from '../hooks/useAuth.tsx';
import { useSlackNotification } from '../hooks/useSlackNotification.ts';
import { supabase } from '../integrations/supabase/client.ts';
import { PasswordDialog } from './retro/PasswordDialog';
import { ShareDialog } from './retro/ShareDialog';
import { FloatingButtons } from './retro/FloatingButtons';
import { useRoomAccess } from '../hooks/useRoomAccess.ts';
import { BoardNotFound } from './retro/BoardNotFound';
import { AppHeader } from './AppHeader';

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
  const [showNotifyTeamDialog, setShowNotifyTeamDialog] = useState(false);
  const [anonymousName] = useState(() => generateSillyName());
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { sendSlackNotification, createRetroSession } = useSlackNotification();

  const {
    boardData,
    accessStatus,
    isPrivate,
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

  // Notification dialog is now only opened via the bell in the header
  useEffect(() => {
    setPassword(boardData?.password_hash || '');
    setIsPrivate(boardData?.is_private || false);

    const openHandler = () => setShowNotifyTeamDialog(true);
    window.addEventListener('open-notify-team', openHandler as any);
    return () => window.removeEventListener('open-notify-team', openHandler as any);
  }, [boardData]);

  const handleNotifyTeam = async () => {
    if (!boardData || !user) return;

    try {
      await createRetroSession(boardData.id, boardData.team_id, user.id);

      await sendSlackNotification(
        boardData.id,
        boardData.team_id,
        boardData.title,
        roomId,
        user.id
      );
      toast({
        title: "Team notified!",
        description: "We've let your team know you've started the retro.",
      });
    } catch (error) {
      console.error('Error with Slack notification flow:', error);
      toast({
        title: "Notification failed",
        description: "We couldn't notify your team. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setShowNotifyTeamDialog(false);
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

  if (authLoading || accessStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (accessStatus === 'password_required') {
    return <PasswordDialog onPasswordSubmit={handlePasswordSubmit} />;
  }

  if (accessStatus === 'denied') {
    return <BoardNotFound />;
  }

  return (
    <div className="relative pt-24 md:pt-0 min-h-screen">

      <AppHeader variant='back' handleSignIn={() => setShowAuthDialog(true)} />
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

      <AlertDialog open={showNotifyTeamDialog} onOpenChange={setShowNotifyTeamDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notify team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a notification to your team's Slack channel to join the retro session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleNotifyTeam}>Notify Team</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auth Dialog for Anonymous Users */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign In 2</DialogTitle>
          </DialogHeader>
          <AuthForm redirectTo={`/retro/${roomId}`} onAuthSuccess={() => setShowAuthDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};


import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Share2, User } from 'lucide-react';

interface FloatingButtonsProps {
  onShare: () => void;
  onSignIn?: () => void;
  showSignIn?: boolean;
}

export const FloatingButtons: React.FC<FloatingButtonsProps> = ({
  onShare,
  onSignIn,
  showSignIn = false
}) => {
  const navigate = useNavigate();

  return (
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
        onClick={onShare}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      
      {showSignIn && (
        <Button 
          onClick={onSignIn}
          variant="outline"
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Sign In
        </Button>
      )}
    </div>
  );
};

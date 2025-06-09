import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, User, LogOut, Shield } from 'lucide-react';

export const NeotroHeader: React.FC = () => {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="p-4 bg-transparent flex items-center justify-between">
      <Button variant="ghost" onClick={() => navigate(`/teams/${teamId}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Team
      </Button>
      <div className="flex items-center gap-2">
        {profile?.role === 'admin' && (
          <Button variant="outline" onClick={() => navigate('/admin')} className="mr-2">
            <Shield className="h-4 w-4 mr-2" />
            Admin Dashboard
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate('/account')} className="mr-2">
          <User className="h-4 w-4 mr-2" />
          My Account
        </Button>
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}; 
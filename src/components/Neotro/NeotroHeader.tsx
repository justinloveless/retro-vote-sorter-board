import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, User } from 'lucide-react';

export const NeotroHeader: React.FC = () => {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();

  return (
    <div className="p-4 bg-transparent flex items-center justify-between">
      <div>
        <Button variant="ghost" onClick={() => navigate(`/teams/${teamId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Team
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <Home className="h-4 w-4 mr-2" />
          Home
        </Button>
        <Button variant="ghost" onClick={() => navigate('/account')}>
          <User className="h-4 w-4 mr-2" />
          Account
        </Button>
      </div>
    </div>
  );
}; 
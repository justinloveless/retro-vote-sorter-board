import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const NeotroHeader: React.FC = () => {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();

  return (
    <div className="p-4 bg-transparent flex items-center">
      <Button variant="ghost" onClick={() => navigate(`/teams/${teamId}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Team
      </Button>
    </div>
  );
}; 
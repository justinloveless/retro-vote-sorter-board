
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamBoards } from '@/hooks/useTeamBoards';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { TeamHeader } from '@/components/team/TeamHeader';
import { TeamBoardsList } from '@/components/team/TeamBoardsList';
import { TeamSidebar } from '@/components/team/TeamSidebar';
import { CreateBoardDialog } from '@/components/team/CreateBoardDialog';

const Team = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { boards, loading: boardsLoading, createBoardForTeam } = useTeamBoards(teamId || null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId) return;

      try {
        const { data, error } = await supabase
          .from('teams')
          .select(`
            *,
            team_members!inner(role)
          `)
          .eq('id', teamId)
          .single();

        if (error) throw error;
        setTeam(data);
      } catch (error) {
        console.error('Error loading team:', error);
        toast({
          title: "Error loading team",
          description: "Please try again.",
          variant: "destructive",
        });
        navigate('/teams');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [teamId, navigate, toast]);

  const handleCreateBoard = async (title: string, isPrivate: boolean, password: string | null) => {
    const board = await createBoardForTeam(title, isPrivate, password);
    if (board) {
      setShowCreateDialog(false);
      navigate(`/retro/${board.room_id}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Team not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <TeamHeader team={team} onCreateBoard={() => setShowCreateDialog(true)} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Retro Boards</h2>
            <TeamBoardsList 
              boards={boards}
              loading={boardsLoading}
              onCreateBoard={() => setShowCreateDialog(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <TeamSidebar team={team} boardCount={boards.length} />
          </div>
        </div>

        <CreateBoardDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateBoard={handleCreateBoard}
        />
      </div>
    </div>
  );
};

export default Team;

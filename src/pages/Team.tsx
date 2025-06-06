import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamBoards } from '@/hooks/useTeamBoards';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { TeamHeader } from '@/components/team/TeamHeader';
import { TeamBoardsList } from '@/components/team/TeamBoardsList';
import { TeamSidebar } from '@/components/team/TeamSidebar';
import { TeamMembersList } from '@/components/team/TeamMembersList';
import { CreateBoardDialog } from '@/components/team/CreateBoardDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Neotro from '@/components/Neotro/PokerTable';

const Team = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { boards, loading: boardsLoading, createBoardForTeam, refetch: refetchBoards } = useTeamBoards(teamId || null);
  const { members } = useTeamMembers(teamId || null);
  const [team, setTeam] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId || !user) return;

      try {
        const { data, error } = await supabase
          .from('teams')
          .select(`
            *,
            team_members!inner(role)
          `)
          .eq('id', teamId)
          .eq('team_members.user_id', user.id)
          .single();

        if (error) throw error;
        
        setTeam(data);
        // Get current user's role
        setCurrentUserRole(data.team_members[0]?.role);
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
  }, [teamId, user, navigate, toast]);

  const handleCreateBoard = async (title: string, isPrivate: boolean, password: string | null) => {
    const board = await createBoardForTeam(title, isPrivate, password);
    if (board) {
      setShowCreateDialog(false);
      navigate(`/retro/${board.room_id}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Team not found</div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed background with blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#336852ff]">
        {/* Blue Blob */}
        <div className="absolute top-1/3 right-1/4 w-64 h-64 sm:w-72 sm:h-72 md:w-[800px] md:h-[800px] bg-blue-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-2"></div>
        {/* Green Blob */}
        <div className="absolute bottom-1/3 left-1/2 w-64 h-64 sm:w-72 sm:h-72 md:w-[800px] md:h-[800px] bg-green-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-2"></div>
        {/* Red Blob */}
        <div className="absolute bottom-1/4 right-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-[800px] md:h-[800px] bg-red-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-1"></div>
        <div className="absolute top-1/4 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-[800px] md:h-[800px] bg-red-500 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-3xl md:blur-[300px] animate-blob-1"></div>
        {/* Yellow Blob */}
        <div className="absolute bottom-1/4 left-1/3 w-56 h-56 sm:w-64 sm:h-64 md:w-[800px] md:h-[800px] bg-yellow-400 rounded-full opacity-60 mix-blend-lighten filter blur-2xl sm:blur-10xl md:blur-[300px] animate-blob-3"></div>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <TeamHeader team={team} onCreateBoard={() => setShowCreateDialog(true)} />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Tabs defaultValue="boards" className="space-y-4">
                <TabsList >
                  <TabsTrigger value="boards">Retro Boards</TabsTrigger>
                  <TabsTrigger value="members">Team Members</TabsTrigger>
                  <TabsTrigger value="neotro">Pointing Session</TabsTrigger>
                </TabsList>
                
                <TabsContent value="boards" className="space-y-4">
                  <TeamBoardsList 
                    boards={boards}
                    loading={boardsLoading}
                    currentUserRole={currentUserRole}
                    onCreateBoard={() => setShowCreateDialog(true)}
                    onBoardUpdated={refetchBoards}
                  />
                </TabsContent>
                
                <TabsContent value="members" className="space-y-4">
                  <TeamMembersList 
                    teamId={teamId!} 
                    teamName={team.name}
                    currentUserRole={currentUserRole} 
                  />
                </TabsContent>

                <TabsContent value="neotro" className="space-y-4">
                  <Neotro />
                </TabsContent>
              </Tabs>
            </div>

            <div className="lg:col-span-1">
              <TeamSidebar 
                team={team} 
                boardCount={boards.length}
                memberCount={members.length}
              />
            </div>
          </div>

          <CreateBoardDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onCreateBoard={handleCreateBoard}
          />
        </div>
      </div>
    </>
  );
};

export default Team;

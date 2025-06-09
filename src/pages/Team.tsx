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
import { Button } from '@/components/ui/button';
import { Home, User, LogOut, Shield } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';

const Team = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { boards, loading: boardsLoading, createBoardForTeam, refetch: refetchBoards } = useTeamBoards(teamId || null);
  const { members } = useTeamMembers(teamId || null);
  const [team, setTeam] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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
    return <AuthForm onAuthSuccess={() => { }} />;
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
      <AppHeader variant='home' />
      {/* Scrollable content */}
      <div className="relative z-10 min-h-screen">
        <div className={`container mx-auto px-4 py-6 ${isMobile ? 'max-w-full' : 'max-w-4xl'}`}>
          <TeamHeader
            team={team}
            onCreateBoard={() => setShowCreateDialog(true)}
            onJoinPointingSession={() => navigate(`/teams/${teamId}/neotro`)}
            currentUserRole={currentUserRole}
          />

          <div className={`${isMobile ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-4 gap-6'}`}>
            {/* Main content area */}
            <div className={isMobile ? 'order-1' : 'lg:col-span-3'}>
              <Tabs defaultValue="boards" className="space-y-4">
                <TabsList className={`${isMobile ? 'grid w-full grid-cols-2 h-12' : ''}`}>
                  <TabsTrigger value="boards" className={isMobile ? 'text-sm px-2' : ''}>
                    {isMobile ? 'Boards' : 'Retro Boards'}
                  </TabsTrigger>
                  <TabsTrigger value="members" className={isMobile ? 'text-sm px-2' : ''}>
                    {isMobile ? 'Members' : 'Team Members'}
                  </TabsTrigger>
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
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className={`${isMobile ? 'order-2' : 'lg:col-span-1'}`}>
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

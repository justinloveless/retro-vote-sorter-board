import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamData } from '../contexts/TeamDataContext.tsx';
import { useToast } from '../hooks/use-toast.ts';
import { useAuth } from '../hooks/useAuth.tsx';
import { supabase } from '../integrations/supabase/client.ts';
import { AuthForm } from '../components/AuthForm.tsx';
import { TeamHeader } from '../components/team/TeamHeader.tsx';
import { TeamBoardsList } from '../components/team/TeamBoardsList.tsx';
import { TeamSidebar } from '../components/team/TeamSidebar.tsx';
import { TeamMembersList } from '../components/team/TeamMembersList.tsx';
import { CreateBoardDialog } from '../components/team/CreateBoardDialog.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';
import { Button } from '../components/ui/button.tsx';
import { Home, User, LogOut, Shield } from 'lucide-react';
import { AppHeader } from '../components/AppHeader.tsx';
import { useIsMobile } from '../hooks/use-mobile.tsx';
import { TeamFloatingActions } from '../components/team/TeamFloatingActions.tsx';
import { TeamActionItems } from '../components/team/TeamActionItems.tsx';

const Team = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const teamData = useTeamData();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Use cached data
  const { data: team, loading: teamLoading } = teamData.getTeamInfo(teamId || '');
  const { data: boards, loading: boardsLoading, refetch: refetchBoards } = teamData.getBoards(teamId || '');
  const { data: members } = teamData.getMembers(teamId || '');

  const currentUserRole = useMemo(() => {
    return team?.team_members[0]?.role;
  }, [team]);

  // Navigate away if team not found after loading
  useEffect(() => {
    if (!teamLoading && !team && teamId && profile) {
      toast({
        title: "Error loading team",
        description: "Team not found or you don't have access.",
        variant: "destructive",
      });
      navigate('/teams');
    }
  }, [teamLoading, team, teamId, profile, navigate, toast]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const createBoardForTeam = async (title: string, isPrivate: boolean = false, password: string | null = null) => {
    if (!teamId) return null;

    try {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      let passwordHash = null;

      if (isPrivate && password) {
        // Hash the password using Web Crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const { data, error } = await supabase
        .from('retro_boards')
        .insert([{
          room_id: roomId,
          title,
          is_private: isPrivate,
          password_hash: passwordHash,
          team_id: teamId
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Board created",
        description: `"${title}" has been created successfully.`,
      });

      // Invalidate boards cache to refetch
      teamData.invalidateTeamCache(teamId);
      refetchBoards();

      return data;
    } catch (error) {
      console.error('Error creating board:', error);
      toast({
        title: "Error creating board",
        description: "Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleCreateBoard = async (title: string, isPrivate: boolean, password: string | null) => {
    const board = await createBoardForTeam(title, isPrivate, password);
    if (board) {
      setShowCreateDialog(false);
      navigate(`/retro/${board.room_id}`);
    }
  };

  if (authLoading || teamLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm redirectTo={`/teams/${teamId}`} onAuthSuccess={() => { }} />;
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
      <AppHeader variant={isMobile ? 'back' : 'home'} />
      {/* Scrollable content */}
      <div className="relative z-10 min-h-screen pt-16 md:pt-0 pb-24 md:pb-0">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <TeamHeader
            team={team}
            onCreateBoard={() => setShowCreateDialog(true)}
            onJoinPointingSession={() => navigate(`/teams/${teamId}/neotro`)}
            currentUserRole={currentUserRole}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Tabs defaultValue="boards" className="space-y-4">
                <TabsList >
                  <TabsTrigger value="boards">Retro Boards</TabsTrigger>
                  <TabsTrigger value="members">Team Members</TabsTrigger>
                  <TabsTrigger value="action-items">Action Items</TabsTrigger>
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

                <TabsContent value="action-items" className="space-y-4">
                  <TeamActionItems teamId={teamId!} />
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
      {isMobile && (
        <TeamFloatingActions
          onCreateBoard={() => setShowCreateDialog(true)}
          onJoinPointingSession={() => navigate(`/teams/${teamId}/neotro`)}
          onSettings={() => navigate(`/teams/${teamId}/settings`)}
          currentUserRole={currentUserRole}
        />
      )}
    </>
  );
};

export default Team;

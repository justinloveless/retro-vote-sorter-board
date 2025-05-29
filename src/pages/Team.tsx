
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Calendar, Users, Settings } from 'lucide-react';
import { useTeamBoards } from '@/hooks/useTeamBoards';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';

const Team = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { boards, loading: boardsLoading, createBoardForTeam } = useTeamBoards(teamId || null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [boardTitle, setBoardTitle] = useState('');
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

  const handleCreateBoard = async () => {
    if (!boardTitle.trim()) return;

    const board = await createBoardForTeam(boardTitle.trim());
    if (board) {
      setShowCreateDialog(false);
      setBoardTitle('');
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
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/teams')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
            {team.description && (
              <p className="text-gray-600 mt-2">{team.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`/teams/${teamId}/settings`)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Board
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Retro Boards</h2>
            
            {boardsLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-600">Loading boards...</div>
              </div>
            ) : boards.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No retro boards yet</h3>
                  <p className="text-gray-600 mb-4">Create your first retro board for this team.</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Board
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boards.map((board) => (
                  <Card key={board.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{board.title}</span>
                        {board.is_private && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Private
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-gray-500 mb-4">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(board.created_at).toLocaleDateString()}
                      </div>
                      <Button
                        onClick={() => navigate(`/retro/${board.room_id}`)}
                        className="w-full"
                      >
                        Open Board
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Created:</span>
                    <br />
                    {new Date(team.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Boards:</span>
                    <br />
                    {boards.length} retro board{boards.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Retro Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Board Title
                </label>
                <Input
                  value={boardTitle}
                  onChange={(e) => setBoardTitle(e.target.value)}
                  placeholder="e.g., Sprint 23 Retrospective"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateBoard()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBoard} className="flex-1" disabled={!boardTitle.trim()}>
                  Create Board
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Team;

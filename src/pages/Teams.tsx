import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Calendar, Settings, Home, User, LogOut, Shield } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { AppHeader } from '@/components/AppHeader';

const Teams = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { teams, loading, createTeam } = useTeams();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;

    await createTeam(teamName.trim(), teamDescription.trim() || undefined);
    setShowCreateDialog(false);
    setTeamName('');
    setTeamDescription('');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => { }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader variant='home' />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Teams</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your teams and create retro boards</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>

        {teams.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No teams yet</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">Create your first team to start collaborating on retro boards.</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <Card key={team.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{team.name}</span>
                      {(team.role === 'owner' || team.role === 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/teams/${team.id}/settings`);
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {team.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{team.description}</p>
                    )}
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <Calendar className="h-4 w-4 mr-1" />
                      Created {new Date(team.created_at).toLocaleDateString()}
                    </div>
                    <Button
                      onClick={() => navigate(`/teams/${team.id}`)}
                      className="w-full"
                    >
                      View Team
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Name
                </label>
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <Textarea
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="Enter team description"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTeam} className="flex-1" disabled={!teamName.trim()}>
                  Create Team
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

export default Teams;

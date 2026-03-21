import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Calendar, Settings, Star } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { useOrgSelector } from '@/contexts/OrgSelectorContext';
import { AuthForm } from '@/components/AuthForm';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const Teams = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { teams, loading, createTeam } = useTeams();
  const { limits, tier } = useSubscriptionLimits();
  const { selectedOrgId, hasOrgs } = useOrgSelector();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadFavorites = async () => {
      const { data } = await supabase
        .from('user_favorite_teams')
        .select('team_id')
        .eq('user_id', user.id);
      if (data) setFavorites(data.map(d => d.team_id));
    };
    loadFavorites();
  }, [user]);

  const toggleFavorite = useCallback(async (teamId: string) => {
    if (!user) return;
    const isFav = favorites.includes(teamId);
    // Optimistic update
    setFavorites(prev => isFav ? prev.filter(id => id !== teamId) : [...prev, teamId]);
    if (isFav) {
      await supabase
        .from('user_favorite_teams')
        .delete()
        .eq('user_id', user.id)
        .eq('team_id', teamId);
    } else {
      await supabase
        .from('user_favorite_teams')
        .insert({ user_id: user.id, team_id: teamId });
    }
  }, [user, favorites]);

  // Filter teams based on selected org, then sort favorites first
  const filteredTeams = useMemo(() => {
    let result = teams;
    if (hasOrgs) {
      result = selectedOrgId
        ? teams.filter(t => t.organization_id === selectedOrgId)
        : teams.filter(t => !t.organization_id);
    }
    return [...result].sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [teams, selectedOrgId, hasOrgs, favorites]);

  const ownedTeams = filteredTeams.filter(t => t.role === 'owner').length;
  const atTeamLimit = limits.maxTeams !== Infinity && ownedTeams >= limits.maxTeams;

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    await createTeam(teamName.trim(), teamDescription.trim() || undefined, selectedOrgId);
    setShowCreateDialog(false);
    setTeamName('');
    setTeamDescription('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm redirectTo={`/teams`} onAuthSuccess={() => { }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 md:pt-0">
      <AppHeader variant='home' />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Teams</h1>
            <p className="text-muted-foreground mt-2">Manage your teams and create retro boards</p>
          </div>
          <div className="flex items-center gap-3">
            {limits.maxTeams !== Infinity && (
              <Badge variant="outline" className="text-xs">
                {ownedTeams}/{limits.maxTeams} teams
              </Badge>
            )}
            <Button 
              onClick={() => setShowCreateDialog(true)} 
              className="flex items-center gap-2"
              disabled={atTeamLimit}
              title={atTeamLimit ? `Your ${tier} plan allows up to ${limits.maxTeams} team${limits.maxTeams === 1 ? '' : 's'}. Upgrade to create more.` : undefined}
            >
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          </div>
        </div>

        {filteredTeams.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No teams yet</h3>
              <p className="text-muted-foreground mb-4">Create your first team to start collaborating on retro boards.</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeams.map((team) => (
              <Card key={team.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{team.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(team.id);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Star className={`h-4 w-4 ${favorites.includes(team.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                        </Button>
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
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {team.description && (
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{team.description}</p>
                    )}
                    <div className="flex items-center text-sm text-muted-foreground mb-4">
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

        {/* Create Team Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Team Name</label>
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
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

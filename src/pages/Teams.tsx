import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Calendar, Settings, Building2 } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import { useSubscription } from '@/hooks/useSubscription';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useOrgSelector } from '@/contexts/OrgSelectorContext';
import { AuthForm } from '@/components/AuthForm';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const Teams = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { teams, loading, createTeam } = useTeams();
  const { limits, tier } = useSubscriptionLimits();
  const { tier: subTier } = useSubscription();
  const { organizations, loading: orgsLoading, createOrganization } = useOrganizations();
  const { selectedOrgId, selectedOrg, hasOrgs } = useOrgSelector();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgDescription, setOrgDescription] = useState('');

  // Filter teams based on selected org
  const filteredTeams = useMemo(() => {
    if (!hasOrgs) return teams; // No orgs = show all teams
    if (selectedOrgId) {
      return teams.filter((t: any) => t.organization_id === selectedOrgId);
    }
    // Personal: show teams not linked to any org
    return teams.filter((t: any) => !t.organization_id);
  }, [teams, selectedOrgId, hasOrgs]);

  const ownedTeams = filteredTeams.filter(t => t.role === 'owner').length;
  const atTeamLimit = limits.maxTeams !== Infinity && ownedTeams >= limits.maxTeams;

  const canCreateOrg = subTier === 'enterprise' || profile?.role === 'admin';

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    await createTeam(teamName.trim(), teamDescription.trim() || undefined);
    setShowCreateDialog(false);
    setTeamName('');
    setTeamDescription('');
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !orgSlug.trim()) return;
    try {
      const org = await createOrganization(orgName.trim(), orgSlug.trim(), orgDescription.trim() || undefined);
      toast.success('Organization created!');
      setShowCreateOrgDialog(false);
      setOrgName('');
      setOrgSlug('');
      setOrgDescription('');
      navigate(`/org/${org.slug}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    }
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
        {/* Organizations Section */}
        {(organizations.length > 0 || canCreateOrg) && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Organizations</h2>
              </div>
              {canCreateOrg && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateOrgDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Org
                </Button>
              )}
            </div>
            {organizations.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center">
                  <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {canCreateOrg
                      ? 'Create your first organization to manage multiple teams under one umbrella.'
                      : 'Organizations are available on the Enterprise plan.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organizations.map((org) => (
                  <Card
                    key={org.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/org/${org.slug}`)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                        {org.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {org.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{org.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">/org/{org.slug}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teams Section */}
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

        {teams.length === 0 ? (
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

        {/* Create Organization Dialog */}
        <Dialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Organization Name</label>
                <Input
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    if (!orgSlug || orgSlug === orgName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')) {
                      setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
                    }
                  }}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">URL Slug</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/org/</span>
                  <Input
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="acme-corp"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                <Textarea
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Brief description of your organization"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateOrg} className="flex-1" disabled={!orgName.trim() || !orgSlug.trim()}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
                <Button variant="outline" onClick={() => setShowCreateOrgDialog(false)}>
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

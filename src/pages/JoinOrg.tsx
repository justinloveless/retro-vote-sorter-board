import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Building2, CheckCircle2, XCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

const JoinOrg = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [orgName, setOrgName] = useState('');
  const [ownedTeams, setOwnedTeams] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!code || !user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch invite code
        const { data: inviteData, error: inviteError } = await supabase
          .from('org_team_invite_codes')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single();

        if (inviteError || !inviteData) {
          setError('Invalid or expired invite code.');
          setLoading(false);
          return;
        }

        if (new Date(inviteData.expires_at) < new Date()) {
          setError('This invite code has expired.');
          setLoading(false);
          return;
        }

        setInvite(inviteData);

        // Get org name and user's owned unlinked teams in parallel
        const [orgResult, teamsResult] = await Promise.all([
          supabase
            .from('organizations')
            .select('name')
            .eq('id', inviteData.organization_id)
            .single(),
          supabase
            .from('teams')
            .select('id, name, description, organization_id, team_members!inner(role, user_id)')
            .eq('team_members.user_id', user.id)
            .eq('team_members.role', 'owner')
            .is('organization_id', null),
        ]);

        setOrgName(orgResult.data?.name || 'Unknown Organization');
        setOwnedTeams(teamsResult.data || []);
      } catch (err) {
        console.error(err);
        setError('Something went wrong.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [code, user]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTeamIds.size === ownedTeams.length) {
      setSelectedTeamIds(new Set());
    } else {
      setSelectedTeamIds(new Set(ownedTeams.map((t) => t.id)));
    }
  };

  const handleJoin = async () => {
    if (selectedTeamIds.size === 0 || !invite) return;
    setJoining(true);
    try {
      const ids = Array.from(selectedTeamIds);
      // Update all selected teams
      const { error } = await supabase
        .from('teams')
        .update({ organization_id: invite.organization_id })
        .in('id', ids);

      if (error) throw error;

      const count = ids.length;
      toast.success(`${count} team${count > 1 ? 's' : ''} linked to ${orgName}!`);
      navigate('/teams');
    } catch (err: any) {
      toast.error(err.message || 'Failed to link teams');
    } finally {
      setJoining(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Please sign in to use this invite link.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-16 text-center">
          <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invite</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const allSelected = ownedTeams.length > 0 && selectedTeamIds.size === ownedTeams.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Join {orgName}</CardTitle>
            <CardDescription>
              Select which teams to link to this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ownedTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                You don't have any unlinked teams that you own. Create a team first or unlink an existing one.
              </p>
            ) : (
              <>
                {/* Select All */}
                <div
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={toggleAll}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium text-foreground">
                    Link All ({ownedTeams.length} team{ownedTeams.length !== 1 ? 's' : ''})
                  </span>
                </div>

                {/* Team Cards */}
                <div className="space-y-2">
                  {ownedTeams.map((team) => {
                    const isSelected = selectedTeamIds.has(team.id);
                    return (
                      <div
                        key={team.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleTeam(team.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleTeam(team.id)}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{team.name}</p>
                            {team.description && (
                              <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={selectedTeamIds.size === 0 || joining}
                >
                  {joining ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Link {selectedTeamIds.size > 0 ? selectedTeamIds.size : ''} Team{selectedTeamIds.size !== 1 ? 's' : ''} to {orgName}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JoinOrg;

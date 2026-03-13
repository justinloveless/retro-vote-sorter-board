import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, CheckCircle2, XCircle } from 'lucide-react';
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
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
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

        // Get org name
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', inviteData.organization_id)
          .single();

        setOrgName(org?.name || 'Unknown Organization');

        // Get teams the user owns that are unlinked
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name, organization_id, team_members!inner(role, user_id)')
          .eq('team_members.user_id', user.id)
          .eq('team_members.role', 'owner')
          .is('organization_id', null);

        setOwnedTeams(teams || []);
      } catch (err) {
        console.error(err);
        setError('Something went wrong.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [code, user]);

  const handleJoin = async () => {
    if (!selectedTeamId || !invite) return;
    setJoining(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({ organization_id: invite.organization_id })
        .eq('id', selectedTeamId);

      if (error) throw error;

      toast.success(`Team linked to ${orgName}!`);
      navigate('/teams');
    } catch (err: any) {
      toast.error(err.message || 'Failed to link team');
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
              Link one of your teams to this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ownedTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                You don't have any unlinked teams that you own. Create a team first or unlink an existing one.
              </p>
            ) : (
              <>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team to link" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownedTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={!selectedTeamId || joining}
                >
                  {joining ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Link Team to {orgName}
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

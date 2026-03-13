import { useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/hooks/useOrganizations';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, Users, Settings, Loader2, Crown, Shield, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const roleIcons = { owner: Crown, admin: Shield, member: User };

const OrgDashboard = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { organization, members, myRole, loading } = useOrganization(slug);
  const [orgTeams, setOrgTeams] = useState<any[]>([]);

  useEffect(() => {
    if (!organization) return;
    supabase
      .from('teams')
      .select('id, name, description')
      .eq('organization_id', organization.id)
      .then(({ data }) => setOrgTeams(data || []));
  }, [organization]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader variant="back" backTo="/teams" />
        <div className="container mx-auto px-4 py-16 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Organization not found</h1>
          <p className="text-muted-foreground">You may not have access to this organization.</p>
        </div>
      </div>
    );
  }

  const isAdmin = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="back" backTo="/teams" />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{organization.name}</h1>
              <p className="text-muted-foreground text-sm">/org/{organization.slug}</p>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => navigate(`/org/${slug}/admin`)}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Org
            </Button>
          )}
        </div>

        {organization.description && (
          <p className="text-muted-foreground mb-8">{organization.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Teams */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Teams
              </CardTitle>
              <CardDescription>{orgTeams.length} team{orgTeams.length !== 1 ? 's' : ''} in this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {orgTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams linked to this organization yet.</p>
              ) : (
                <div className="space-y-3">
                  {orgTeams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/teams/${team.id}`)}
                    >
                      <div>
                        <p className="font-medium text-foreground">{team.name}</p>
                        {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
              <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.slice(0, 10).map((member) => {
                  const RoleIcon = roleIcons[member.role] || User;
                  return (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {(member.profile?.full_name || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.profile?.full_name || 'Unknown'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {member.role}
                      </Badge>
                    </div>
                  );
                })}
                {members.length > 10 && (
                  <p className="text-xs text-muted-foreground">+{members.length - 10} more</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OrgDashboard;

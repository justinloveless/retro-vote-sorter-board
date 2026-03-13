import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrganization, OrgMember } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Users, Settings, Loader2, Crown, Shield, User,
  Mail, Trash2, UserPlus, Unlink, Save, Copy, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

const OrgAdmin = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    organization, members, invitations, myRole, loading,
    inviteMember, updateMemberRole, removeMember, cancelInvitation,
    updateOrganization, linkTeam, unlinkTeam, refetch,
  } = useOrganization(slug);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDesc, setOrgDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [orgTeams, setOrgTeams] = useState<any[]>([]);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name);
      setOrgDesc(organization.description || '');
      // Fetch org teams and invite codes
      Promise.all([
        supabase.from('teams').select('id, name, organization_id')
          .eq('organization_id', organization.id),
        supabase.from('org_team_invite_codes').select('*')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]).then(([linked, codes]) => {
        setOrgTeams(linked.data || []);
        setInviteCodes((codes.data || []) as any[]);
      });
    }
  }, [organization]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization || (myRole !== 'owner' && myRole !== 'admin')) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader variant="back" backTo={`/org/${slug}`} />
        <div className="container mx-auto px-4 py-16 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access denied</h1>
          <p className="text-muted-foreground">You need admin or owner permissions to manage this organization.</p>
        </div>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateOrganization({ name: orgName, description: orgDesc || null });
      toast.success('Organization updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!organization || !user) return;
    setGeneratingCode(true);
    try {
      const { data, error } = await supabase
        .from('org_team_invite_codes')
        .insert({
          organization_id: organization.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setInviteCodes((prev) => [data as any, ...prev]);
      toast.success('Invite code generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleDeactivateCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('org_team_invite_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) throw error;
      setInviteCodes((prev) => prev.filter((c) => c.id !== codeId));
      toast.success('Invite code deactivated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate');
    }
  };

  const handleCopyInviteLink = (inviteCode: string) => {
    const link = `${window.location.origin}/join-org/${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard');
  };

  const roleIcons: Record<string, any> = { owner: Crown, admin: Shield, member: User };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="back" backTo={`/org/${slug}`} />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage {organization.name}</h1>
            <p className="text-sm text-muted-foreground">Organization administration</p>
          </div>
        </div>

        <Tabs defaultValue="members">
          <TabsList className="mb-6">
            <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" /> Members</TabsTrigger>
            <TabsTrigger value="teams"><Users className="h-4 w-4 mr-1" /> Teams</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            {/* Invite */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invite Member</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                    Invite
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Invitations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(inv.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{inv.role}</Badge>
                          <Button variant="ghost" size="icon" onClick={() => cancelInvitation(inv.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Members */}
            <Card>
              <CardHeader>
                <CardTitle>Members ({members.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {members.map((member) => {
                    const RoleIcon = roleIcons[member.role] || User;
                    const isCurrentUser = member.user_id === user?.id;
                    const isOwner = member.role === 'owner';

                    return (
                      <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.profile?.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {(member.profile?.full_name || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {member.profile?.full_name || 'Unknown'}
                            {isCurrentUser && <span className="text-muted-foreground"> (you)</span>}
                          </p>
                        </div>
                        {!isOwner && !isCurrentUser && myRole === 'owner' ? (
                          <Select
                            value={member.role}
                            onValueChange={(v: any) => updateMemberRole(member.id, v)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <RoleIcon className="h-3 w-3" />
                            {member.role}
                          </Badge>
                        )}
                        {!isOwner && !isCurrentUser && (
                          <Button variant="ghost" size="icon" onClick={() => removeMember(member.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Linked Teams</CardTitle>
                <CardDescription>Teams that belong to this organization</CardDescription>
              </CardHeader>
              <CardContent>
                {orgTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No teams linked yet. Generate an invite code below and share it with team owners.</p>
                ) : (
                  <div className="space-y-2">
                    {orgTeams.map((team) => (
                      <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <p className="font-medium text-foreground">{team.name}</p>
                        <Button variant="ghost" size="sm" onClick={() => {
                          unlinkTeam(team.id).then(() => {
                            toast.success('Team unlinked');
                            setOrgTeams((prev) => prev.filter((t) => t.id !== team.id));
                          }).catch(() => toast.error('Failed to unlink team'));
                        }}>
                          <Unlink className="h-4 w-4 mr-1" /> Unlink
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Team Invite Codes
                  <Button size="sm" onClick={handleGenerateCode} disabled={generatingCode}>
                    {generatingCode ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Generate Code
                  </Button>
                </CardTitle>
                <CardDescription>
                  Share these links with team owners so they can link their teams to your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inviteCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active invite codes. Generate one to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {inviteCodes.map((ic) => (
                      <div key={ic.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                            {window.location.origin}/join-org/{ic.code}
                          </code>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires {new Date(ic.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleCopyInviteLink(ic.code)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeactivateCode(ic.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Organization Name</Label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)} placeholder="Optional description" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <Input value={organization.slug} disabled />
                  <p className="text-xs text-muted-foreground mt-1">Slugs cannot be changed after creation.</p>
                </div>
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default OrgAdmin;

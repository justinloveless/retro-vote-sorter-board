import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { adminAddMember, adminListTeamMembers, adminListTeams, adminRemoveMember } from '@/lib/dataClient';

type Team = { id: string; name: string };
type Member = { id: string; user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; role: 'owner' | 'admin' | 'member' };

export const AdminManageTeamMembers: React.FC = () => {
  const { toast } = useToast();
  const [teamQuery, setTeamQuery] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [userInput, setUserInput] = useState(''); // email or userId
  const [role, setRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [loading, setLoading] = useState(false);

  const loadTeams = async () => {
    try {
      const list = await adminListTeams(teamQuery);
      setTeams(list);
    } catch (e: any) {
      toast({ title: 'Failed to load teams', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const loadMembers = async (teamId: string) => {
    try {
      const list = await adminListTeamMembers(teamId);
      setMembers(list);
    } catch (e: any) {
      toast({ title: 'Failed to load members', description: e.message || String(e), variant: 'destructive' });
    }
  };

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (selectedTeamId) loadMembers(selectedTeamId); }, [selectedTeamId]);

  const addMember = async () => {
    if (!selectedTeamId || !userInput.trim()) return;
    setLoading(true);
    try {
      await adminAddMember(selectedTeamId, { userIdOrEmail: userInput, role });
      toast({ title: 'Member added' });
      setUserInput('');
      await loadMembers(selectedTeamId);
    } catch (e: any) {
      toast({ title: 'Failed to add member', description: e.message || String(e), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const removeMember = async (member: Member) => {
    if (!selectedTeamId) return;
    setLoading(true);
    try {
      await adminRemoveMember(member.id);
      toast({ title: 'Member removed' });
      await loadMembers(selectedTeamId);
    } catch (e: any) {
      toast({ title: 'Failed to remove member', description: e.message || String(e), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin: Manage Team Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Find Team</Label>
          <div className="flex gap-2">
            <Input value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} placeholder="Search by team name" />
            <Button onClick={loadTeams}>Search</Button>
          </div>
          <div className="flex gap-2 items-center">
            <Label className="min-w-[80px]">Team</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedTeamId && (
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>User (email or user id)</Label>
                <Input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="alice@example.com or UUID" />
              </div>
              <div className="w-40 space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addMember} disabled={loading || !userInput.trim()}>Add</Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Members</div>
              <div className="space-y-2 max-h-80 overflow-auto">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded border p-2">
                    <div className="text-sm">
                      <div className="font-medium">{m.full_name || '(no name)'} <span className="text-xs text-muted-foreground">({m.role})</span></div>
                      <div className="text-xs text-muted-foreground">{m.email || m.user_id}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => removeMember(m)} disabled={loading}>Remove</Button>
                  </div>
                ))}
                {members.length === 0 && <div className="text-sm text-muted-foreground">No members</div>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};



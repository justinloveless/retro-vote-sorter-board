import { supabase } from '@/integrations/supabase/client';

// Admin functions

export async function adminListTeams(query: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await supabase.functions.invoke('admin-team-members', { body: { action: 'list_teams', query } });
    if (error) throw error;
    return ((data as any)?.teams || []) as Array<{ id: string; name: string }>;
}

export async function adminListTeamMembers(teamId: string): Promise<Array<{ id: string; user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; role: 'owner' | 'admin' | 'member' }>> {
    const { data, error } = await supabase.functions.invoke('admin-team-members', { body: { action: 'list_team_members', team_id: teamId } });
    if (error) throw error;
    return ((data as any)?.members || []) as Array<{ id: string; user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; role: 'owner' | 'admin' | 'member' }>;
}

export async function adminAddMember(teamId: string, input: { userIdOrEmail: string; role: 'owner' | 'admin' | 'member' }): Promise<void> {
    const body: any = { action: 'add_member', team_id: teamId, role: input.role };
    if (/^[0-9a-fA-F-]{36}$/.test(input.userIdOrEmail.trim())) body.user_id = input.userIdOrEmail.trim(); else body.email = input.userIdOrEmail.trim();
    const { error } = await supabase.functions.invoke('admin-team-members', { body });
    if (error) throw error;
}

export async function adminRemoveMember(memberId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('admin-team-members', { body: { action: 'remove_member', member_id: memberId } });
    if (error) throw error;
}

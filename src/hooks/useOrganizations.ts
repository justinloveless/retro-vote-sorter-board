import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
}

export interface OrgInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export function useOrganizations() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrganizations((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching organizations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const createOrganization = useCallback(async (name: string, slug: string, description?: string) => {
    if (!user) throw new Error('Not authenticated');

    // Enforce one org per user
    const { data: existingOrgs, error: checkError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if (checkError) throw checkError;
    if (existingOrgs && existingOrgs.length > 0) {
      throw new Error('You can only create one organization per subscription.');
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: description || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    await fetchOrganizations();
    return data as Organization;
  }, [user, fetchOrganizations]);

  return {
    organizations,
    loading,
    createOrganization,
    refetch: fetchOrganizations,
  };
}

export function useOrganization(orgSlug: string | undefined) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganization = useCallback(async () => {
    if (!orgSlug || !user) {
      setLoading(false);
      return;
    }

    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .single();

      if (orgError) throw orgError;
      setOrganization(org as Organization);

      // Fetch members first (without relying on a FK-based join)
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('id, organization_id, user_id, role, joined_at')
        .eq('organization_id', (org as any).id);

      if (memberError) throw memberError;

      const userIds = Array.from(
        new Set((memberData || []).map((m: any) => m.user_id).filter(Boolean))
      ) as string[];

      let profilesById = new Map<string, { full_name: string | null; avatar_url: string | null }>();

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (profileError) throw profileError;

        profilesById = new Map(
          (profileData || []).map((p: any) => [
            p.id,
            { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null },
          ])
        );
      }

      const mappedMembers = (memberData || []).map((m: any) => ({
        ...m,
        profile: profilesById.get(m.user_id) || { full_name: null, avatar_url: null },
      }));
      setMembers(mappedMembers);

      // Find current user's role
      const myMembership = mappedMembers.find((m: any) => m.user_id === user.id);
      setMyRole(myMembership?.role || null);

      // Fetch invitations if admin/owner
      if (myMembership?.role === 'owner' || myMembership?.role === 'admin') {
        const { data: invData } = await supabase
          .from('organization_invitations')
          .select('*')
          .eq('organization_id', (org as any).id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        setInvitations((invData as any[]) || []);
      }
    } catch (err) {
      console.error('Error fetching organization:', err);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, user]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const inviteMember = useCallback(async (email: string, role: 'admin' | 'member' = 'member') => {
    if (!organization || !user) throw new Error('Not ready');

    // Get inviter profile and org name for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { data, error } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: organization.id,
        email,
        invited_by: user.id,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    const invitation = data as OrgInvitation;

    // Send invitation email (same edge function as team invites)
    try {
      await supabase.functions.invoke('send-invitation-email', {
        body: {
          invitationId: invitation.id,
          email,
          teamName: organization.name,
          inviterName: profile?.full_name || 'Someone',
          token: invitation.token,
          invitePath: '/org-invite',
        }
      });
    } catch (emailErr) {
      console.error('Error sending org invitation email:', emailErr);
    }

    // Send in-app notification
    try {
      await supabase.functions.invoke('notify-org-invite', {
        body: { invitationId: invitation.id }
      });
    } catch (notifErr) {
      console.error('Error sending org invite notification:', notifErr);
    }

    await fetchOrganization();
    return invitation;
  }, [organization, user, fetchOrganization]);

  const updateMemberRole = useCallback(async (memberId: string, newRole: 'admin' | 'member') => {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) throw error;
    await fetchOrganization();
  }, [fetchOrganization]);

  const removeMember = useCallback(async (memberId: string) => {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    await fetchOrganization();
  }, [fetchOrganization]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) throw error;
    await fetchOrganization();
  }, [fetchOrganization]);

  const updateOrganization = useCallback(async (updates: Partial<Pick<Organization, 'name' | 'description'>>) => {
    if (!organization) throw new Error('No organization');

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organization.id);

    if (error) throw error;
    await fetchOrganization();
  }, [organization, fetchOrganization]);

  const linkTeam = useCallback(async (teamId: string) => {
    if (!organization) throw new Error('No organization');

    const { error } = await supabase
      .from('teams')
      .update({ organization_id: organization.id })
      .eq('id', teamId);

    if (error) throw error;
  }, [organization]);

  const unlinkTeam = useCallback(async (teamId: string) => {
    const { error } = await supabase
      .from('teams')
      .update({ organization_id: null })
      .eq('id', teamId);

    if (error) throw error;
  }, []);

  return {
    organization,
    members,
    invitations,
    myRole,
    loading,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
    updateOrganization,
    linkTeam,
    unlinkTeam,
    refetch: fetchOrganization,
  };
}

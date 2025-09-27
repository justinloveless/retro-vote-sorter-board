import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';
import { shouldUseCSharpApi } from '@/config/environment';
import { apiGetTeams, apiCreateTeam, apiUpdateTeam, apiDeleteTeam } from '@/lib/apiClient';

interface Team {
  id: string;
  name: string;
  description: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
  role: 'owner' | 'admin' | 'member' | null;
}

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const loadTeams = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (shouldUseCSharpApi()) {
        const response = await apiGetTeams();
        const mapped = (response.items || []).map((team: any) => ({
          id: team.id,
          name: team.name,
          description: team.description ?? null,
          creator_id: team.ownerId ?? null,
          created_at: team.createdAt ?? '',
          updated_at: team.createdAt ?? '',
          role: team.role ?? null
        })) as Team[];
        setTeams(mapped);
      } else {
        const { data, error } = await supabase
          .from('teams')
          .select(`
            *,
            team_members!inner( role, user_id )
          `)
          .eq('team_members.user_id', profile.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const teamsWithRoles = data.map(team => {
          const currentUserMembership = team.team_members.find(m => m.user_id === profile.id);
          return {
            ...team,
            role: currentUserMembership?.role || null
          }
        });

        setTeams(teamsWithRoles || []);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      toast({
        title: "Error loading teams",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile, toast]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const createTeam = async (name: string, description?: string) => {
    try {
      if (shouldUseCSharpApi()) {
        await apiCreateTeam(name);
      } else {
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (!currentUser) throw new Error('User not authenticated');

        const { error } = await supabase
          .from('teams')
          .insert([{ name, description, creator_id: currentUser.id }]);

        if (error) throw error;
      }

      toast({
        title: "Team created",
        description: "Your team has been created successfully.",
      });

      await loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error creating team",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateTeam = async (teamId: string, updates: Partial<Pick<Team, 'name' | 'description'>>) => {
    try {
      if (shouldUseCSharpApi()) {
        await apiUpdateTeam(teamId, { name: updates.name });
      } else {
        const { error } = await supabase
          .from('teams')
          .update(updates)
          .eq('id', teamId);

        if (error) throw error;
      }

      toast({
        title: "Team updated",
        description: "Team details have been updated.",
      });

      await loadTeams();
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Error updating team",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteTeam = async (teamId: string) => {
    try {
      if (shouldUseCSharpApi()) {
        await apiDeleteTeam(teamId);
      } else {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', teamId);

        if (error) throw error;
      }

      toast({
        title: "Team deleted",
        description: "The team has been deleted.",
      });

      await loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error deleting team",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    teams,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    refetch: loadTeams
  };
};

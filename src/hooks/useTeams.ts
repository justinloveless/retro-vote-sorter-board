
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  description: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_members!inner(role)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
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
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const createTeam = async (name: string, description?: string) => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('teams')
        .insert([{
          name,
          description,
          creator_id: currentUser.id
        }]);

      if (error) throw error;

      toast({
        title: "Team created",
        description: "Your team has been created successfully.",
      });

      loadTeams();
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
      const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: "Team updated",
        description: "Team details have been updated.",
      });

      loadTeams();
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
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: "Team deleted",
        description: "The team has been deleted.",
      });

      loadTeams();
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

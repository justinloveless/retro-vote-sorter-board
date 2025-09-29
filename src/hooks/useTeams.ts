import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';
import { fetchTeams as dcFetchTeams, createTeam as dcCreateTeam, updateTeam as dcUpdateTeam, deleteTeam as dcDeleteTeam, TeamRecord } from '@/lib/dataClient';

type Team = TeamRecord;

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
      const list = await dcFetchTeams();
      setTeams(list);
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
      await dcCreateTeam(name, description);
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
      await dcUpdateTeam(teamId, updates);
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
      await dcDeleteTeam(teamId);
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

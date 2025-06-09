import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { TeamSettingsForm } from '@/components/team/TeamSettingsForm';
import { BoardTemplatesSettings } from '@/components/team/BoardTemplatesSettings';
import { DangerZone } from '@/components/team/DangerZone';
import { supabase } from '@/integrations/supabase/client';
import { JiraSettingsForm } from '@/components/team/JiraSettingsForm';
import { AppHeader } from '@/components/AppHeader';

const TeamSettings = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId || !user) {
        setLoading(false);
        return;
      };

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('teams')
          .select(`
            *,
            team_members!inner(role, user_id)
          `)
          .eq('id', teamId)
          .eq('team_members.user_id', user.id)
          .single();

        if (error) throw error;

        const userRole = data?.team_members[0]?.role;
        if (!userRole || !['owner', 'admin'].includes(userRole)) {
          toast({
            title: "Access denied",
            description: "You don't have permission to access team settings.",
            variant: "destructive",
          });
          navigate(`/teams/${teamId}`);
          return;
        }

        setTeam(data);
      } catch (error) {
        console.error('Error loading team:', error);
        toast({
          title: "Error loading team",
          description: "Please try again.",
          variant: "destructive",
        });
        navigate('/teams');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [teamId, user, navigate, toast]);

  const handleSave = async (formData: { name: string; description: string; slack_webhook_url: string; }) => {
    if (!teamId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          slack_webhook_url: formData.slack_webhook_url.trim() || null
        })
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: "Team updated",
        description: "Team settings have been saved successfully.",
      });

      // Update local state
      setTeam(prev => ({
        ...prev,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        slack_webhook_url: formData.slack_webhook_url.trim() || null
      }));
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Error updating team",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId) return;

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: "Team deleted",
        description: "The team has been deleted successfully.",
      });

      navigate('/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error deleting team",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => { }} />;
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Team not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader variant='home' />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/teams/${teamId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Settings</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your team configuration for '{team.name}'</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TeamSettingsForm
              team={team}
              onSave={handleSave}
              onCancel={() => navigate(`/teams/${teamId}`)}
              saving={saving}
            />

            <JiraSettingsForm teamId={teamId!} />

            <BoardTemplatesSettings teamId={teamId!} />
          </div>

          <div className="lg:col-span-1">
            <DangerZone teamName={team.name} onDelete={handleDelete} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamSettings;

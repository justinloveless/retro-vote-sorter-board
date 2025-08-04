
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BoardTemplate {
  id: string;
  team_id: string;
  name: string;
  is_default: boolean;
  allow_anonymous: boolean;
  voting_enabled: boolean;
  max_votes_per_user: number | null;
  show_author_names: boolean;
  retro_stages_enabled: boolean | null;
  enforce_stage_readiness: boolean | null;
  created_at: string;
  updated_at: string;
}

interface TemplateColumn {
  id: string;
  template_id: string;
  title: string;
  color: string;
  position: number;
  is_action_items: boolean | null;
  created_at: string;
}

export const useBoardTemplates = (teamId: string | null) => {
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [templateColumns, setTemplateColumns] = useState<{[key: string]: TemplateColumn[]}>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadTemplates = async () => {
    if (!teamId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('board_templates')
        .select('*')
        .eq('team_id', teamId)
        .order('name');

      if (templatesError) throw templatesError;

      setTemplates(templatesData || []);

      // Load columns for all templates
      if (templatesData && templatesData.length > 0) {
        const templateIds = templatesData.map(t => t.id);
        const { data: columnsData, error: columnsError } = await supabase
          .from('template_columns')
          .select('*')
          .in('template_id', templateIds)
          .order('position');

        if (columnsError) throw columnsError;

        // Group columns by template_id
        const columnsByTemplate = (columnsData || []).reduce((acc, column) => {
          if (!acc[column.template_id]) {
            acc[column.template_id] = [];
          }
          acc[column.template_id].push(column);
          return acc;
        }, {} as {[key: string]: TemplateColumn[]});

        setTemplateColumns(columnsByTemplate);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error loading templates",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setDefaultTemplate = async (templateId: string) => {
    if (!teamId) return;

    try {
      // First, unset all default templates for this team
      await supabase
        .from('board_templates')
        .update({ is_default: false })
        .eq('team_id', teamId);

      // Then set the selected template as default
      const { error } = await supabase
        .from('board_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Default template updated",
        description: "This template will be used for new boards in this team.",
      });

      loadTemplates();
    } catch (error) {
      console.error('Error setting default template:', error);
      toast({
        title: "Error updating template",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const createTemplate = async (
    name: string, 
    columns: {title: string, color: string, position: number, is_action_items: boolean}[],
    boardConfig: {
      allow_anonymous: boolean;
      voting_enabled: boolean;
      max_votes_per_user: number | null;
      show_author_names: boolean;
      retro_stages_enabled: boolean;
      enforce_stage_readiness: boolean;
    }
  ) => {
    if (!teamId) return null;

    try {
      const { data: template, error: templateError } = await supabase
        .from('board_templates')
        .insert([{
          team_id: teamId,
          name: name.trim(),
          is_default: false,
          allow_anonymous: boardConfig.allow_anonymous,
          voting_enabled: boardConfig.voting_enabled,
          max_votes_per_user: boardConfig.max_votes_per_user,
          show_author_names: boardConfig.show_author_names,
          retro_stages_enabled: boardConfig.retro_stages_enabled,
          enforce_stage_readiness: boardConfig.enforce_stage_readiness
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      // Create template columns
      const { error: columnsError } = await supabase
        .from('template_columns')
        .insert(
          columns.map(col => ({
            template_id: template.id,
            title: col.title,
            color: col.color,
            position: col.position,
            is_action_items: col.is_action_items
          }))
        );

      if (columnsError) throw columnsError;

      toast({
        title: "Template created",
        description: "New board template has been created successfully.",
      });

      loadTemplates();
      return template;
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Error creating template",
        description: "Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTemplate = async (
    templateId: string,
    name: string, 
    columns: {title: string, color: string, position: number, is_action_items: boolean}[],
    boardConfig: {
      allow_anonymous: boolean;
      voting_enabled: boolean;
      max_votes_per_user: number | null;
      show_author_names: boolean;
      retro_stages_enabled: boolean;
      enforce_stage_readiness: boolean;
    }
  ) => {
    if (!teamId) return null;

    try {
      // Update template
      const { error: templateError } = await supabase
        .from('board_templates')
        .update({
          name: name.trim(),
          allow_anonymous: boardConfig.allow_anonymous,
          voting_enabled: boardConfig.voting_enabled,
          max_votes_per_user: boardConfig.max_votes_per_user,
          show_author_names: boardConfig.show_author_names,
          retro_stages_enabled: boardConfig.retro_stages_enabled,
          enforce_stage_readiness: boardConfig.enforce_stage_readiness
        })
        .eq('id', templateId);

      if (templateError) throw templateError;

      // Delete existing columns
      const { error: deleteError } = await supabase
        .from('template_columns')
        .delete()
        .eq('template_id', templateId);

      if (deleteError) throw deleteError;

      // Create new columns
      const { error: columnsError } = await supabase
        .from('template_columns')
        .insert(
          columns.map(col => ({
            template_id: templateId,
            title: col.title,
            color: col.color,
            position: col.position,
            is_action_items: col.is_action_items
          }))
        );

      if (columnsError) throw columnsError;

      toast({
        title: "Template updated",
        description: "Board template has been updated successfully.",
      });

      loadTemplates();
      return true;
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: "Error updating template",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('board_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: "The template has been deleted successfully.",
      });

      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error deleting template",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [teamId]);

  return {
    templates,
    templateColumns,
    loading,
    setDefaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: loadTemplates
  };
};

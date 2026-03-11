import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EndorsementType {
  id: string;
  team_id: string;
  name: string;
  description: string;
  icon_url: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EndorsementSettings {
  id: string;
  team_id: string;
  max_endorsements_per_user_per_board: number;
}

export function useEndorsementTypes(teamId: string | null) {
  const [types, setTypes] = useState<EndorsementType[]>([]);
  const [settings, setSettings] = useState<EndorsementSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTypes = useCallback(async () => {
    if (!teamId) return;
    try {
      const { data, error } = await supabase
        .from('endorsement_types')
        .select('*')
        .eq('team_id', teamId)
        .order('position');
      if (error) throw error;
      setTypes((data as unknown as EndorsementType[]) || []);
    } catch (e) {
      console.error('Error fetching endorsement types:', e);
    }
  }, [teamId]);

  const fetchSettings = useCallback(async () => {
    if (!teamId) return;
    try {
      const { data, error } = await supabase
        .from('endorsement_settings')
        .select('*')
        .eq('team_id', teamId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setSettings(data as unknown as EndorsementSettings | null);
    } catch (e) {
      console.error('Error fetching endorsement settings:', e);
    }
  }, [teamId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTypes(), fetchSettings()]).finally(() => setLoading(false));
  }, [fetchTypes, fetchSettings]);

  const addType = useCallback(async (name: string, description: string, iconUrl: string) => {
    if (!teamId) return;
    const maxPos = types.length > 0 ? Math.max(...types.map(t => t.position)) + 1 : 1;
    const { error } = await supabase
      .from('endorsement_types')
      .insert({ team_id: teamId, name, description, icon_url: iconUrl, position: maxPos } as any);
    if (error) {
      toast({ title: 'Error adding endorsement type', variant: 'destructive' });
      return;
    }
    await fetchTypes();
  }, [teamId, types, fetchTypes, toast]);

  const updateType = useCallback(async (id: string, updates: Partial<Pick<EndorsementType, 'name' | 'description' | 'icon_url'>>) => {
    const { error } = await supabase
      .from('endorsement_types')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating endorsement type', variant: 'destructive' });
      return;
    }
    await fetchTypes();
  }, [fetchTypes, toast]);

  const deleteType = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('endorsement_types')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Error deleting endorsement type', variant: 'destructive' });
      return;
    }
    await fetchTypes();
  }, [fetchTypes, toast]);

  const updateSettings = useCallback(async (maxEndorsements: number) => {
    if (!teamId) return;
    const { error } = await supabase
      .from('endorsement_settings')
      .upsert({ team_id: teamId, max_endorsements_per_user_per_board: maxEndorsements } as any, { onConflict: 'team_id' });
    if (error) {
      toast({ title: 'Error updating settings', variant: 'destructive' });
      return;
    }
    await fetchSettings();
  }, [teamId, fetchSettings, toast]);

  const seedDefaults = useCallback(async () => {
    if (!teamId) return;
    const { error } = await supabase.rpc('seed_default_endorsement_types', { p_team_id: teamId });
    if (error) {
      toast({ title: 'Error seeding defaults', variant: 'destructive' });
      return;
    }
    await Promise.all([fetchTypes(), fetchSettings()]);
  }, [teamId, fetchTypes, fetchSettings, toast]);

  return { types, settings, loading, addType, updateType, deleteType, updateSettings, seedDefaults, refetch: () => Promise.all([fetchTypes(), fetchSettings()]) };
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSlackIntegration = (teamId: string | null | undefined) => {
  const [isSlackInstalled, setIsSlackInstalled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const checkSlackInstallation = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('slack_webhook_url')
        .eq('id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "No rows found" error
        console.error('Error checking slack installation', error);
        setIsSlackInstalled(false);
      } else {
        setIsSlackInstalled(!!data?.slack_webhook_url);
      }
      setLoading(false);
    };

    checkSlackInstallation();
  }, [teamId]);

  return { isSlackInstalled, loading };
}; 
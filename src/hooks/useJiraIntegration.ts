import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useJiraIntegration = (teamId: string | null | undefined) => {
  const [isJiraConfigured, setIsJiraConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const checkJiraConfiguration = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('jira_domain, jira_email, jira_api_key')
        .eq('id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking Jira configuration', error);
        setIsJiraConfigured(false);
      } else {
        setIsJiraConfigured(!!data?.jira_domain && !!data?.jira_email && !!data?.jira_api_key);
      }
      setLoading(false);
    };

    checkJiraConfiguration();
  }, [teamId]);

  return { isJiraConfigured, loading };
};

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useOrganizations, Organization } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface OrgSelectorContextType {
  organizations: Organization[];
  selectedOrgId: string | null;
  selectedOrg: Organization | null;
  selectedOrgRole: 'owner' | 'admin' | 'member' | null;
  setSelectedOrgId: (id: string | null) => void;
  hasOrgs: boolean;
  loading: boolean;
}

const OrgSelectorContext = createContext<OrgSelectorContextType>({
  organizations: [],
  selectedOrgId: null,
  selectedOrg: null,
  selectedOrgRole: null,
  setSelectedOrgId: () => {},
  hasOrgs: false,
  loading: true,
});

const STORAGE_KEY = 'retroscope_selected_org';

export const OrgSelectorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { organizations, loading } = useOrganizations();
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const [selectedOrgRole, setSelectedOrgRole] = useState<'owner' | 'admin' | 'member' | null>(null);

  const setSelectedOrgId = useCallback((id: string | null) => {
    setSelectedOrgIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  // If stored org is no longer valid, reset to null
  useEffect(() => {
    if (!loading && selectedOrgId && !organizations.find(o => o.id === selectedOrgId)) {
      setSelectedOrgId(null);
    }
  }, [loading, organizations, selectedOrgId, setSelectedOrgId]);

  // Fetch user's role in selected org
  useEffect(() => {
    if (!selectedOrgId || !user) {
      setSelectedOrgRole(null);
      return;
    }
    supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', selectedOrgId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSelectedOrgRole((data?.role as any) || null);
      });
  }, [selectedOrgId, user]);

  const selectedOrg = organizations.find(o => o.id === selectedOrgId) || null;

  return (
    <OrgSelectorContext.Provider value={{
      organizations,
      selectedOrgId,
      selectedOrg,
      selectedOrgRole,
      setSelectedOrgId,
      hasOrgs: organizations.length > 0,
      loading,
    }}>
      {children}
    </OrgSelectorContext.Provider>
  );
};

export const useOrgSelector = () => useContext(OrgSelectorContext);


import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | null;
  theme_preference: string | null;
  background_preference: any | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  authProfile: Profile | null;
  isImpersonating: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<Profile>;
  startImpersonating: (userId: string) => Promise<void>;
  stopImpersonating: () => void;
  refreshImpersonatedProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === 'undefined') return null;
    const cachedSession = localStorage.getItem('session');
    try {
      return cachedSession ? JSON.parse(cachedSession) : null;
    } catch (e) {
      console.error('Failed to parse cached session', e);
      return null;
    }
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window === 'undefined') return null;
    const cachedProfile = localStorage.getItem('profile');
    try {
      return cachedProfile ? JSON.parse(cachedProfile) : null;
    } catch (e) {
      console.error('Failed to parse cached profile', e);
      return null;
    }
  });

  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem('impersonated_profile');
    try {
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(session?.user ?? null);
  const [loading, setLoading] = useState(!session);

  const fetchProfile = useCallback(async (userId: string) => {
    // Check if we already have this profile cached and it's the same user
    if (profile && profile.id === userId) {
      // We already have this user's profile loaded, no need to fetch again
      return;
    }

    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, theme_preference, background_preference')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      localStorage.setItem('profile', JSON.stringify(profileData));
      setProfile(profileData);
    } catch (error) {
      localStorage.removeItem('profile');
      setProfile(null);
    }
  }, [profile]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession) {
        localStorage.setItem('session', JSON.stringify(newSession));
        // Always refresh the real profile for the authenticated user once per auth change

        fetchProfile(newSession.user.id);
      } else {
        localStorage.removeItem('session');
        localStorage.removeItem('profile');
        localStorage.removeItem('impersonated_profile');
        setProfile(null);
        setImpersonatedProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error("No user is logged in");

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      localStorage.setItem('profile', JSON.stringify(data));
      setProfile(data);

      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const refreshImpersonatedProfile = useCallback(async () => {
    if (!impersonatedProfile?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, theme_preference, background_preference')
        .eq('id', impersonatedProfile.id)
        .single();
      if (error) throw error;
      localStorage.setItem('impersonated_profile', JSON.stringify(data));
      setImpersonatedProfile(data);
    } catch (e) {
      // no-op
    }
  }, [impersonatedProfile?.id]);

  const startImpersonating = useCallback(async (userId: string) => {
    // Only allow if current profile is admin
    if (profile?.role !== 'admin') throw new Error('Only admins can impersonate');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, theme_preference, background_preference')
        .eq('id', userId)
        .single();
      if (error) throw error;
      localStorage.setItem('impersonated_profile', JSON.stringify(data));
      setImpersonatedProfile(data);
    } catch (e) {
      throw e;
    }
  }, [profile]);

  const stopImpersonating = useCallback(() => {
    localStorage.removeItem('impersonated_profile');
    setImpersonatedProfile(null);
  }, []);

  const value = {
    user,
    session,
    profile: impersonatedProfile || profile,
    authProfile: profile,
    isImpersonating: !!impersonatedProfile,
    loading,
    signOut,
    updateProfile,
    startImpersonating,
    stopImpersonating,
    // Expose helper for components that want to refresh the impersonated profile
    refreshImpersonatedProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

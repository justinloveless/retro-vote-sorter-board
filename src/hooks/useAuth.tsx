
import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | null;
}

export const useAuth = () => {
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

  const [user, setUser] = useState<User | null>(session?.user ?? null);
  const [loading, setLoading] = useState(!session);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
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
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession) {
        localStorage.setItem('session', JSON.stringify(newSession));
        if (!profile || profile.id !== newSession.user.id || profile.role === undefined) {
          fetchProfile(newSession.user.id);
        }
      } else {
        localStorage.removeItem('session');
        localStorage.removeItem('profile');
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [profile, fetchProfile]);

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

  return {
    user,
    session,
    profile,
    loading,
    signOut,
    updateProfile
  };
};

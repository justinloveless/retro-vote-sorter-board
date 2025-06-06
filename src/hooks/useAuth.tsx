import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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

  const fetchProfile = async (userId: string) => {
    try {
      console.log('about to hit supabase for profile');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('after hitting supabase');
      localStorage.setItem('profile', JSON.stringify(profileData));
      setProfile(profileData);
      console.log('profileData set', profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('profile');
      setProfile(null);
    }
  };

  useEffect(() => {
    console.log('session', session);
    if (session?.user && (!profile || profile.id !== session.user.id)) {
      fetchProfile(session.user.id);
    }
  }, [session, profile]);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST - this will handle ALL auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state change:', event, newSession?.user?.email);
        console.log('mounted', mounted);

        if (!mounted) return;

        if (newSession) {
          localStorage.setItem('session', JSON.stringify(newSession));
        } else {
          localStorage.removeItem('session');
          localStorage.removeItem('profile');
          setProfile(null);
        }

        // Always update session and user synchronously
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        // Defer profile fetching and loading state update
        // setTimeout(async () => {
        //   if (newSession?.user) {
        //     await fetchProfile(newSession.user.id);
        //   } else {
        //     setProfile(null);
        //   }

        //   // Always set loading to false after handling auth state
        //   setLoading(false);
        //   console.log('Loading set to false after auth state handling');
        // }, 0);
      }
    );

    // The onAuthStateChange listener will automatically fire with the current session
    // so we don't need to manually call getSession() - this eliminates the race condition

    return () => {
      console.log('unmounting');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    profile,
    loading,
    signOut
  };
};

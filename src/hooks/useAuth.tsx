
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('about to hit supabase for profile');
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('after hitting supabase');
      
      setProfile(profileData);
      console.log('profileData set', profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST - this will handle ALL auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state change:', event, newSession?.user?.email);
        
        if (!mounted) return;
        
        // Always update session and user synchronously
        setSession(newSession);
        // setUser(newSession?.user ?? null);
        setLoading(true);
        
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

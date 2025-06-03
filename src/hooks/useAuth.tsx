
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
    let initialLoadHandled = false;

    // Set up auth state listener FIRST (non-async callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth state change:', event, newSession?.user?.email);
        
        if (!mounted) return;
        
        // Only synchronous state updates here
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Defer any Supabase calls using setTimeout to avoid deadlocks
        setTimeout(async () => {
          if (newSession?.user) {
            await fetchProfile(newSession.user.id);
          } else {
            setProfile(null);
          }
          
          if (!initialLoadHandled) {
            setLoading(false);
            initialLoadHandled = true;
            console.log('Loading set to false after auth state change.');
          } else {
            setLoading(false);
            console.log('Loading set to false');
          }
        }, 0);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Defer profile fetching and loading state update
      setTimeout(async () => {
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        
        if (!initialLoadHandled) {
          setLoading(false);
          initialLoadHandled = true;
          console.log('Loading set to false after initial session check.');
        }
      }, 0);
    }).catch(error => {
      console.error("Error during initial session check:", error);
      if (mounted && !initialLoadHandled) {
        setLoading(false);
        initialLoadHandled = true;
      }
    });

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


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

  useEffect(() => {
    let mounted = true;
    let initialLoadHandled = false;

    const updateAuthState = async (session: Session | null) => {
      console.log('updating auth state');
      if (!mounted) return;
      console.log('mounted successfully');
      

      setSession(session);
      setUser(session?.user ?? null);
      console.log('session', session);
      console.log('user', session?.user);
      
      if (session?.user) {
        
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          setProfile(profileData);
          console.log('profileData set', profileData);
        } catch (error) {
          console.error('Error fetching profile:', error);
          setProfile(null);
        }
      } else {
        // no session user
        setProfile(null);
      }

      // always happens regardless of session user
      setLoading(false);
      console.log('Loading set to false');
      // end of updateAuthState    
      if (!initialLoadHandled) {
        setLoading(false);
        initialLoadHandled = true;
        console.log('Loading set to false after initial load.');
        
      }
    };

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      updateAuthState(session);
    }).catch(error => {
      console.error("Error during initial session check:", error);
      if (mounted && !initialLoadHandled) {
        setLoading(false); // Ensure loading is false even if getSession fails
        initialLoadHandled = true;
      }
    });
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state change:', event, newSession?.user?.email);
        await updateAuthState(newSession);
      }
    );


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

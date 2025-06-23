import { useParams, useSearchParams } from 'react-router-dom';
import PokerTable from "@/components/Neotro/PokerTable";
import { NeotroHeader } from "@/components/Neotro/NeotroHeader";
import { useAuth } from '@/hooks/useAuth';
import { usePokerSession } from '@/hooks/usePokerSession';
import { AppHeader } from '@/components/AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const NeotroPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const roundParam = searchParams.get('round');
  const { user, profile, loading: loadingAuth } = useAuth();
  const [currentRole, setCurrentRole] = useState<string | undefined>();
  const [loadingRole, setLoadingRole] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!teamId || !user) {
        setLoadingRole(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          // It's okay if no record is found, they are just not a member with a role
          if (error.code !== 'PGRST116') {
            console.error('Error fetching user role:', error);
          }
        }
        
        if (data) {
          setCurrentRole(data.role);
        }
      } catch (e) {
        console.error('Error in fetchUserRole:', e);
      } finally {
        setLoadingRole(false);
      }
    };

    fetchUserRole();
  }, [teamId, user]);

  const { session, loading: loadingSession, ...pokerActions } = usePokerSession(
    !loadingAuth ? teamId : null, // Use teamId as the session identifier
    user?.id,
    profile?.full_name || user?.email,
    true
  );

  // If a specific round is requested via query parameter, show a notice
  const requestedRound = roundParam ? parseInt(roundParam, 10) : null;
  const showRoundNotice = requestedRound && session && session.round_number !== requestedRound;

  if (loadingAuth || loadingSession || loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col pt-16 md:pt-0">
       <AppHeader variant='back' />
      {showRoundNotice && (
        <div className="bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You were linked to round {requestedRound}, but the current active round is {session.round_number}.
                The poker session shows the most recent active round.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <PokerTable
          session={session}
          activeUserId={user?.id}
          teamId={teamId}
          userRole={currentRole}
          {...pokerActions}
        />
      </div>
    </div>
  );
};

export default NeotroPage;

import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import PokerTable from "@/components/Neotro/PokerTable";
import { NeotroHeader } from "@/components/Neotro/NeotroHeader";
import { useAuth } from '@/hooks/useAuth';
import { usePokerSession } from '@/hooks/usePokerSession';
import { usePokerSessionHistory } from '@/hooks/usePokerSessionHistory';
import { AppHeader } from '@/components/AppHeader';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

const NeotroPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roundParam = searchParams.get('round');
  const { user, profile, loading: loadingAuth } = useAuth();
  const { isFeatureEnabled, loading: loadingFlags } = useFeatureFlags();
  const [currentRole, setCurrentRole] = useState<string | undefined>();
  const [loadingRole, setLoadingRole] = useState(true);


  useEffect(() => {
    const fetchUserRole = async () => {
      if (!teamId || !profile) {
        setLoadingRole(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', profile.id)
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
  }, [teamId, profile]);

  const { session, loading: loadingSession, ...pokerActions } = usePokerSession(
    !loadingAuth ? teamId : null, // Use teamId as the session identifier
    profile?.id,
    profile?.full_name || (user?.email || 'Player'),
    true
  );

  // Use history hook to load specific rounds when requested
  const { 
    rounds
  } = usePokerSessionHistory(session?.session_id || null);

  // Check if a specific round is requested via query parameter
  const requestedRoundNumber = roundParam ? parseInt(roundParam, 10) : null;

  // Find the requested round when rounds are loaded
  const requestedRound = requestedRoundNumber && rounds.length > 0 
    ? rounds.find(round => round.round_number === requestedRoundNumber)
    : null;

  // Determine which session data to use
  const displaySession = requestedRound ? {
    ...session,
    ...requestedRound,
    // Keep the session-level properties from the live session
    session_id: session?.session_id,
    room_id: session?.room_id,
    current_round_number: session?.current_round_number,
    presence_enabled: session?.presence_enabled,
    send_to_slack: session?.send_to_slack,
    // Override the round_number to match the requested round for chat and history
    round_number: requestedRound.round_number
  } : session;

  if (loadingAuth || loadingSession || loadingRole || loadingFlags) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading Session...</div>
      </div>
    );
  }

  if (!isFeatureEnabled('poker_pointing_sessions')) {
    return (
      <div className="h-screen w-screen flex flex-col pt-16 md:pt-0">
        <AppHeader variant='back' />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Pro Feature</h2>
            <p className="text-muted-foreground">
              Poker pointing sessions are available on Pro plans and above. Upgrade your subscription to access this feature.
            </p>
            <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col pt-16 md:pt-0">
       <AppHeader variant='back' />
      <div className="flex-1 min-h-0">
        <PokerTable
          session={displaySession}
          activeUserId={profile?.id}
          teamId={teamId}
          userRole={currentRole}
          requestedRoundNumber={requestedRoundNumber}
          {...pokerActions}
        />
      </div>
    </div>
  );
};

export default NeotroPage;

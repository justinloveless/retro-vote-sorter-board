import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import PokerTable from "@/components/Neotro/PokerTable";
import { useAuth } from '@/hooks/useAuth';
import { usePokerSession } from '@/hooks/usePokerSession';
import { usePokerSessionHistory } from '@/hooks/usePokerSessionHistory';
import { AppHeader } from '@/components/AppHeader';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock, ShieldAlert } from 'lucide-react';
import { useBackground } from '@/contexts/BackgroundContext';

const POKER_HIDE_BG_KEY = 'poker-disable-background-effects';

const NeotroPage = () => {
  const { teamId, sessionId } = useParams<{ teamId: string; sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roundParam = searchParams.get('round');
  const requestedRoundNumberFromUrl = useMemo(() => {
    if (roundParam == null || roundParam === '') return null;
    const n = Number.parseInt(roundParam, 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [roundParam]);
  const { user, profile, loading: loadingAuth } = useAuth();
  const { isFeatureEnabled, loading: loadingFlags } = useFeatureFlags();
  const [currentRole, setCurrentRole] = useState<string | undefined>();
  const [loadingRole, setLoadingRole] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const { setHideEffects } = useBackground();

  useEffect(() => {
    if (localStorage.getItem(POKER_HIDE_BG_KEY) === 'true') {
      setHideEffects(true);
    }
    return () => setHideEffects(false);
  }, [setHideEffects]);

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
          if (error.code !== 'PGRST116') {
            console.error('Error fetching user role:', error);
          }
        }
        
        if (data) {
          setCurrentRole(data.role);
          setIsMember(true);
        }
      } catch (e) {
        console.error('Error in fetchUserRole:', e);
      } finally {
        setLoadingRole(false);
      }
    };

    fetchUserRole();
  }, [teamId, profile]);

  // Team sessions are inserted in Team.tsx (or elsewhere) before opening this route; never
  // auto-create on a miss — that was creating a blank session whenever lookup returned no row.
  const { session, loading: loadingSession, ...pokerActions } = usePokerSession(
    (!loadingAuth && isMember) ? (sessionId?.trim() || null) : null,
    profile?.id,
    profile?.full_name || (user?.email || 'Player'),
    false,
    teamId
  );

  const pokerRouteForHistory = useMemo(
    () => (teamId && sessionId ? { teamId, slug: sessionId } : null),
    [teamId, sessionId]
  );

  // Use history hook to load specific rounds when requested (?round=)
  const { rounds } = usePokerSessionHistory(
    session?.session_id || null,
    undefined,
    pokerRouteForHistory
  );

  const requestedRound =
    requestedRoundNumberFromUrl && rounds.length > 0
      ? rounds.find((round) => round.round_number === requestedRoundNumberFromUrl)
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
    spotlight_follow_enabled: session?.spotlight_follow_enabled,
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

  if (!isMember) {
    return (
      <div className="h-screen w-screen flex flex-col pt-16 md:pt-0">
        <AppHeader variant='back' />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground">
              Only members of this team can participate in pointing sessions.
            </p>
            <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
          </div>
        </div>
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
            <h2 className="text-2xl font-bold">Feature Disabled</h2>
            <p className="text-muted-foreground">
              Poker pointing sessions are currently disabled by an administrator.
            </p>
            <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!displaySession) {
    return (
      <div className="h-screen w-screen flex flex-col pt-16 md:pt-0">
        <AppHeader variant="back" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">Session not found</h2>
            <p className="text-muted-foreground">
              This pointing session does not exist or could not be loaded. If the link is old, start a new session from the team page.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(teamId ? `/teams/${teamId}?tab=poker` : '/teams')}
            >
              Back to team
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen min-w-full flex flex-col neotro-full-width">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <PokerTable
          session={displaySession}
          activeUserId={profile?.id}
          activeUserDisplayName={
            profile?.nickname || profile?.full_name || user?.email || 'Player'
          }
          teamId={teamId}
          userRole={currentRole}
          requestedRoundNumber={requestedRoundNumberFromUrl}
          pokerRouteContext={pokerRouteForHistory}
          onPokerBack={() => navigate(-1)}
          {...pokerActions}
        />
      </div>
    </div>
  );
};

export default NeotroPage;

import { useParams } from 'react-router-dom';
import PokerTable from "@/components/Neotro/PokerTable";
import { NeotroHeader } from "@/components/Neotro/NeotroHeader";
import { useAuth } from '@/hooks/useAuth';
import { usePokerSession } from '@/hooks/usePokerSession';
import { AppHeader } from '@/components/AppHeader';

const NeotroPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { user, profile, loading: loadingAuth } = useAuth();

  const { session, loading: loadingSession, ...pokerActions } = usePokerSession(
    teamId, // Use teamId as the session identifier
    user?.id,
    profile?.full_name || user?.email
  );

  if (loadingAuth || loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <AppHeader variant='back' />
      <div className="flex-1 min-h-0">
        <PokerTable
          session={session}
          activeUserId={user?.id}
          {...pokerActions}
        />
      </div>
    </div>
  );
};

export default NeotroPage; 
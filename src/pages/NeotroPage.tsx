import { useParams } from 'react-router-dom';
import Neotro from "@/components/Neotro/PokerTable";
import { NeotroHeader } from "@/components/Neotro/NeotroHeader";
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/hooks/useAuth';

const NeotroPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { members: teamMembers, loading: loadingMembers } = useTeamMembers(teamId || null);
  const { user, loading: loadingAuth } = useAuth();


  if (loadingMembers || loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <NeotroHeader />
      <div className="flex-1 min-h-0">
        <Neotro teamMembers={teamMembers} activeUserId={user?.id} />
      </div>
    </div>
  );
};

export default NeotroPage; 
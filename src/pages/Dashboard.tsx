import { AppHeader } from '@/components/AppHeader';
import { AuthForm } from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PokerSessionListCard } from '@/components/team/TeamPokerSessions';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, ClipboardList, FolderOpen, Spade, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pokerSessionPathSlug } from '@/lib/pokerSessionPathSlug';
import { format } from 'date-fns';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recentTeams, recentBoards, recentPokerSessions, loading } = useRecentActivity(5);
  const handleStartQuickRetro = () => {
    const randomRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/retro/${randomRoomId}`);
  };

  const handleStartQuickPoker = () => {
    const randomRoomId = Math.random().toString(36).substring(2, 8);
    navigate(`/poker/${randomRoomId}`, { state: { isCreating: true } });
  };

  if (!user) {
    return <AuthForm redirectTo="/dashboard" onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen pt-16 md:pt-0">
      <AppHeader variant="home" />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Recent Activity</h1>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleStartQuickRetro}
              className="bg-indigo-600 hover:bg-indigo-700 text-primary-foreground"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Start Quick Retro
            </Button>
            <Button
              variant="outline"
              onClick={handleStartQuickPoker}
              className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
            >
              <Spade className="h-4 w-4 mr-2" />
              Start Quick Poker
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading recent activity...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Teams
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent teams yet.</p>
                ) : (
                  recentTeams.map((team) => (
                    <Card
                      key={team.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-border"
                      onClick={() => navigate(`/teams/${team.id}`)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2">
                            {team.name}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            Created {format(new Date(team.createdAt), 'MMMM d, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last opened {format(new Date(team.lastAccessedAt), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Boards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentBoards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent boards yet.</p>
                ) : (
                  recentBoards.map((board) => (
                    <Card
                      key={board.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-border"
                      onClick={() => navigate(`/retro/${board.roomId}`)}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2">
                            {board.title}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {board.createdAt
                              ? `Created ${format(new Date(board.createdAt), 'MMMM d, yyyy')}`
                              : 'Created date unavailable'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{board.teamName}</div>
                          <div className="text-xs text-muted-foreground">
                            Last opened {format(new Date(board.lastAccessedAt), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Spade className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Poker Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentPokerSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent poker sessions yet.</p>
                ) : (
                  recentPokerSessions.map((session) => (
                    <PokerSessionListCard
                      key={session.id}
                      session={{
                        id: session.id,
                        room_id: session.roomId,
                        created_at: session.createdAt,
                        poker_session_rounds: session.roundStats,
                      }}
                      showIcon={false}
                      showActions={false}
                      subtitle={session.teamId ? session.teamName : 'Quick session'}
                      onOpen={() => {
                        const slug = pokerSessionPathSlug({
                          id: session.id,
                          room_id: session.roomId,
                        });
                        if (session.teamId) {
                          navigate(`/teams/${session.teamId}/poker/${slug}`);
                          return;
                        }
                        navigate(`/poker/${slug}`);
                      }}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

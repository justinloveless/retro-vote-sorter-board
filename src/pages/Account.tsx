
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Users, LogOut, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeams } from '@/hooks/useTeams';
import { AuthForm } from '@/components/AuthForm';

const Account = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { teams, loading: teamsLoading } = useTeams();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="font-medium text-sm text-gray-600">Email</span>
                  <p className="text-gray-900">{user.email}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-gray-600">Member since</span>
                  <p className="text-gray-900">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    My Teams
                  </div>
                  <Button onClick={() => navigate('/teams')}>
                    View All Teams
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamsLoading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-600">Loading teams...</div>
                  </div>
                ) : teams.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">You're not part of any teams yet.</p>
                    <Button onClick={() => navigate('/teams')}>
                      Create Your First Team
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teams.slice(0, 5).map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => navigate(`/teams/${team.id}`)}
                      >
                        <div>
                          <h3 className="font-medium text-gray-900">{team.name}</h3>
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            Created {new Date(team.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    ))}
                    {teams.length > 5 && (
                      <Button variant="outline" className="w-full" onClick={() => navigate('/teams')}>
                        View All {teams.length} Teams
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;

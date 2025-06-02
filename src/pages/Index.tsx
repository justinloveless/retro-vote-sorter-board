
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Calendar, Users, User, ArrowRight, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [roomId, setRoomId] = useState('');

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      navigate(`/retro/${roomId.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RetroScope</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </Button>
          {user ? (
            <>
              <Button variant="outline" onClick={() => navigate('/teams')}>
                <Users className="h-4 w-4 mr-2" />
                My Teams
              </Button>
              <Button variant="outline" onClick={() => navigate('/account')}>
                <User className="h-4 w-4 mr-2" />
                Account
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => navigate('/account')}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Collaborative Retrospectives
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Create engaging retrospective sessions with your team. Share insights, 
            vote on ideas, and drive continuous improvement.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              size="lg"
              onClick={() => {
                const randomRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                navigate(`/retro/${randomRoomId}`);
              }}
              className="flex items-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              Start Quick Retro
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            {user && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/teams')}
                className="flex items-center gap-2"
              >
                <Users className="h-5 w-5" />
                My Teams
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Join Existing Room */}
          <Card className="max-w-md mx-auto mb-12">
            <CardHeader>
              <CardTitle className="text-lg">Join Existing Retro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-id">Room ID</Label>
                <Input
                  id="room-id"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID (e.g., ABC123)"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
              </div>
              <Button onClick={handleJoinRoom} disabled={!roomId.trim()} className="w-full">
                Join Room
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                No account required - join as a guest or sign in for full features
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="text-center">
            <CardHeader>
              <Calendar className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Create instant retro boards without any setup. Perfect for ad-hoc sessions and guest users.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <CardTitle>Team Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Organize your teams, set default settings, and track all your retrospectives in one place.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <User className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <CardTitle>Guest-Friendly</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Anyone can join and participate without creating an account. Sign up for advanced features and team management.
              </p>
            </CardContent>
          </Card>
        </div>

        {user && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome back, {user.email}!
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Ready to run your next retrospective? Manage your teams or start a quick session.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate('/teams')}>
                <Users className="h-4 w-4 mr-2" />
                View My Teams
              </Button>
              <Button variant="outline" onClick={() => navigate('/account')}>
                <User className="h-4 w-4 mr-2" />
                Account Settings
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

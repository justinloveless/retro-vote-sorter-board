import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Users, User, LogIn, ClipboardList, Spade } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";

const Index = () => {
  const navigate = useNavigate();
  const [retroRoomId, setRetroRoomId] = useState('');
  const [pokerRoomId, setPokerRoomId] = useState('');

  const handleJoinRetroRoom = () => {
    if (retroRoomId.trim()) {
      navigate(`/retro/${retroRoomId.trim().toUpperCase()}`);
    }
  };

  const handleJoinPokerRoom = () => {
    if (pokerRoomId.trim()) {
      navigate(`/poker/${pokerRoomId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen pt-16 md:pt-0">
      <AppHeader />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Collaborative Tools for Agile Teams 2
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Run engaging retrospectives or story point estimation sessions with your team.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            {/* Retro Column */}
            <div className="flex flex-col gap-4">
              <Button
                size="lg"
                onClick={() => {
                  const randomRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                  navigate(`/retro/${randomRoomId}`);
                }}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-primary-foreground"
              >
                <ClipboardList className="h-5 w-5" />
                Start Quick Retro
              </Button>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <ClipboardList className="h-10 w-10 text-indigo-600" />
                    <CardTitle className="text-lg">Join Existing Retro</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="retro-room-id">Room ID</Label>
                    <Input
                      id="retro-room-id"
                      value={retroRoomId}
                      onChange={(e) => setRetroRoomId(e.target.value)}
                      placeholder="Enter retro room ID (e.g., ABC123)"
                      onKeyPress={(e) => e.key === 'Enter' && handleJoinRetroRoom()}
                    />
                  </div>
                  <Button onClick={handleJoinRetroRoom} disabled={!retroRoomId.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-primary-foreground">
                    Join Retro
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Poker Column */}
            <div className="flex flex-col gap-4">
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  const randomRoomId = Math.random().toString(36).substring(2, 8);
                  navigate(`/poker/${randomRoomId}`, { state: { isCreating: true } });
                }}
                className="flex items-center justify-center gap-2 border-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
              >
                <Spade className="h-5 w-5" />
                Start Quick Poker
              </Button>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Spade className="h-10 w-10 text-green-600 dark:text-green-400" />
                    <CardTitle className="text-lg">Join Existing Poker Session</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="poker-room-id">Session ID</Label>
                    <Input
                      id="poker-room-id"
                      value={pokerRoomId}
                      onChange={(e) => setPokerRoomId(e.target.value)}
                      placeholder="Enter session ID (e.g., abc123)"
                      onKeyPress={(e) => e.key === 'Enter' && handleJoinPokerRoom()}
                    />
                  </div>
                  <Button onClick={handleJoinPokerRoom} disabled={!pokerRoomId.trim()} className="w-full bg-green-600 hover:bg-green-700 text-primary-foreground">
                    Join Session
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            No account required for quick sessions - join as a guest or sign in for full features
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <Card className="text-center">
            <CardHeader>
              <ClipboardList className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
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

          <Card className="text-center">
            <CardHeader>
              <Spade className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <CardTitle>Planning Poker</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Engage in interactive story point estimation sessions with your team using a deck of cards.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;

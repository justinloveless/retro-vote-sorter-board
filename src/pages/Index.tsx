
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Users, Zap, Shield, Vote } from 'lucide-react';
import { useState } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState('');

  const createNewRetro = () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/retro/${roomId}`);
  };

  const joinExistingRetro = () => {
    if (joinRoomId.trim()) {
      navigate(`/retro/${joinRoomId.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Team Retro
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Run engaging retrospectives with your development team. 
            Collaborate in real-time, vote on items, and turn insights into action.
          </p>
          
          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              onClick={createNewRetro}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 text-lg"
            >
              Create New Retro
            </Button>
            
            <div className="flex gap-2">
              <Input
                placeholder="Enter room ID (e.g. ABC123)"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="w-48"
                onKeyPress={(e) => e.key === 'Enter' && joinExistingRetro()}
              />
              <Button 
                onClick={joinExistingRetro}
                variant="outline"
                size="lg"
                disabled={!joinRoomId.trim()}
              >
                Join Room
              </Button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <Vote className="h-12 w-12 mx-auto text-indigo-600 mb-4" />
              <CardTitle className="text-lg">Real-time Voting</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Items automatically sort by votes. See what matters most to your team.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <Users className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <CardTitle className="text-lg">Collaborative</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Everyone can add items, vote, and contribute to the discussion.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <Zap className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
              <CardTitle className="text-lg">Customizable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Add custom columns beyond the default Good, Bad, Kudos, and Action Items.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <Shield className="h-12 w-12 mx-auto text-purple-600 mb-4" />
              <CardTitle className="text-lg">Private & Secure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Password protect your retros or keep them public for easy access.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it Works */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">How it Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold">Create or Join</h3>
              <p className="text-gray-600">Start a new retro room or join an existing one with a room ID</p>
            </div>
            
            <div className="space-y-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold">Add & Vote</h3>
              <p className="text-gray-600">Team members add retro items and upvote what resonates with them</p>
            </div>
            
            <div className="space-y-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold">Discuss & Act</h3>
              <p className="text-gray-600">Focus on highly voted items and create actionable next steps</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to improve your retros?</h3>
              <p className="mb-6 opacity-90">
                Start running more effective retrospectives today. It's free and takes less than 30 seconds to get started.
              </p>
              <Button 
                onClick={createNewRetro}
                size="lg"
                variant="secondary"
                className="bg-white text-indigo-600 hover:bg-gray-100"
              >
                Start Your First Retro
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;

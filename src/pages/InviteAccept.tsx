import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInvitationAccept } from '@/hooks/useInvitationAccept';
import { AuthForm } from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CheckCircle, Lock } from 'lucide-react';

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { acceptInvitation, loading } = useInvitationAccept();
  const [accepted, setAccepted] = useState(false);

  const handleAcceptInvitation = async () => {
    if (!token) return;

    const result = await acceptInvitation(token);
    if (result.success) {
      setAccepted(true);
      setTimeout(() => {
        navigate(`/teams/${result.teamId}`);
      }, 2000);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card className="mb-6">
              <CardHeader className="text-center">
                <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Sign in required</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center mb-4">
                  You need to be signed in to accept this team invitation.
                  Please sign in or create an account below.
                </p>
              </CardContent>
            </Card>
            <AuthForm onAuthSuccess={() => { }} />
          </div>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the team!</h2>
            <p className="text-gray-600 mb-4">
              You've successfully joined the team. Redirecting you now...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <CardTitle>Join Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 text-center">
            You've been invited to join a team. Click the button below to accept the invitation.
          </p>
          <Button
            onClick={handleAcceptInvitation}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Accepting...' : 'Accept Invitation'}
          </Button>
          <div className="text-xs text-gray-500 text-center">
            By accepting this invitation, you'll become a member of the team and gain access to all team resources.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAccept;

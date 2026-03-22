import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { usePokerSession } from '@/hooks/usePokerSession';
import PokerTable from '@/components/Neotro/PokerTable';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/hooks/use-toast";
import { Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// Helper function to get or create anonymous user identity
const getAnonymousUser = () => {
    let user = JSON.parse(localStorage.getItem('anonymousPokerUser') || '{}');
    if (!user.id) {
        user = { id: uuidv4() };
        // We will prompt for name, so save only the ID for now
        localStorage.setItem('anonymousPokerUser', JSON.stringify({ id: user.id }));
    }
    return user;
};

const AnonymousPokerPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const requestedRoundNumberFromUrl = useMemo(() => {
        const roundParam = searchParams.get('round');
        if (roundParam == null || roundParam === '') return null;
        const n = Number.parseInt(roundParam, 10);
        return Number.isFinite(n) && n >= 1 ? n : null;
    }, [searchParams]);
    const { toast } = useToast();
    const { user, profile, loading: authLoading } = useAuth();
    const [player, setPlayer] = useState<{ id?: string, name?: string }>({});
    const [isIdentityReady, setIsIdentityReady] = useState(false);
    const [anonymousNameInput, setAnonymousNameInput] = useState('');

    const isCreating = location.state?.isCreating;

    useEffect(() => {
        if (authLoading) return;

        if (user && profile) {
            setPlayer({ id: user.id, name: profile.full_name || user.email });
            setIsIdentityReady(true);
        } else {
            const anonymousUser = getAnonymousUser();
            if (anonymousUser.name) {
                setPlayer(anonymousUser);
                setIsIdentityReady(true);
            } else {
                setPlayer({ id: anonymousUser.id });
                setIsIdentityReady(false);
            }
        }
    }, [user, profile, authLoading]);

    const { session, loading: sessionLoading, sessionDeletedRemotely, ...pokerActions } = usePokerSession(
        isIdentityReady ? roomId : null,
        player.id,
        player.name,
        isCreating
    );

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({
            title: "Link Copied!",
            description: "The session link has been copied to your clipboard.",
        });
    };

    const handleNameSubmit = () => {
        if (anonymousNameInput.trim()) {
            const newAnonymousUser = { ...player, name: anonymousNameInput.trim() };
            localStorage.setItem('anonymousPokerUser', JSON.stringify(newAnonymousUser));
            setPlayer(newAnonymousUser);
            setIsIdentityReady(true);
        }
    };

    const renderContent = () => {
        if (authLoading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
                </div>
            )
        }

        if (!isIdentityReady) {
            return (
                <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
                    <Card className="w-full max-w-sm">
                        <CardHeader>
                            <CardTitle>Enter Your Name</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p>To join the poker session, please enter a display name.</p>
                            <Input
                                value={anonymousNameInput}
                                onChange={(e) => setAnonymousNameInput(e.target.value)}
                                placeholder="Your Name"
                                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                            />
                            <Button onClick={handleNameSubmit} className="w-full" disabled={!anonymousNameInput.trim()}>
                                Join Session
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        if (sessionLoading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
                </div>
            );
        }

        if (sessionDeletedRemotely) {
            const goHome = () => navigate('/');
            return (
                <AlertDialog open={sessionDeletedRemotely} onOpenChange={(open) => { if (!open) goHome(); }}>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Session deleted</AlertDialogTitle>
                            <AlertDialogDescription>
                                This poker session was removed. You will return to the home page.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction onClick={goHome}>OK</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            );
        }

        if (!session) {
            return (
                <div className="flex-1 flex items-center justify-center text-center p-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Poker Session Closed</h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            This session is no longer available.
                        </p>
                        <Button
                            onClick={() => {
                                const newRoomId = Math.random().toString(36).substring(2, 8);
                                navigate(`/poker/${newRoomId}`, { state: { isCreating: true } });
                            }}
                        >
                            Start a New Quick Poker Session
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <PokerTable
                    session={session}
                    activeUserId={player.id}
                    activeUserDisplayName={player.name}
                    requestedRoundNumber={requestedRoundNumberFromUrl}
                    {...pokerActions}
                    presentUserIds={pokerActions.presentUserIds}
                    onPokerBack={() => navigate('/')}
                    pokerToolbarExtras={
                        <div className="flex items-center gap-2 min-w-0 max-w-[min(100%,220px)] sm:max-w-xs">
                            <span className="font-mono text-xs text-foreground truncate" title={roomId}>
                                {roomId}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={copyLink}
                                aria-label="Copy session link"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    }
                />
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col">
            {renderContent()}
        </div>
    );
};

export default AnonymousPokerPage;

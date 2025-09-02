import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePokerSession } from '../hooks/usePokerSession.ts';
import PokerTable from '../components/Neotro/PokerTable.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.tsx';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../hooks/use-toast.ts';
import { Copy, ArrowLeft, Home, LogIn, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { AppHeader } from '../components/AppHeader.tsx';
import { useIsMobile } from '../hooks/use-mobile.tsx';

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
    const { toast } = useToast();
    const { user, profile, loading: authLoading } = useAuth();
    const isMobile = useIsMobile();

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

    const { session, loading: sessionLoading, ...pokerActions } = usePokerSession(
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
            )
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
            <div className="flex-1 min-h-0">
                <PokerTable
                    session={session}
                    activeUserId={player.id}
                    {...pokerActions}
                    presentUserIds={pokerActions.presentUserIds}
                />
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col pt-16 md:pt-0">
            {!isMobile ? (
                <AppHeader variant='home'>
                    <div className="pl-12 bg-transparent flex items-center justify-between">
                        <div className='flex items-center gap-6'>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500 dark:text-gray-400">Room ID:</span>
                                <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">{roomId}</span>
                            </div>
                            <Button variant="outline" size="sm" onClick={copyLink}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Link
                            </Button>
                        </div>
                    </div>
                </AppHeader>
            ) : (
                <div className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => navigate('/')}
                            className="text-white hover:bg-white/20"
                        >
                            <Home className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-white/80">Room ID:</span>
                            <span className="font-mono text-sm bg-white/20 backdrop-blur rounded px-2 py-1 text-white">{roomId}</span>
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={copyLink}
                        className="text-white hover:bg-white/20"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {renderContent()}
        </div>
    );
};

export default AnonymousPokerPage;

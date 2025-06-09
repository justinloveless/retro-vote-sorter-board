import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Users, User, LogIn, LogOut, Shield, Home, ArrowLeft } from 'lucide-react';
import React from 'react';

type HeaderVariant = 'default' | 'home' | 'back';

interface AppHeaderProps {
    variant?: HeaderVariant;
    backTo?: string;
    children?: React.ReactNode;
}

export const AppHeader = ({ variant = 'default', backTo, children }: AppHeaderProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const renderLeftContent = () => {
        switch (variant) {
            case 'home':
                if (location.pathname === '/') return null;
                return (
                    <Button variant="ghost" onClick={() => navigate('/')}>
                        <Home className="h-4 w-4 mr-2" />
                        Home
                    </Button>
                );
            case 'back':
                if (backTo && location.pathname === backTo) return null;
                return (
                    <Button variant="ghost" onClick={() => (backTo ? navigate(backTo) : navigate(-1))}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                );
            case 'default':
            default:
                return (
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RetroScope</h1>
                );
        }
    };

    return (
        <header className="flex justify-between items-center p-6">
            <div className="flex items-center space-x-4">
                {renderLeftContent()}
            </div>
            <div className="flex-grow flex">
                {children}
            </div>
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" onClick={toggleTheme}>
                    {theme === 'light' ? '🌙' : '☀️'}
                </Button>
                {user ? (
                    <>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Avatar
                                        className={`h-10 w-10`}
                                    >
                                        <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || user.email || 'User Avatar'} />
                                        <AvatarFallback>{(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {profile?.full_name && <p className="font-semibold">{profile.full_name}</p>}
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {profile?.role === 'admin' && location.pathname !== '/admin' && (
                            <Button variant="outline" onClick={() => navigate('/admin')}>
                                <Shield className="h-4 w-4 mr-2" />
                                Admin
                            </Button>
                        )}
                        {location.pathname !== '/teams' && (
                            <Button variant="outline" onClick={() => navigate('/teams')}>
                                <Users className="h-4 w-4 mr-2" />
                                My Teams
                            </Button>
                        )}
                        {location.pathname !== '/account' && (
                            <Button variant="outline" onClick={() => navigate('/account')}>
                                <User className="h-4 w-4 mr-2" />
                                Account
                            </Button>
                        )}
                        <Button variant="outline" onClick={signOut}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </Button>
                    </>
                ) : (
                    location.pathname !== '/account' && (
                        <Button variant="outline" onClick={() => navigate('/account')}>
                            <LogIn className="h-4 w-4 mr-2" />
                            Sign In
                        </Button>
                    )
                )}
            </div>
        </header>
    );
}; 
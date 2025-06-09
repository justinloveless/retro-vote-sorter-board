import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Users, User, LogIn, LogOut, Shield, Home, ArrowLeft, Menu } from 'lucide-react';
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
    const isMobile = useIsMobile();

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

    const renderMobileMenuItems = () => (
        <div className="flex flex-col space-y-4 p-4">
            <Button variant="ghost" onClick={toggleTheme} className="justify-start">
                {theme === 'light' ? '🌙' : '☀️'}
                <span className="ml-2">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </Button>
            
            {variant === 'home' && location.pathname !== '/' && (
                <Button variant="ghost" onClick={() => navigate('/')} className="justify-start">
                    <Home className="h-4 w-4 mr-2" />
                    Home
                </Button>
            )}
            
            {variant === 'back' && !(backTo && location.pathname === backTo) && (
                <Button variant="ghost" onClick={() => (backTo ? navigate(backTo) : navigate(-1))} className="justify-start">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            )}

            {user ? (
                <>
                    {profile?.role === 'admin' && location.pathname !== '/admin' && (
                        <Button variant="outline" onClick={() => navigate('/admin')} className="justify-start">
                            <Shield className="h-4 w-4 mr-2" />
                            Admin
                        </Button>
                    )}
                    {location.pathname !== '/teams' && (
                        <Button variant="outline" onClick={() => navigate('/teams')} className="justify-start">
                            <Users className="h-4 w-4 mr-2" />
                            My Teams
                        </Button>
                    )}
                    {location.pathname !== '/account' && (
                        <Button variant="outline" onClick={() => navigate('/account')} className="justify-start">
                            <User className="h-4 w-4 mr-2" />
                            Account
                        </Button>
                    )}
                    <Button variant="outline" onClick={signOut} className="justify-start">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                    </Button>
                </>
            ) : (
                location.pathname !== '/account' && (
                    <Button variant="outline" onClick={() => navigate('/account')} className="justify-start">
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In
                    </Button>
                )
            )}
        </div>
    );

    const renderDesktopActions = () => (
        <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'light' ? '🌙' : '☀️'}
            </Button>
            {user ? (
                <>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar className="h-10 w-10">
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
    );

    return (
        <header className={`flex justify-between items-center p-4 md:p-6 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-background/40 backdrop-blur-sm' : ''}`}>
            <div className="flex items-center space-x-4">
                {renderLeftContent()}
            </div>
            <div className="flex-grow flex justify-center">
                {children}
            </div>
            <div className="flex items-center space-x-2">
                {isMobile ? (
                    <>
                        {user && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || user.email || 'User Avatar'} />
                                            <AvatarFallback className="text-xs">{(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {profile?.full_name && <p className="font-semibold">{profile.full_name}</p>}
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right">
                                <SheetHeader>
                                    <SheetTitle>Menu</SheetTitle>
                                </SheetHeader>
                                {renderMobileMenuItems()}
                            </SheetContent>
                        </Sheet>
                    </>
                ) : (
                    renderDesktopActions()
                )}
            </div>
        </header>
    );
};

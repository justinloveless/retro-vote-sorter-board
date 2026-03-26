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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrgSelector } from '@/contexts/OrgSelectorContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Users, User, LogIn, LogOut, Shield, Home, ArrowLeft, Menu, Building2, LayoutDashboard } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
import { DialogHeader } from './ui/dialog';
import { AuthForm } from './AuthForm';
import { FeedbackButton } from './FeedbackButton';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { FEATURE_ORGANIZATION_SELECTOR_ENABLED } from '@/constants/featureFlags';

type HeaderVariant = 'default' | 'home' | 'back';

interface AppHeaderProps {
    variant?: HeaderVariant;
    backTo?: string;
    handleSignIn?: () => void;
    children?: React.ReactNode;
}

export const AppHeader = ({ variant = 'default', backTo, children, handleSignIn }: AppHeaderProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, signOut, isImpersonating, stopImpersonating } = useAuth();
    const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(null);
    useEffect(() => {
        const load = async () => {
            if (!isImpersonating || !profile?.id) {
                setImpersonatedEmail(null);
                return;
            }
            try {
                const { data, error } = await supabase.rpc('get_user_email_if_admin', { target_user: profile.id });
                if (error) throw error;
                setImpersonatedEmail(typeof data === 'string' ? data : null);
            } catch {
                setImpersonatedEmail(null);
            }
        };
        load();
    }, [isImpersonating, profile?.id]);
    const { theme, toggleTheme } = useTheme();
    const isMobile = useIsMobile();
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);

    const { organizations, selectedOrgId, selectedOrg, selectedOrgRole, setSelectedOrgId, hasOrgs } = useOrgSelector();
    const { isFeatureEnabled, loading: flagsLoading } = useFeatureFlags();
    const showOrganizationSelector =
        flagsLoading || isFeatureEnabled(FEATURE_ORGANIZATION_SELECTOR_ENABLED);
    const isOrgAdminOrOwner = selectedOrgRole === 'owner' || selectedOrgRole === 'admin';
    const isInAdminSection = location.pathname.startsWith('/admin');

    const renderOrgSelector = () => {
        if (!user || !hasOrgs || !showOrganizationSelector) return null;
        return (
            <Select
                value={selectedOrgId || '_personal'}
                onValueChange={(val) => setSelectedOrgId(val === '_personal' ? null : val)}
            >
                <SelectTrigger className="w-[180px] h-9 text-sm">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <SelectValue />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="_personal">Personal</SelectItem>
                    {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    };

    const renderLeftContent = () => {
        switch (variant) {
            case 'home':
                if (location.pathname === '/') return null;
                return (
                    <Button variant="ghost" onClick={() => navigate(user ? '/dashboard' : '/')}>
                        {user ? (
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                        ) : (
                            <Home className="h-4 w-4 mr-2" />
                        )}
                        {user ? 'Dashboard' : 'Home'}
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
            {user && hasOrgs && showOrganizationSelector && (
                <div>
                    <p className="text-xs text-muted-foreground mb-1 px-1">Organization</p>
                    <Select
                        value={selectedOrgId || '_personal'}
                        onValueChange={(val) => setSelectedOrgId(val === '_personal' ? null : val)}
                    >
                        <SelectTrigger className="w-full h-9 text-sm">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 shrink-0" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_personal">Personal</SelectItem>
                            {organizations.map((org) => (
                                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <Button variant="ghost" onClick={toggleTheme} className="justify-start">
                {theme === 'light' ? '🌙' : '☀️'}
                <span className="ml-2">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </Button>

            {variant === 'home' && location.pathname !== '/' && (
                <Button variant="ghost" onClick={() => navigate(user ? '/dashboard' : '/')} className="justify-start">
                    {user ? (
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                    ) : (
                        <Home className="h-4 w-4 mr-2" />
                    )}
                    {user ? 'Dashboard' : 'Home'}
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
                    {profile?.role === 'admin' && !isInAdminSection && (
                        <Button variant="outline" onClick={() => navigate('/admin')} className="justify-start">
                            <Shield className="h-4 w-4 mr-2" />
                            Admin
                        </Button>
                    )}
                    {isOrgAdminOrOwner && selectedOrg && (
                        <Button variant="outline" onClick={() => navigate(`/org/${selectedOrg.slug}/admin`)} className="justify-start">
                            <Building2 className="h-4 w-4 mr-2" />
                            Org Settings
                        </Button>
                    )}
                    {location.pathname !== '/teams' && (
                        <Button variant="outline" onClick={() => navigate('/teams')} className="justify-start">
                            <Users className="h-4 w-4 mr-2" />
                            My Teams
                        </Button>
                    )}
                    {location.pathname !== '/dashboard' && (
                        <Button variant="outline" onClick={() => navigate('/dashboard')} className="justify-start">
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Dashboard
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
                    <NotificationBell />
                    {isImpersonating && (
                        <div className="hidden md:flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                            <span>Impersonating</span>
                            <span className="font-medium truncate max-w-[140px]">{profile?.full_name || profile?.id}</span>
                            <Button variant="ghost" size="sm" onClick={stopImpersonating}>Stop</Button>
                        </div>
                    )}
                    {isOrgAdminOrOwner && selectedOrg && (
                        <Button variant="outline" onClick={() => navigate(`/org/${selectedOrg.slug}/admin`)}>
                            <Building2 className="h-4 w-4 mr-2" />
                            Org Settings
                        </Button>
                    )}
                    <Popover open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            aria-label="Open profile menu"
                                        >
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || user.email || 'User Avatar'} />
                                                <AvatarFallback>{(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        </button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {profile?.full_name && <p className="font-semibold">{profile.full_name}</p>}
                                    <p className="text-sm text-muted-foreground">{impersonatedEmail || user.email}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <PopoverContent align="end" className="w-56 p-2">
                            <div className="flex flex-col gap-1">
                                {profile?.role === 'admin' && !isInAdminSection && (
                                    <Button variant="ghost" className="w-full justify-start" onClick={() => {
                                        navigate('/admin');
                                        setProfileMenuOpen(false);
                                    }}>
                                        <Shield className="h-4 w-4 mr-2" />
                                        Admin
                                    </Button>
                                )}
                                {location.pathname !== '/teams' && (
                                    <Button variant="ghost" className="w-full justify-start" onClick={() => {
                                        navigate('/teams');
                                        setProfileMenuOpen(false);
                                    }}>
                                        <Users className="h-4 w-4 mr-2" />
                                        My Teams
                                    </Button>
                                )}
                                {location.pathname !== '/dashboard' && (
                                    <Button variant="ghost" className="w-full justify-start" onClick={() => {
                                        navigate('/dashboard');
                                        setProfileMenuOpen(false);
                                    }}>
                                        <LayoutDashboard className="h-4 w-4 mr-2" />
                                        Dashboard
                                    </Button>
                                )}
                                {location.pathname !== '/account' && (
                                    <Button variant="ghost" className="w-full justify-start" onClick={() => {
                                        navigate('/account');
                                        setProfileMenuOpen(false);
                                    }}>
                                        <User className="h-4 w-4 mr-2" />
                                        Account
                                    </Button>
                                )}
                                <FeedbackButton
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onOpenRequested={() => setProfileMenuOpen(false)}
                                />
                                <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700" onClick={() => {
                                    setProfileMenuOpen(false);
                                    signOut();
                                }}>
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Sign Out
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </>
            ) : (
                location.pathname !== '/account' && (
                    <Button
                        onClick={handleSignIn || (() => navigate('/account'))}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <User className="h-4 w-4" />
                        Sign In
                    </Button>
                )
            )}
        </div >
    );

    return (
        <header className={`flex justify-between items-center px-4 py-2 md:px-6 md:py-3 ${isMobile ? 'fixed top-0 left-0 right-0 z-50 bg-background/40 backdrop-blur-sm' : ''}`}>
            <div className="flex items-center space-x-4">
                {!isMobile && renderOrgSelector()}
                {renderLeftContent()}
            </div>
            <div id="app-header-center-slot" className="flex-grow flex justify-center">
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
                                        <p className="text-sm text-muted-foreground">{impersonatedEmail || user.email}</p>
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

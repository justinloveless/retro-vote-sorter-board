import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GlobalBackground } from '@/components/ui/GlobalBackground';
import { AppHeader } from '@/components/AppHeader';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isValidToken, setIsValidToken] = useState(false);
    const [checkingToken, setCheckingToken] = useState(true);

    useEffect(() => {
        let authSubscription: any;

        const checkTokenValidity = async () => {
            // Debug: log all URL parameters
            console.log('All URL parameters:', Object.fromEntries(searchParams.entries()));

            // Also check URL hash parameters (Supabase might use fragments)
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            console.log('Hash parameters:', Object.fromEntries(hashParams.entries()));

            // Check if we have the necessary URL parameters for password reset
            let accessToken = searchParams.get('access_token') || hashParams.get('access_token');
            let refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');
            let type = searchParams.get('type') || hashParams.get('type');

            console.log('Password reset parameters:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

            // Set up auth state change listener
            authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth state change:', event, !!session);

                if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session && type === 'recovery')) {
                    console.log('Password recovery session detected');
                    setIsValidToken(true);
                    setCheckingToken(false);
                    toast({
                        title: "Ready to reset password",
                        description: "Please enter your new password below.",
                    });
                } else if (event === 'SIGNED_OUT' && type === 'recovery') {
                    console.log('Password recovery session expired');
                    setIsValidToken(false);
                    setCheckingToken(false);
                    toast({
                        title: "Invalid reset link",
                        description: "This password reset link is invalid or has expired.",
                        variant: "destructive",
                    });
                    setTimeout(() => navigate('/'), 3000);
                }
            });

            if (type === 'recovery' && accessToken && refreshToken) {
                try {
                    console.log('Attempting to set session...');
                    // Set the session with the tokens from the URL
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    console.log('Session set result:', { data: !!data, error });

                    if (error) throw error;

                    // Don't set isValidToken here, let the auth state change handle it
                } catch (error: any) {
                    console.error('Error setting session:', error);
                    toast({
                        title: "Invalid reset link",
                        description: "This password reset link is invalid or has expired.",
                        variant: "destructive",
                    });
                    setTimeout(() => navigate('/'), 3000);
                    setCheckingToken(false);
                }
            } else {
                console.log('Missing required parameters or wrong type');
                toast({
                    title: "Invalid reset link",
                    description: "This password reset link is invalid or has expired.",
                    variant: "destructive",
                });
                setTimeout(() => navigate('/'), 3000);
                setCheckingToken(false);
            }
        };

        checkTokenValidity();

        // Cleanup subscription on component unmount
        return () => {
            if (authSubscription) {
                authSubscription.data.subscription.unsubscribe();
            }
        };
    }, [searchParams, navigate, toast]);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast({
                title: "Passwords don't match",
                description: "Please ensure both passwords are the same.",
                variant: "destructive",
            });
            return;
        }

        if (password.length < 6) {
            toast({
                title: "Password too short",
                description: "Password must be at least 6 characters long.",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            toast({
                title: "Password updated successfully!",
                description: "You can now sign in with your new password.",
            });

            // Redirect to account page after successful password reset
            setTimeout(() => navigate('/account'), 2000);
        } catch (error: any) {
            toast({
                title: "Password update failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (checkingToken) {
        return (
            <>
                <GlobalBackground />
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-lg text-gray-600 dark:text-gray-300">Verifying reset link...</div>
                </div>
            </>
        );
    }

    if (!isValidToken) {
        return (
            <>
                <GlobalBackground />
                <div className="min-h-screen flex items-center justify-center">
                    <Card className="w-full max-w-md bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-center text-gray-900 dark:text-gray-50">Invalid Reset Link</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                This password reset link is invalid or has expired.
                            </p>
                            <Button onClick={() => navigate('/')} className="w-full">
                                Return to Home
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    return (
        <>
            <GlobalBackground />
            <AppHeader variant="home" />
            <div className="min-h-screen flex items-center justify-center p-6 pt-24">
                <Card className="w-full max-w-md bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-center text-gray-900 dark:text-gray-50">Reset Your Password</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                            <Input
                                type="password"
                                placeholder="New password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                            <Input
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Updating password...' : 'Update Password'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ResetPassword; 
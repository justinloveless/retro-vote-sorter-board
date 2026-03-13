import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, LogOut, Palette, Shield, Edit, Save, X, Lock, CreditCard, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useTeams } from '@/hooks/useTeams';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthForm } from '@/components/AuthForm';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { BackgroundSettings } from '@/components/account/BackgroundSettings';
import { EndorsementsReceived } from '@/components/account/EndorsementsReceived';
import { MentionsReceived } from '@/components/account/MentionsReceived';
import { AppHeader } from '@/components/AppHeader';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { currentEnvironment } from '@/config/environment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarUploader } from '@/components/account/AvatarUploader';

const Account = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut, updateProfile, isImpersonating, refreshImpersonatedProfile } = useAuth();
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(null);
  const { teams, loading: teamsLoading } = useTeams();
  const { tier, subscribed, subscriptionEnd, cancelAtPeriodEnd, loading: subLoading } = useSubscription();
  const { theme, setTheme } = useTheme();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    setNickname((profile as any)?.nickname || '');
  }, [profile?.full_name, (profile as any)?.nickname]);

  useEffect(() => {
    const loadEmail = async () => {
      if (!isImpersonating || !profile?.id) {
        setImpersonatedEmail(null);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_user_email_if_admin', { target_user: profile.id });
        if (error) throw error as any;
        setImpersonatedEmail((data as any) || null);
      } catch (e) {
        setImpersonatedEmail(null);
      }
    };
    loadEmail();
  }, [isImpersonating, profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNameSave = async () => {
    if (!fullName.trim()) {
      toast({
        title: 'Name cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    try {
      await updateProfile({ full_name: fullName });
      toast({
        title: 'Profile updated',
        description: 'Your name has been successfully updated.',
      });
      setIsEditingName(false);
    } catch (error: any) {
      toast({
        title: 'Failed to update profile',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);

    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: passwordData.currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password updated successfully!",
        description: "Your password has been changed.",
      });

      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast({
        title: "Password change failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm redirectTo={`/account`} onAuthSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen pt-16 md:pt-0">
      <AppHeader variant="home" />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">My Account</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'User Avatar'} />
                      <AvatarFallback>
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className="font-medium text-sm text-gray-600 dark:text-gray-400 block mb-1">Profile Picture</span>
                      <AvatarUploader
                        initialUrl={profile?.avatar_url}
                        onCropped={async (blob) => {
                          try {
                            if (isImpersonating && profile?.id) {
                              // When impersonating, call admin Edge Function to set avatar for target user
                              const arrayBuffer = await blob.arrayBuffer();
                              const { data: { session } } = await supabase.auth.getSession();
                              const resp = await fetch(`${currentEnvironment.supabaseUrl}/functions/v1/admin-set-avatar?user_id=${profile.id}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'image/png',
                                  'Authorization': `Bearer ${session?.access_token ?? ''}`
                                },
                                body: arrayBuffer
                              });
                              if (!resp.ok) {
                                const err = await resp.text();
                                throw new Error(err || 'Failed to set avatar as admin');
                              }
                              const json = await resp.json();
                              await refreshImpersonatedProfile();
                              toast({ title: 'Profile picture updated for impersonated user' });
                            } else {
                              // Normal case: update own avatar
                              const fileName = `${user.id}.png`;
                              await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
                              const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                              await updateProfile({ avatar_url: data.publicUrl });
                              toast({ title: 'Profile picture updated' });
                            }
                          } catch (e: any) {
                            toast({ title: 'Failed to update avatar', description: e.message || String(e), variant: 'destructive' });
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-600 dark:text-gray-400">Full Name</span>
                    {!isEditingName ? (
                      <div className="flex items-center justify-between">
                        <p className="text-gray-900 dark:text-gray-100">{profile?.full_name || 'Not set'}</p>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="flex-grow"
                        />
                        <Button variant="ghost" size="icon" onClick={handleNameSave}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setIsEditingName(false);
                          setFullName(profile?.full_name || '');
                        }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-600 dark:text-gray-400">Nickname</span>
                    {!isEditingNickname ? (
                      <div className="flex items-center justify-between">
                        <p className="text-gray-900 dark:text-gray-100">{(profile as any)?.nickname || <span className="text-muted-foreground italic">Not set</span>}</p>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingNickname(true)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder="e.g. JD"
                          className="flex-grow"
                        />
                        <Button variant="ghost" size="icon" onClick={async () => {
                          try {
                            await updateProfile({ nickname } as any);
                            toast({ title: 'Nickname updated' });
                            setIsEditingNickname(false);
                          } catch (error: any) {
                            toast({ title: 'Failed to update nickname', description: error.message, variant: 'destructive' });
                          }
                        }}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setIsEditingNickname(false);
                          setNickname((profile as any)?.nickname || '');
                        }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-600 dark:text-gray-400">Email</span>
                    <p className="text-gray-900 dark:text-gray-100">{impersonatedEmail || user.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-600 dark:text-gray-400">Member since</span>
                    <p className="text-gray-900 dark:text-gray-100">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Password
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isChangingPassword ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Change your password to keep your account secure.
                    </p>
                    <Button onClick={() => setIsChangingPassword(true)} variant="outline">
                      Change Password
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input
                      type="password"
                      placeholder="Current password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="New password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    />
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePasswordChange}
                        disabled={passwordLoading}
                        size="sm"
                      >
                        {passwordLoading ? 'Updating...' : 'Update Password'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark')} className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light">Light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark">Dark</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Current Plan</span>
                    <span className="font-semibold text-foreground capitalize">{subLoading ? '...' : tier}</span>
                  </div>
                  {subscribed && subscriptionEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        {cancelAtPeriodEnd ? 'Expires' : 'Renews'}
                      </span>
                      <span className={`text-sm ${cancelAtPeriodEnd ? 'text-destructive' : 'text-foreground'}`}>
                        {new Date(subscriptionEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <Button className="w-full mt-2" variant="outline" onClick={() => navigate('/billing')}>
                    Manage Billing <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <EndorsementsReceived userId={profile?.id || user.id} />
          <MentionsReceived userId={profile?.id || user.id} />
        </div>

        <div className="mt-6">
          <BackgroundSettings />
        </div>
      </div>
    </div>
  );
};

export default Account;

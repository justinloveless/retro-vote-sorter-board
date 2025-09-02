import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.tsx';
import { User, Users, LogOut, Calendar, Home, Palette, Shield, Edit, Save, X, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { useTeams } from '../hooks/useTeams.ts';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { AuthForm } from '../components/AuthForm.tsx';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group.tsx'
import { Label } from '../components/ui/label.tsx'
import { BackgroundSettings } from '../components/account/BackgroundSettings.tsx';
import { AppHeader } from '../components/AppHeader.tsx';
import { Input } from '../components/ui/input.tsx';
import { useToast } from '../hooks/use-toast.ts';
import { supabase } from '../integrations/supabase/client.ts';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar.tsx';
import { AvatarUploader } from '../components/account/AvatarUploader.tsx';

const Account = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut, updateProfile, isImpersonating } = useAuth();
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(null);
  const { teams, loading: teamsLoading } = useTeams();
  const { theme, setTheme } = useTheme();
  const [isEditingName, setIsEditingName] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile?.full_name]);

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
                            const fileName = `${user.id}.png`;
                            await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
                            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                            await updateProfile({ avatar_url: data.publicUrl });
                            toast({ title: 'Profile picture updated' });
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

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    My Teams
                  </div>
                  <Button onClick={() => navigate('/teams')}>
                    View All Teams
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamsLoading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-600 dark:text-gray-300">Loading teams...</div>
                  </div>
                ) : teams.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-300 mb-4">You're not part of any teams yet.</p>
                    <Button onClick={() => navigate('/teams')}>
                      Create Your First Team
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teams.slice(0, 5).map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                        onClick={() => navigate(`/teams/${team.id}`)}
                      >
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">{team.name}</h3>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3 w-3 mr-1" />
                            Created {new Date(team.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    ))}
                    {teams.length > 5 && (
                      <Button variant="outline" className="w-full" onClick={() => navigate('/teams')}>
                        View All {teams.length} Teams
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="mt-6">
          <BackgroundSettings />
        </div>
      </div>
    </div>
  );
};

export default Account;

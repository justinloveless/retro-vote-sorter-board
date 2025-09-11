import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { Profile } from '@/hooks/useAuth';
import { AvatarUploader } from '@/components/account/AvatarUploader';
import { supabase } from '@/integrations/supabase/client';

interface AccountDetailsProps {
    user: any;
    profile: Profile | null;
    editing: boolean;
    onSetEditing: (editing: boolean) => void;
    onUpdateProfile: (updates: { full_name: string; avatar_url: string; }) => Promise<void>;
}

export const AccountDetails = ({ user, profile, editing, onSetEditing, onUpdateProfile }: AccountDetailsProps) => {
    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const fullName = formData.get('fullName') as string;
        const avatarUrl = formData.get('avatarUrl') as string;

        await onUpdateProfile({ full_name: fullName, avatar_url: avatarUrl });
        onSetEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'User Avatar'} />
                    <AvatarFallback>
                        <User className="h-10 w-10" />
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="text-2xl font-semibold">{profile?.full_name || 'New User'}</h2>
                    <p className="text-muted-foreground">{user.email}</p>
                </div>
            </div>

            {editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" name="fullName" defaultValue={profile?.full_name || ''} />
                    </div>
                    <div>
                        <Label>Profile Picture</Label>
                        <AvatarUploader
                            initialUrl={profile?.avatar_url}
                            onCropped={async (blob) => {
                                // Use profile.id (impersonated user) instead of user.id (admin)
                                const fileName = `${profile?.id || user.id}.png`;
                                // Upload to supabase storage bucket 'avatars'
                                await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
                                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                                const publicUrl = data.publicUrl;
                                // Set hidden input so existing form submit keeps working
                                const hidden = document.getElementById('avatarUrl') as HTMLInputElement | null;
                                if (hidden) hidden.value = publicUrl;
                            }}
                        />
                        <Input id="avatarUrl" name="avatarUrl" defaultValue={profile?.avatar_url || ''} type="hidden" />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit">Save</Button>
                        <Button variant="outline" onClick={() => onSetEditing(false)}>Cancel</Button>
                    </div>
                </form>
            ) : (
                <Button onClick={() => onSetEditing(true)}>Edit Profile</Button>
            )}
        </div>
    );
}; 
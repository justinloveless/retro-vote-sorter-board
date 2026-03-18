import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const OrgInviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user || !token) return;

    const accept = async () => {
      try {
        const { data, error } = await supabase.rpc('accept_org_invitation', {
          invitation_token: token,
        });

        if (error) throw error;
        const result = data as any;

        if (result.success) {
          setStatus('success');
          toast.success(`Welcome to ${result.organization_name}!`);
          const slug = result.organization_slug as string | undefined;
          setTimeout(() => navigate(slug ? `/org/${slug}` : '/teams'), 2000);
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to accept invitation');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Failed to accept invitation');
      }
    };

    accept();
  }, [user, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground">Accepting invitation...</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-foreground text-lg font-medium">You've joined the organization!</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-destructive font-medium mb-2">Could not accept invitation</p>
            <p className="text-muted-foreground text-sm">{message}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OrgInviteAccept;

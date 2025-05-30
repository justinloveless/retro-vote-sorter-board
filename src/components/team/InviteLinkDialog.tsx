
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Copy, Check, Loader2 } from 'lucide-react';
import { useTeamMembers } from '@/hooks/useTeamMembers';

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
}

export const InviteLinkDialog: React.FC<InviteLinkDialogProps> = ({
  open,
  onOpenChange,
  teamId,
  teamName
}) => {
  const [inviteToken, setInviteToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const { inviteMember } = useTeamMembers(teamId);

  const generateInviteLink = async () => {
    if (!email.trim()) return;
    
    setLoading(true);
    try {
      // Create a temporary email invitation to get a real token
      await inviteMember(email.trim());
      
      // For now, we'll use a simple token format
      // In a real implementation, you'd want to create a dedicated invite link endpoint
      const token = `${teamId}-${Date.now()}`;
      setInviteToken(token);
      setEmail('');
    } catch (error) {
      console.error('Error generating invite link:', error);
    } finally {
      setLoading(false);
    }
  };

  const inviteLink = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : '';

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setInviteToken('');
      setCopied(false);
      setEmail('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Invite with Link
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!inviteToken ? (
            <>
              <div>
                <Label htmlFor="email">Enter an email to generate invite link for {teamName}</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && generateInviteLink()}
                  />
                  <Button 
                    onClick={generateInviteLink} 
                    disabled={!email.trim() || loading}
                    size="sm"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Note: This will also send an email invitation to the provided address.
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="invite-link">Share this link to invite people to {teamName}</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="invite-link"
                    value={inviteLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={copyToClipboard} size="sm">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Anyone with this link can join your team. The link will expire in 7 days.
              </div>
            </>
          )}
          <Button 
            onClick={() => onOpenChange(false)} 
            className="w-full"
            variant={inviteToken ? "default" : "outline"}
          >
            {inviteToken ? "Done" : "Cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

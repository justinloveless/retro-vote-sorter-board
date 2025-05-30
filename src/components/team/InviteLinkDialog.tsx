
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Copy, Check } from 'lucide-react';

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

  useEffect(() => {
    if (open) {
      // Generate a simple invite token (in a real app, this would come from the server)
      const token = `${teamId}-${Date.now()}`;
      setInviteToken(token);
    }
  }, [open, teamId]);

  const inviteLink = `${window.location.origin}/invite/${inviteToken}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

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
          <Button 
            onClick={() => onOpenChange(false)} 
            className="w-full"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


import React, { useEffect } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Label } from '../../components/ui/label.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../components/ui/alert-dialog.tsx';
import { Link, Copy, Check, Plus, Power, PowerOff, Trash2, Clock } from 'lucide-react';
import { useInviteLinks } from '../../hooks/useInviteLinks.ts';

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
  const { inviteLinks, loading, loadInviteLinks, createInviteLink, toggleInviteLink, deleteInviteLink } = useInviteLinks(teamId);
  const [copiedLinkId, setCopiedLinkId] = React.useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadInviteLinks();
    }
  }, [open, loadInviteLinks]);

  const copyToClipboard = async (token: string, linkId: string) => {
    const inviteLink = `${window.location.origin}/invite/${token}`;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLinkId(linkId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Invite Links for {teamName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Create and manage invite links that allow anyone with the link to join your team.
            </p>
            <Button onClick={createInviteLink} disabled={loading} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Link
            </Button>
          </div>

          <div className="space-y-4">
            {inviteLinks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No invite links created yet. Create your first invite link above.
              </div>
            ) : (
              inviteLinks.map((link) => {
                const inviteUrl = `${window.location.origin}/invite/${link.token}`;
                const expired = isExpired(link.expires_at);
                
                return (
                  <div key={link.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={link.is_active && !expired ? "default" : "secondary"}>
                          {expired ? "Expired" : link.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="h-3 w-3" />
                          Expires {formatDate(link.expires_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!expired && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleInviteLink(link.id, !link.is_active)}
                          >
                            {link.is_active ? (
                              <>
                                <PowerOff className="h-3 w-3 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="h-3 w-3 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invite Link</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this invite link? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteInviteLink(link.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Link
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor={`invite-link-${link.id}`}>Invite Link</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id={`invite-link-${link.id}`}
                          value={inviteUrl}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button 
                          onClick={() => copyToClipboard(link.token, link.id)} 
                          size="sm"
                          disabled={!link.is_active || expired}
                        >
                          {copiedLinkId === link.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>Note:</strong> Only signed-in users can accept invite links. Anonymous users will be directed to sign in first.
            Invite links expire after 7 days and can be manually deactivated at any time.
          </div>

          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

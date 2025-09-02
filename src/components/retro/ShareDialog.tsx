
import React, { useState } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx';
import { Copy, Check, Lock } from 'lucide-react';
import { useToast } from '../../hooks/use-toast.ts';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  isPrivate: boolean;
  password?: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onOpenChange,
  roomId,
  isPrivate,
  password
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  console.log('password', password);

  const shareRoom = () => {
    const url = `${window.location.origin}/retro/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied!",
        description: "Share this link with your team.",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Retro Room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Room URL:</p>
            <div className="flex items-center gap-2">
              <Input
                value={`${window.location.origin}/retro/${roomId}`}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                onClick={shareRoom}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {isPrivate && password && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                <Lock className="h-4 w-4 inline mr-1" />
                This room is private. Password: <strong>{password}</strong>
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            Share this link with your team members
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';

interface NextRoundDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (ticketNumber: string) => void;
}

export const NextRoundDialog: React.FC<NextRoundDialogProps> = ({ isOpen, onOpenChange, onConfirm }) => {
  const [ticketNumber, setTicketNumber] = useState('');

  const handleStartRound = () => {
    onConfirm(ticketNumber);
    onOpenChange(false);
    setTicketNumber('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Next Round</DialogTitle>
          <DialogDescription>
            Enter the ticket number for the next round. You can leave this blank.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Ticket number (e.g., JIRA-123)"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleStartRound()}
          />
        </div>
        <DialogFooter>
          <NeotroPressableButton
            size="default"
            activeShowsPressed={false}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </NeotroPressableButton>
          <NeotroPressableButton
            size="default"
            isActive
            activeShowsPressed={false}
            onClick={handleStartRound}
          >
            Start Round
          </NeotroPressableButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

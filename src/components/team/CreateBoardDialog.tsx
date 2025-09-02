
import React, { useState } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog.tsx';
import { Input } from '../../components/ui/input.tsx';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group.tsx';
import { Label } from '../../components/ui/label.tsx';
import { Lock } from 'lucide-react';

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBoard: (title: string, isPrivate: boolean, password: string | null) => void;
}

export const CreateBoardDialog: React.FC<CreateBoardDialogProps> = ({
  open,
  onOpenChange,
  onCreateBoard
}) => {
  const [boardTitle, setBoardTitle] = useState('');
  const [boardType, setBoardType] = useState<'private' | 'public'>('private');
  const [customPassword, setCustomPassword] = useState('');
  const [suggestedPassword] = useState(() => Math.random().toString(36).substring(2, 8));

  const handleCreateBoard = async () => {
    if (!boardTitle.trim()) return;

    const password = boardType === 'private' ? (customPassword || suggestedPassword) : null;
    onCreateBoard(boardTitle.trim(), boardType === 'private', password);
    
    // Reset form
    setBoardTitle('');
    setCustomPassword('');
    setBoardType('private');
  };

  const handleClose = () => {
    onOpenChange(false);
    setBoardTitle('');
    setCustomPassword('');
    setBoardType('private');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Retro Board</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Board Title
            </label>
            <Input
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              placeholder="e.g., Sprint 23 Retrospective"
              onKeyPress={(e) => e.key === 'Enter' && boardType === 'public' && handleCreateBoard()}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board Privacy
            </label>
            <RadioGroup value={boardType} onValueChange={(value) => setBoardType(value as 'private' | 'public')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Private (password protected)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public">Public (anyone with link can join)</Label>
              </div>
            </RadioGroup>
          </div>

          {boardType === 'private' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder={`Suggested: ${suggestedPassword}`}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateBoard()}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use suggested password
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button onClick={handleCreateBoard} className="flex-1" disabled={!boardTitle.trim()}>
              Create Board
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React from 'react';
import { Button } from '@/components/ui/button';
import { SmilePlus, X } from 'lucide-react';

interface QuickReactionPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onShowMore: () => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🤔'];

export const QuickReactionPicker: React.FC<QuickReactionPickerProps> = ({ onEmojiSelect, onShowMore, onClose }) => {
  return (
    <div className="flex items-center p-1 bg-background rounded-full border shadow-sm self-center relative">
      {QUICK_REACTIONS.map((emoji) => (
        <Button
          key={emoji}
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-lg"
          onClick={() => onEmojiSelect(emoji)}
        >
          {emoji}
        </Button>
      ))}
      <div className="border-l h-5 mx-1" />
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onShowMore}>
        <SmilePlus className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}; 

import React, { useState } from 'react';
import { Plus, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { TiptapEditorWithMentions } from '@/components/shared/TiptapEditorWithMentions';

interface TeamMember {
  id: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface AddItemCardProps {
  onAddItem: (text: string, isAnonymous: boolean) => void;
  allowAnonymous?: boolean;
  teamMembers?: TeamMember[];
}

export const AddItemCard: React.FC<AddItemCardProps> = ({ onAddItem, allowAnonymous, teamMembers }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [text, setText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    // For now, convert to base64 for inline display
    // In a real implementation, you'd upload to Supabase storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddItem(text, isAnonymous);
    setText('');
    setIsAnonymous(false);
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setText('');
    setIsAnonymous(false);
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <Card
        className="bg-white/50 border-dashed border-2 hover:bg-white/70 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="p-4 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add a card</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/60 dark:bg-gray-700/60">
      <CardContent className="p-4 space-y-3">
        <TiptapEditorWithMentions
          content={text}
          onChange={setText}
          onSubmit={handleSubmit}
          placeholder="Enter your retro item... (you can paste images)"
          uploadImage={uploadImage}
          teamMembers={teamMembers}
        />
        {allowAnonymous && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
            />
            <label htmlFor="anonymous" className="text-sm text-gray-600">
              Post anonymously
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit}>
            Add card
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

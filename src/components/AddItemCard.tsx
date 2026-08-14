
import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { TiptapEditorWithMentions } from '@/components/shared/TiptapEditorWithMentions';
import {
  addItemDraftStorageKey,
  parseAddItemDraft,
  serializeAddItemDraft,
  type AddItemDraftState,
} from '@/lib/addItemDraft';

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
  /** Stable key used to persist in-progress drafts across remounts (e.g. boardId:columnId). */
  draftKey?: string;
}

const readDraft = (draftKey?: string): AddItemDraftState | null => {
  if (!draftKey || typeof window === 'undefined') return null;
  try {
    return parseAddItemDraft(sessionStorage.getItem(addItemDraftStorageKey(draftKey)));
  } catch {
    return null;
  }
};

const writeDraft = (draftKey: string | undefined, draft: AddItemDraftState) => {
  if (!draftKey || typeof window === 'undefined') return;
  try {
    const serialized = serializeAddItemDraft(draft);
    const key = addItemDraftStorageKey(draftKey);
    if (serialized == null) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, serialized);
  } catch {
    // Ignore quota / private-mode failures
  }
};

const clearDraft = (draftKey?: string) => {
  if (!draftKey || typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(addItemDraftStorageKey(draftKey));
  } catch {
    // no-op
  }
};

export const AddItemCard: React.FC<AddItemCardProps> = ({ onAddItem, allowAnonymous, teamMembers, draftKey }) => {
  const saved = readDraft(draftKey);
  const [isExpanded, setIsExpanded] = useState(() => saved?.isExpanded ?? false);
  const [text, setText] = useState(() => saved?.text ?? '');
  const [isAnonymous, setIsAnonymous] = useState(() => saved?.isAnonymous ?? false);

  useEffect(() => {
    writeDraft(draftKey, { text, isAnonymous, isExpanded });
  }, [draftKey, text, isAnonymous, isExpanded]);

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
    clearDraft(draftKey);
  };

  const handleCancel = () => {
    setText('');
    setIsAnonymous(false);
    setIsExpanded(false);
    clearDraft(draftKey);
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

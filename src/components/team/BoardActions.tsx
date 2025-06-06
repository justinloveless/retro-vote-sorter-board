
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Archive, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BoardActionsProps {
  boardId: string;
  boardTitle: string;
  isArchived: boolean;
  canManageBoard: boolean;
  onBoardUpdated: () => void;
}

export const BoardActions: React.FC<BoardActionsProps> = ({
  boardId,
  boardTitle,
  isArchived,
  canManageBoard,
  onBoardUpdated
}) => {
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const handleArchiveBoard = async () => {
    if (!canManageBoard) return;

    setIsArchiving(true);
    try {
      const { error } = await supabase
        .from('retro_boards')
        .update({
          archived: !isArchived,
          archived_at: !isArchived ? new Date().toISOString() : null,
          archived_by: !isArchived ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq('id', boardId);

      if (error) throw error;

      toast({
        title: isArchived ? "Board unarchived" : "Board archived",
        description: isArchived 
          ? "The board has been unarchived and can be edited again." 
          : "The board has been archived and is now read-only.",
      });

      onBoardUpdated();
    } catch (error) {
      console.error('Error archiving board:', error);
      toast({
        title: "Error",
        description: "Failed to archive board. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!canManageBoard || deleteConfirmText !== boardTitle) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('retro_boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      toast({
        title: "Board deleted",
        description: "The board has been permanently deleted.",
      });

      setShowDeleteDialog(false);
      setDeleteConfirmText('');
      onBoardUpdated();
    } catch (error) {
      console.error('Error deleting board:', error);
      toast({
        title: "Error",
        description: "Failed to delete board. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canManageBoard) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleArchiveBoard} disabled={isArchiving}>
          <Archive className="h-4 w-4 mr-2" />
          {isArchived ? 'Unarchive' : 'Archive'}
        </DropdownMenuItem>
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem 
              className="text-red-600 dark:text-red-400"
              onSelect={(e) => {
                e.preventDefault();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Board</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the board "{boardTitle}" 
                and all associated items, comments, and votes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Type the board name "<strong>{boardTitle}</strong>" to confirm deletion:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Enter board name"
                className="w-full"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteBoard}
                disabled={deleteConfirmText !== boardTitle || isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? 'Deleting...' : 'Delete Board'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

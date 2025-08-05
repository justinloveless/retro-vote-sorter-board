import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoreHorizontal, Edit2, Trash2, ClipboardList } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface RetroColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
  sort_order?: number;
  is_action_items?: boolean;
}

interface ColumnManagerProps {
  column: RetroColumn;
  onUpdateColumn: (columnId: string, updates: { title?: string; is_action_items?: boolean }) => void;
  onDeleteColumn: (columnId: string) => void;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({
  column,
  onUpdateColumn,
  onDeleteColumn
}) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);

  const handleSaveEdit = () => {
    if (editTitle.trim()) {
      onUpdateColumn(column.id, { title: editTitle.trim() });
      setIsEditDialogOpen(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the "${column.title}" column? This will also delete all items in this column.`)) {
      onDeleteColumn(column.id);
    }
  };

  const handleToggleActionItems = () => {
    onUpdateColumn(column.id, { is_action_items: !column.is_action_items });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Rename Column
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleActionItems}>
            <ClipboardList className="h-4 w-4 mr-2" />
            {column.is_action_items ? 'Remove as Action Items' : 'Set as Action Items'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Column title"
              onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} className="flex-1">
                Save
              </Button>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

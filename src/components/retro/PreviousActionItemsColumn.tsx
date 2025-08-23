import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Check } from 'lucide-react';

interface PreviousActionItemsColumnProps {
  items: { id: string; text: string; assigned_to?: string | null; source_item_id?: string | null }[];
  onMarkDone?: (id: string) => void;
  onAssign?: (id: string, userId: string | null) => void;
  isArchived?: boolean;
  teamMembers?: { user_id: string; profiles?: { full_name: string | null } | null }[];
  teamId?: string | null;
}
import { processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';
import { TeamActionItemsComments } from '@/components/team/TeamActionItemsComments';

export const PreviousActionItemsColumn: React.FC<PreviousActionItemsColumnProps> = ({ items, onMarkDone, onAssign, isArchived, teamMembers = [], teamId }) => {
  return (
    <div className="w-80 flex-shrink-0">
      <div className="p-4 rounded-lg border-2 bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Open Action Items</h2>
            <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="space-y-3 min-h-[200px]">
          {items.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No open action items from previous retros.</div>
          )}
          {items.map(item => (
            <Card key={item.id} className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm">
              <CardContent className="p-4">
                <div
                  className="text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none mb-3"
                  dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(item.text) }}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <span>Assigned:</span>
                    {onAssign ? (
                      <select
                        className="bg-transparent border rounded px-2 py-1 text-xs"
                        value={item.assigned_to || ''}
                        onChange={(e) => onAssign(item.id, e.target.value || null)}
                        disabled={isArchived}
                      >
                        <option value="">Nobody</option>
                        {teamMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.user_id}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{item.assigned_to ? teamMembers.find(m => m.user_id === item.assigned_to)?.profiles?.full_name || 'User' : 'Nobody'}</span>
                    )}
                  </div>
                  {onMarkDone && !isArchived && (
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onMarkDone(item.id)} title="Mark done">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {item.source_item_id && teamId && (
                  <TeamActionItemsComments sourceItemId={item.source_item_id} teamId={teamId} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};



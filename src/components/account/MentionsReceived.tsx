import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';

interface MentionItem {
  id: string;
  text: string;
  author: string;
  columnTitle: string;
  boardTitle: string;
  teamName: string;
  createdAt: string;
}

interface MentionsReceivedProps {
  userId: string;
}

export const MentionsReceived: React.FC<MentionsReceivedProps> = ({ userId }) => {
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMentions = async () => {
      setLoading(true);
      try {
        // Get teams this user belongs to
        const { data: memberships } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', userId);

        const teamIds = (memberships || []).map(m => m.team_id);
        if (teamIds.length === 0) {
          setMentions([]);
          return;
        }

        // Get boards for those teams
        const { data: boards } = await supabase
          .from('retro_boards')
          .select('id, title, team_id')
          .in('team_id', teamIds);

        const boardIds = (boards || []).map(b => b.id);
        if (boardIds.length === 0) {
          setMentions([]);
          return;
        }

        // Get team names
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);
        const teamMap = new Map((teams || []).map(t => [t.id, t.name]));
        const boardMap = new Map((boards || []).map(b => [b.id, { title: b.title, teamId: b.team_id }]));

        // Search for mentions
        const { data: items } = await supabase
          .from('retro_items')
          .select('id, text, board_id, column_id, created_at, author')
          .in('board_id', boardIds)
          .like('text', `%[[mention:${userId}:%`)
          .order('created_at', { ascending: false });

        if (!items?.length) {
          setMentions([]);
          return;
        }

        // Get column names
        const columnIds = [...new Set(items.map(i => i.column_id).filter(Boolean))] as string[];
        let columnMap = new Map<string, string>();
        if (columnIds.length > 0) {
          const { data: columns } = await supabase
            .from('retro_columns')
            .select('id, title')
            .in('id', columnIds);
          columnMap = new Map((columns || []).map(c => [c.id, c.title]));
        }

        setMentions(items.map(item => {
          const board = boardMap.get(item.board_id || '');
          return {
            id: item.id,
            text: item.text,
            author: item.author,
            columnTitle: columnMap.get(item.column_id || '') || '',
            boardTitle: board?.title || 'Unknown board',
            teamName: teamMap.get(board?.teamId || '') || 'Unknown team',
            createdAt: item.created_at || '',
          };
        }));
      } catch (e) {
        console.error('Error loading mentions:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMentions();
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Mentions
          {mentions.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({mentions.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading mentions...</p>
        ) : mentions.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No mentions found yet.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {mentions.map(item => (
              <div key={item.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div
                  className="text-sm prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(item.text) }}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {item.columnTitle && <><span>{item.columnTitle}</span><span>·</span></>}
                  <span>by {item.author}</span>
                  <span>·</span>
                  <span>{item.teamName}</span>
                  <span>·</span>
                  <span>{item.boardTitle}</span>
                  <span>·</span>
                  <span>{item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

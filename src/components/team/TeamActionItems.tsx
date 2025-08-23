import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';
import { TeamActionItemsComments } from '@/components/team/TeamActionItemsComments';
import { useTeamData } from '@/contexts/TeamDataContext';

interface TeamActionItemsProps {
  teamId: string;
}

export const TeamActionItems: React.FC<TeamActionItemsProps> = ({ teamId }) => {
  const [filterDone, setFilterDone] = useState<'open' | 'done' | 'all'>('open');
  const [assignee, setAssignee] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const teamData = useTeamData();
  
  // Use cached data
  const { data: items, loading, refetch } = teamData.getActionItems(teamId);
  const { data: teamMembers } = teamData.getMembers(teamId);

  // Set up realtime updates to refetch when data changes
  React.useEffect(() => {
    if (!teamId) return;
    
    const channel = supabase.channel(`team-action-items-tab-${teamId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'team_action_items', 
        filter: `team_id=eq.${teamId}` 
      }, () => {
        refetch();
      })
      .subscribe();
    
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [teamId, refetch]);

  const visible = useMemo(() => {
    let out = items.slice();
    if (filterDone !== 'all') {
      const want = filterDone === 'done';
      out = out.filter(i => i.done === want);
    }
    if (assignee !== 'all') {
      out = out.filter(i => (i.assigned_to || '') === assignee);
    }
    out.sort((a, b) => sort === 'newest' ? (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    return out;
  }, [items, filterDone, assignee, sort]);

  const grouped = useMemo(() => {
    const groups: { key: string; title: string; items: typeof items }[] = [] as any;
    const map = new Map<string, { title: string; items: typeof items }>();
    visible.forEach(item => {
      const key = item.source_board_id || 'other';
      const title = item.board_title || 'Other';
      if (!map.has(key)) map.set(key, { title, items: [] as any });
      map.get(key)!.items.push(item);
    });
    map.forEach((v, k) => groups.push({ key: k, title: v.title, items: v.items } as any));
    return groups;
  }, [visible]);

  const markDone = async (id: string, next: boolean) => {
    await supabase.from('team_action_items').update({ done: next, done_at: next ? new Date().toISOString() : null }).eq('id', id);
    refetch();
  };

  const assign = async (id: string, userId: string | null) => {
    await supabase.from('team_action_items').update({ assigned_to: userId }).eq('id', id);
    refetch();
  };

  return (
    <div className="space-y-4">
      <Card className=''>
        <CardContent className="flex flex-wrap gap-4 items-center py-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Status:</span>
            <select className="bg-transparent border rounded px-2 py-1 text-sm" value={filterDone} onChange={(e) => setFilterDone(e.target.value as any)}>
              <option value="open">Open</option>
              <option value="done">Done</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Assignee:</span>
            <select className="bg-transparent border rounded px-2 py-1 text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value as any)}>
              <option value="all">All</option>
              {teamMembers.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.user_id}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Sort:</span>
            <select className="bg-transparent border rounded px-2 py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading action items…</div>}
      {!loading && visible.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">No items match your filters.</div>
      )}

      {grouped.map(group => (
        <Card key={group.key} className="">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map(item => (
              <Card key={item.id} className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm">
                <CardContent className="p-6 space-y-3">
                  <div
                    className="text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none mb-3 text-sm"
                    dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(item.text) }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <span>Assigned:</span>
                      <select
                        className="bg-transparent border rounded px-2 py-1 text-xs"
                        value={item.assigned_to || ''}
                        onChange={(e) => assign(item.id, e.target.value || null)}
                      >
                        <option value="">Nobody</option>
                        {teamMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.user_id}</option>
                        ))}
                      </select>
                    </div>
                    <Button size="sm" variant="outline" className="" onClick={() => markDone(item.id, !item.done)} title={item.done ? 'Re-open' : 'Mark done'}>
                      {item.done ? 'Re-open' : 'Mark done'}
                      <Check className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
                {item.source_item_id && (
                  <div className="px-6 pb-3">
                    <TeamActionItemsComments sourceItemId={item.source_item_id} teamId={teamId} />
                  </div>
                )}
              </Card>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};



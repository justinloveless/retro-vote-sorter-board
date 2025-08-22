import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';
import { TeamActionItemsComments } from '@/components/team/TeamActionItemsComments';
import { useTeamMembers } from '@/hooks/useTeamMembers';

interface TeamActionItemsProps {
  teamId: string;
}

export const TeamActionItems: React.FC<TeamActionItemsProps> = ({ teamId }) => {
  const [items, setItems] = useState<{ id: string; text: string; assigned_to: string | null; done: boolean; created_at: string; source_board_id: string | null; source_item_id: string | null; board_title?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDone, setFilterDone] = useState<'open' | 'done' | 'all'>('open');
  const [assignee, setAssignee] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const { members: teamMembers } = useTeamMembers(teamId);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('team_action_items')
      .select('id, text, assigned_to, done, created_at, source_board_id, source_item_id')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    const base = (data || []) as { id: string; text: string; assigned_to: string | null; done: boolean; created_at: string; source_board_id: string | null; source_item_id: string | null }[];
    const boardIds = Array.from(new Set(base.map(i => i.source_board_id).filter(Boolean))) as string[];
    let titleMap: Record<string, string> = {};
    if (boardIds.length > 0) {
      const { data: boards } = await supabase
        .from('retro_boards')
        .select('id, title')
        .in('id', boardIds);
      (boards || []).forEach(b => { titleMap[b.id] = b.title; });
    }

    setItems(base.map(i => ({ ...i, board_title: i.source_board_id ? (titleMap[i.source_board_id] || 'Board') : 'Other' })));
    setLoading(false);
  };

  useEffect(() => {
    if (!teamId) return;
    load();
    const channel = supabase.channel(`team-action-items-tab-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_action_items', filter: `team_id=eq.${teamId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

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
    setItems(curr => curr.map(i => i.id === id ? { ...i, done: next } : i));
    await supabase.from('team_action_items').update({ done: next, done_at: next ? new Date().toISOString() : null }).eq('id', id);
  };

  const assign = async (id: string, userId: string | null) => {
    setItems(curr => curr.map(i => i.id === id ? { ...i, assigned_to: userId } : i));
    await supabase.from('team_action_items').update({ assigned_to: userId }).eq('id', id);
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
                    <TeamActionItemsComments sourceItemId={item.source_item_id} />
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




import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Users, Calendar, FolderOpen, Check } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client.ts';
import { Button } from '../../components/ui/button.tsx';
import { processMentionsForDisplay } from '../../components/shared/TiptapEditorWithMentions.tsx';
import { useTeamMembers } from '../../hooks/useTeamMembers.ts';

interface TeamSidebarProps {
  team: {
    id: string;
    name: string;
    created_at: string;
  };
  boardCount: number;
  memberCount?: number;
}

export const TeamSidebar: React.FC<TeamSidebarProps> = ({ team, boardCount, memberCount }) => {
  const [openActions, setOpenActions] = useState<{ id: string; text: string; assigned_to?: string | null }[]>([]);
  const { members: teamMembers } = useTeamMembers(team.id);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('team_action_items')
        .select('id, text, assigned_to')
        .eq('team_id', team.id)
        .eq('done', false)
        .order('created_at');
      if (isMounted) setOpenActions(data || []);
    };
    load();
    const channel = supabase.channel(`team-action-items-${team.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_action_items', filter: `team_id=eq.${team.id}` }, (payload) => {
        const n = payload.new as any; const o = payload.old as any;
        setOpenActions(prev => {
          if (payload.eventType === 'INSERT') {
            return n.done ? prev : [...prev, { id: n.id, text: n.text, assigned_to: n.assigned_to }];
          }
          if (payload.eventType === 'UPDATE') {
            if (n.done) return prev.filter(i => i.id !== n.id);
            return prev.map(i => i.id === n.id ? { id: n.id, text: n.text, assigned_to: n.assigned_to } : i);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter(i => i.id !== o.id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [team.id]);

  const markDone = async (id: string) => {
    const prev = openActions;
    // Optimistic remove
    setOpenActions(curr => curr.filter(i => i.id !== id));
    const { error } = await supabase
      .from('team_action_items')
      .update({ done: true, done_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      // Revert on error
      setOpenActions(prev);
    }
  };

  const assign = async (id: string, userId: string | null) => {
    // Optimistic
    setOpenActions(curr => curr.map(i => i.id === id ? { ...i, assigned_to: userId } : i));
    const { error } = await supabase
      .from('team_action_items')
      .update({ assigned_to: userId })
      .eq('id', id);
    if (error) {
      // Silently ignore; realtime will resync
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="font-medium">{boardCount}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Active Boards</div>
            </div>
          </div>
          
          {memberCount !== undefined && (
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium">{memberCount}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Team Members</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <div className="font-medium">
                {new Date(team.created_at).toLocaleDateString()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Created</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Action Items moved to main tab; keeping sidebar minimal */}
    </div>
  );
};

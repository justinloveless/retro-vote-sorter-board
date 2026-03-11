import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { format } from 'date-fns';

interface EndorsementRecord {
  id: string;
  from_user_id: string;
  endorsement_type_id: string;
  board_id: string;
  team_id: string;
  created_at: string;
  fromName: string;
  fromAvatar: string | null;
  typeName: string;
  typeIcon: string;
  boardTitle: string;
  teamName: string;
}

interface EndorsementsReceivedProps {
  userId: string;
}

export const EndorsementsReceived: React.FC<EndorsementsReceivedProps> = ({ userId }) => {
  const [endorsements, setEndorsements] = useState<EndorsementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEndorsements = async () => {
      setLoading(true);
      try {
        // Fetch endorsements received by this user
        const { data: rawEndorsements, error } = await supabase
          .from('endorsements')
          .select('id, from_user_id, endorsement_type_id, board_id, team_id, created_at')
          .eq('to_user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!rawEndorsements?.length) {
          setEndorsements([]);
          setLoading(false);
          return;
        }

        // Gather unique IDs
        const fromUserIds = [...new Set(rawEndorsements.map(e => e.from_user_id))];
        const typeIds = [...new Set(rawEndorsements.map(e => e.endorsement_type_id))];
        const boardIds = [...new Set(rawEndorsements.map(e => e.board_id))];
        const teamIds = [...new Set(rawEndorsements.map(e => e.team_id))];

        // Fetch related data in parallel
        const [profilesRes, typesRes, boardsRes, teamsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', fromUserIds),
          supabase.from('endorsement_types').select('id, name, icon_url').in('id', typeIds),
          supabase.from('retro_boards').select('id, title').in('id', boardIds),
          supabase.from('teams').select('id, name').in('id', teamIds),
        ]);

        const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
        const typeMap = new Map((typesRes.data || []).map(t => [t.id, t]));
        const boardMap = new Map((boardsRes.data || []).map(b => [b.id, b]));
        const teamMap = new Map((teamsRes.data || []).map(t => [t.id, t]));

        const records: EndorsementRecord[] = rawEndorsements.map(e => {
          const fromProfile = profileMap.get(e.from_user_id);
          const eType = typeMap.get(e.endorsement_type_id);
          const board = boardMap.get(e.board_id);
          const team = teamMap.get(e.team_id);
          return {
            ...e,
            fromName: fromProfile?.full_name || 'Unknown',
            fromAvatar: fromProfile?.avatar_url || null,
            typeName: eType?.name || 'Unknown',
            typeIcon: eType?.icon_url || '🏆',
            boardTitle: board?.title || 'Unknown board',
            teamName: team?.name || 'Unknown team',
          };
        });

        setEndorsements(records);
      } catch (e) {
        console.error('Error loading endorsements received:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchEndorsements();
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Endorsements Received
          {endorsements.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({endorsements.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading endorsements...</p>
        ) : endorsements.length === 0 ? (
          <div className="text-center py-6">
            <Award className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No endorsements received yet.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {endorsements.map(e => (
              <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <UserAvatar avatarUrl={e.fromAvatar} name={e.fromName} className="h-8 w-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium">{e.fromName}</span>
                    <span className="text-xs text-muted-foreground">endorsed you as</span>
                    <span className="text-sm font-medium">{e.typeIcon} {e.typeName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{e.teamName}</span>
                    <span>·</span>
                    <span>{e.boardTitle}</span>
                    <span>·</span>
                    <span>{format(new Date(e.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

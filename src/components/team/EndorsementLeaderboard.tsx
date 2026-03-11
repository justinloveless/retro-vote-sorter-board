import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Award, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useEndorsementTypes, EndorsementType } from '@/hooks/useEndorsementTypes';

interface EndorsementLeaderboardProps {
  teamId: string;
}

interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  counts: Record<string, number>;
  total: number;
}

export const EndorsementLeaderboard: React.FC<EndorsementLeaderboardProps> = ({ teamId }) => {
  const { types, loading: typesLoading } = useEndorsementTypes(teamId);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all endorsements for this team
        const { data: endorsements, error: eErr } = await supabase
          .from('endorsements')
          .select('*')
          .eq('team_id', teamId);
        if (eErr) throw eErr;

        // Fetch team members with profiles
        const { data: members, error: mErr } = await supabase
          .from('team_members')
          .select('user_id, profiles(full_name, avatar_url)')
          .eq('team_id', teamId);
        if (mErr) throw mErr;

        // Build leaderboard
        const memberMap = new Map<string, { fullName: string; avatarUrl: string | null }>();
        (members || []).forEach((m: any) => {
          memberMap.set(m.user_id, {
            fullName: m.profiles?.full_name || 'Unknown',
            avatarUrl: m.profiles?.avatar_url || null,
          });
        });

        const countMap = new Map<string, Record<string, number>>();
        ((endorsements as any[]) || []).forEach(e => {
          if (!countMap.has(e.to_user_id)) countMap.set(e.to_user_id, {});
          const userCounts = countMap.get(e.to_user_id)!;
          userCounts[e.endorsement_type_id] = (userCounts[e.endorsement_type_id] || 0) + 1;
        });

        const leaderboard: LeaderboardEntry[] = [];
        memberMap.forEach((info, userId) => {
          const counts = countMap.get(userId) || {};
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          leaderboard.push({ userId, fullName: info.fullName, avatarUrl: info.avatarUrl, counts, total });
        });

        leaderboard.sort((a, b) => b.total - a.total);
        setEntries(leaderboard);
      } catch (e) {
        console.error('Error loading endorsement leaderboard:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId]);

  if (loading || typesLoading) {
    return <div className="text-muted-foreground text-sm">Loading endorsements...</div>;
  }

  if (types.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No endorsement types configured yet.</p>
          <p className="text-xs mt-1">Set them up in Team Settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Endorsement Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Header row */}
        <div className="flex items-center gap-3 pb-2 border-b text-xs font-medium text-muted-foreground mb-2">
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Member</div>
          {types.map(t => (
            <div key={t.id} className="w-16 text-center" title={t.name}>
              {t.icon_url || '🏆'}
            </div>
          ))}
          <div className="w-14 text-center">Total</div>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No endorsements given yet.</p>
        ) : (
          entries.map((entry, idx) => (
            <div key={entry.userId} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className="w-8 text-center text-sm font-bold text-muted-foreground">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <UserAvatar avatarUrl={entry.avatarUrl} fullName={entry.fullName} className="h-6 w-6" />
                <span className="text-sm font-medium truncate">{entry.fullName}</span>
              </div>
              {types.map(t => (
                <div key={t.id} className="w-16 text-center">
                  <Badge variant={entry.counts[t.id] ? 'default' : 'secondary'} className="text-xs">
                    {entry.counts[t.id] || 0}
                  </Badge>
                </div>
              ))}
              <div className="w-14 text-center">
                <Badge variant="outline" className="text-xs font-bold">
                  {entry.total}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

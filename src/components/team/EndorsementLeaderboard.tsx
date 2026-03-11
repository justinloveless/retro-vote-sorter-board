import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Award, Trophy, Crown, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useEndorsementTypes } from '@/hooks/useEndorsementTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface EndorsementLeaderboardProps {
  teamId: string;
}

interface RawEndorsement {
  id: string;
  board_id: string;
  endorsement_type_id: string;
  to_user_id: string;
  created_at: string;
}

interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  counts: Record<string, number>;
  total: number;
}

interface BoardOption {
  id: string;
  title: string;
}

export const EndorsementLeaderboard: React.FC<EndorsementLeaderboardProps> = ({ teamId }) => {
  const { types, loading: typesLoading } = useEndorsementTypes(teamId);
  const [allEndorsements, setAllEndorsements] = useState<RawEndorsement[]>([]);
  const [memberMap, setMemberMap] = useState<Map<string, { fullName: string; avatarUrl: string | null }>>(new Map());
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBoard, setSelectedBoard] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [endorsementsRes, membersRes, boardsRes] = await Promise.all([
          supabase.from('endorsements').select('id, board_id, endorsement_type_id, to_user_id, created_at').eq('team_id', teamId),
          supabase.from('team_members').select('user_id, profiles(full_name, avatar_url)').eq('team_id', teamId),
          supabase.from('retro_boards').select('id, title').eq('team_id', teamId).order('created_at', { ascending: false }),
        ]);

        if (endorsementsRes.error) throw endorsementsRes.error;
        if (membersRes.error) throw membersRes.error;

        setAllEndorsements((endorsementsRes.data as any[]) || []);

        const map = new Map<string, { fullName: string; avatarUrl: string | null }>();
        ((membersRes.data as any[]) || []).forEach((m: any) => {
          map.set(m.user_id, {
            fullName: m.profiles?.full_name || 'Unknown',
            avatarUrl: m.profiles?.avatar_url || null,
          });
        });
        setMemberMap(map);

        setBoards((boardsRes.data as any[]) || []);
      } catch (e) {
        console.error('Error loading endorsement leaderboard:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId]);

  const entries = useMemo(() => {
    let filtered = allEndorsements;

    if (selectedBoard !== 'all') {
      filtered = filtered.filter(e => e.board_id === selectedBoard);
    }
    if (selectedType !== 'all') {
      filtered = filtered.filter(e => e.endorsement_type_id === selectedType);
    }
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(e => new Date(e.created_at) >= from);
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => new Date(e.created_at) <= to);
    }

    const countMap = new Map<string, Record<string, number>>();
    filtered.forEach(e => {
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
    return leaderboard;
  }, [allEndorsements, memberMap, selectedBoard, selectedType, dateRange]);

  const top3 = entries.slice(0, 3).filter(e => e.total > 0);
  const rest = entries.slice(3);

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

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d')}`
      : `From ${format(dateRange.from, 'MMM d')}`
    : 'All time';

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
    ? [top3[1], top3[0]]
    : top3;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Endorsement Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedBoard} onValueChange={setSelectedBoard}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="All boards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All boards</SelectItem>
              {boards.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.icon_url || '🏆'} {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 space-y-2">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                />
                {dateRange && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateRange(undefined)}>
                    Clear dates
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {entries.every(e => e.total === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">No endorsements found.</p>
        ) : (
          <>
            {/* Podium for top 3 */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-2 sm:gap-4 pt-4 pb-2">
                {podiumOrder.map((entry, i) => {
                  // Determine actual rank
                  const rank = top3.indexOf(entry) + 1;
                  const isFirst = rank === 1;
                  const isSecond = rank === 2;
                  const pedestalHeight = isFirst ? 'h-24' : isSecond ? 'h-16' : 'h-12';
                  const pedestalColor = isFirst
                    ? 'bg-gradient-to-t from-amber-500 to-amber-400'
                    : isSecond
                    ? 'bg-gradient-to-t from-slate-400 to-slate-300'
                    : 'bg-gradient-to-t from-orange-600 to-orange-500';
                  const textColor = isFirst ? 'text-amber-500' : isSecond ? 'text-slate-400' : 'text-orange-600';
                  const size = isFirst ? 'h-16 w-16' : 'h-12 w-12';

                  return (
                    <div key={entry.userId} className="flex flex-col items-center" style={{ minWidth: 80 }}>
                      {/* Crown for 1st */}
                      {isFirst && <Crown className="h-6 w-6 text-amber-500 mb-1" />}
                      {/* Avatar */}
                      <UserAvatar avatarUrl={entry.avatarUrl} name={entry.fullName} className={`${size} border-2 border-background shadow-lg`} />
                      <span className="text-xs font-medium mt-1 truncate max-w-[80px] text-center">{entry.fullName}</span>
                      <span className={`text-lg font-bold ${textColor}`}>{entry.total}</span>
                      {/* Pedestal */}
                      <div className={`w-20 sm:w-24 ${pedestalHeight} ${pedestalColor} rounded-t-lg flex items-center justify-center shadow-md`}>
                        <span className="text-2xl font-bold text-white/90">{rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Remaining entries */}
            {rest.length > 0 && (
              <div>
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
                {rest.map((entry, idx) => (
                  <div key={entry.userId} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="w-8 text-center text-sm font-bold text-muted-foreground">
                      {idx + 4}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <UserAvatar avatarUrl={entry.avatarUrl} name={entry.fullName} className="h-6 w-6" />
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
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

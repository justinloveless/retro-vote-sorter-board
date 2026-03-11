import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Award, Trophy, Crown, Filter, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useEndorsementTypes } from '@/hooks/useEndorsementTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';

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

  // Mentions dialog
  const [mentionsDialogOpen, setMentionsDialogOpen] = useState(false);
  const [mentionsUser, setMentionsUser] = useState<{ userId: string; fullName: string } | null>(null);
  const [mentionItems, setMentionItems] = useState<Array<{ id: string; text: string; boardTitle: string; columnTitle: string; createdAt: string; author: string }>>([]);
  const [mentionsLoading, setMentionsLoading] = useState(false);

  const openMentionsDialog = useCallback(async (userId: string, fullName: string) => {
    setMentionsUser({ userId, fullName });
    setMentionsDialogOpen(true);
    setMentionsLoading(true);
    try {
      // Get all board IDs for this team
      const { data: teamBoards } = await supabase
        .from('retro_boards')
        .select('id')
        .eq('team_id', teamId);
      const boardIds = (teamBoards || []).map(b => b.id);
      if (boardIds.length === 0) {
        setMentionItems([]);
        return;
      }

      // Search retro items that mention this user
      const { data: items } = await supabase
        .from('retro_items')
        .select('id, text, board_id, column_id, created_at, author')
        .in('board_id', boardIds)
        .like('text', `%[[mention:${userId}:%`)
        .order('created_at', { ascending: false });

      if (!items?.length) {
        setMentionItems([]);
        return;
      }

      // Fetch column names for the items
      const columnIds = [...new Set(items.map(i => i.column_id).filter(Boolean))] as string[];
      let columnMap = new Map<string, string>();
      if (columnIds.length > 0) {
        const { data: columns } = await supabase
          .from('retro_columns')
          .select('id, title')
          .in('id', columnIds);
        columnMap = new Map((columns || []).map(c => [c.id, c.title]));
      }

      // Map board titles
      const boardMap = new Map(boards.map(b => [b.id, b.title]));
      setMentionItems(items.map(item => ({
        id: item.id,
        text: item.text,
        boardTitle: boardMap.get(item.board_id || '') || 'Unknown board',
        columnTitle: columnMap.get(item.column_id || '') || '',
        createdAt: item.created_at || '',
        author: item.author,
      })));
    } catch (e) {
      console.error('Error fetching mentions:', e);
      setMentionItems([]);
    } finally {
      setMentionsLoading(false);
    }
  }, [teamId, boards]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [endorsementsRes, membersRes, boardsRes] = await Promise.all([
          supabase.from('endorsements').select('id, board_id, endorsement_type_id, to_user_id, created_at').eq('team_id', teamId),
          supabase.from('team_members').select('user_id, profiles(full_name, avatar_url)').eq('team_id', teamId),
          supabase.from('retro_boards').select('id, title').eq('team_id', teamId).or('deleted.is.null,deleted.eq.false').order('created_at', { ascending: false }),
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
                {podiumOrder.map((entry) => {
                  // Determine tie-aware rank based on scores
                  const idx = top3.indexOf(entry);
                  let tieRank: number;
                  if (idx === 0) {
                    tieRank = 1;
                  } else if (idx === 1) {
                    tieRank = entry.total === top3[0].total ? 1 : 2;
                  } else {
                    tieRank = entry.total === top3[0].total ? 1 : entry.total === top3[1].total ? (top3[1].total === top3[0].total ? 1 : 2) : 3;
                  }

                  const isGold = tieRank === 1;
                  const isSilver = tieRank === 2;
                  const pedestalHeight = isGold ? 'h-24' : isSilver ? 'h-16' : 'h-12';
                  const pedestalColor = isGold
                    ? 'bg-gradient-to-t from-amber-500 to-amber-400'
                    : isSilver
                    ? 'bg-gradient-to-t from-slate-400 to-slate-300'
                    : 'bg-gradient-to-t from-orange-600 to-orange-500';
                  const textColor = isGold ? 'text-amber-500' : isSilver ? 'text-slate-400' : 'text-orange-600';
                  const size = isGold ? 'h-16 w-16' : 'h-12 w-12';

                  return (
                    <div key={entry.userId} className="flex flex-col items-center" style={{ minWidth: 80 }}>
                      {/* Crown for gold */}
                      {isGold && <Crown className="h-6 w-6 text-amber-500 mb-1" />}
                      {/* Avatar with mentions button overlay */}
                      <div className="relative">
                        <UserAvatar avatarUrl={entry.avatarUrl} name={entry.fullName} className={`${size} border-2 border-background shadow-lg`} />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute -bottom-1 -right-1 h-6 w-6 p-0 rounded-full shadow-md"
                          onClick={() => openMentionsDialog(entry.userId, entry.fullName)}
                          title={`See what people said about ${entry.fullName}`}
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-xs font-medium mt-1 truncate max-w-[80px] text-center">{entry.fullName}</span>
                      <span className={`text-lg font-bold ${textColor}`}>{entry.total}</span>
                      {/* Endorsement type breakdown */}
                      <div className="flex flex-wrap justify-center gap-1 mt-0.5">
                        {types.map(t => {
                          const count = entry.counts[t.id] || 0;
                          if (count === 0) return null;
                          return (
                            <span key={t.id} className="text-xs" title={`${t.name}: ${count}`}>
                              {t.icon_url || '🏆'}{count}
                            </span>
                          );
                        })}
                      </div>
                      {/* Pedestal */}
                      <div className={`w-20 sm:w-24 ${pedestalHeight} ${pedestalColor} rounded-t-lg flex items-center justify-center shadow-md`}>
                        <span className="text-2xl font-bold text-white/90">{tieRank}</span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => openMentionsDialog(entry.userId, entry.fullName)}
                        title={`See what people said about ${entry.fullName}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
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

        {/* Mentions dialog */}
        <Dialog open={mentionsDialogOpen} onOpenChange={setMentionsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                What people said about {mentionsUser?.fullName}
              </DialogTitle>
            </DialogHeader>
            {mentionsLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : mentionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No mentions found for this person.</p>
            ) : (
              <div className="space-y-3">
                {mentionItems.map(item => (
                  <div key={item.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div
                      className="text-sm prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(item.text) }}
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>by {item.author}</span>
                      <span>·</span>
                      <span>{item.boardTitle}</span>
                      <span>·</span>
                      <span>{item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

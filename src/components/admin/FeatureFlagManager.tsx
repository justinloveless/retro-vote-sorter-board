import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface FeatureFlag {
  flag_name: string;
  description: string | null;
  is_enabled: boolean;
}

interface UserOverride {
  id: string;
  flag_name: string;
  user_id: string;
  state: 'enabled' | 'disabled';
}

interface TeamOverride {
  id: string;
  flag_name: string;
  team_id: string;
  state: 'enabled' | 'disabled';
}

interface UserSearchResult {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface TeamSearchResult {
  id: string;
  name: string;
}

type FilterPreset = 'all' | 'overridden' | 'enabled' | 'no-overrides';
type SortBy = 'name' | 'overrides';

const FILTER_PRESETS: { value: FilterPreset; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overridden', label: 'Overridden flags' },
  { value: 'enabled', label: 'Globally enabled' },
  { value: 'no-overrides', label: 'No overrides' },
];

export const FeatureFlagManager: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserOverride[]>([]);
  const [teamOverrides, setTeamOverrides] = useState<TeamOverride[]>([]);
  const [selectedFlagName, setSelectedFlagName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [pendingUserQuery, setPendingUserQuery] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserLabel, setPendingUserLabel] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [pendingUserState, setPendingUserState] = useState<'enabled' | 'disabled'>('enabled');
  const [pendingTeamQuery, setPendingTeamQuery] = useState('');
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [pendingTeamLabel, setPendingTeamLabel] = useState('');
  const [teamSearchResults, setTeamSearchResults] = useState<TeamSearchResult[]>([]);
  const [searchingTeams, setSearchingTeams] = useState(false);
  const [pendingTeamState, setPendingTeamState] = useState<'enabled' | 'disabled'>('enabled');
  const [userLabelById, setUserLabelById] = useState<Record<string, string>>({});
  const [teamNameById, setTeamNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingOverrides, setUpdatingOverrides] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const resolveOverrideLabels = async (nextUserOverrides: UserOverride[], nextTeamOverrides: TeamOverride[]) => {
    const uniqueUserIds = Array.from(new Set(nextUserOverrides.map((item) => item.user_id).filter(Boolean)));
    const uniqueTeamIds = Array.from(new Set(nextTeamOverrides.map((item) => item.team_id).filter(Boolean)));

    if (uniqueUserIds.length > 0) {
      const labelMap: Record<string, string> = {};
      const lookups = await Promise.allSettled(
        uniqueUserIds.map(async (userId) => {
          const { data, error } = await supabase.functions.invoke('admin-search-users', { body: { q: userId } });
          if (error) throw error;
          const match = ((data as { results?: UserSearchResult[] } | null)?.results || []).find((row) => row.id === userId);
          if (!match) return { userId, label: '(unknown user)' };
          const label = [match.full_name, match.email].filter(Boolean).join(' - ') || '(unknown user)';
          return { userId, label };
        })
      );
      for (const lookup of lookups) {
        if (lookup.status === 'fulfilled') {
          labelMap[lookup.value.userId] = lookup.value.label;
        }
      }
      setUserLabelById(labelMap);
    } else {
      setUserLabelById({});
    }

    if (uniqueTeamIds.length > 0) {
      const { data } = await supabase
        .from('teams')
        .select('id,name')
        .in('id', uniqueTeamIds);
      const nameMap: Record<string, string> = {};
      for (const team of data || []) {
        nameMap[team.id] = team.name;
      }
      setTeamNameById(nameMap);
    } else {
      setTeamNameById({});
    }
  };

  const refreshOverrides = async () => {
    const [userRes, teamRes] = await Promise.all([
      supabase.from('feature_flag_user_overrides').select('id, flag_name, user_id, state'),
      supabase.from('feature_flag_team_overrides').select('id, flag_name, team_id, state'),
    ]);

    if (userRes.error) {
      console.error('Error fetching user overrides:', userRes.error);
      toast({ title: 'Error fetching user overrides', variant: 'destructive' });
    }
    if (teamRes.error) {
      console.error('Error fetching team overrides:', teamRes.error);
      toast({ title: 'Error fetching team overrides', variant: 'destructive' });
    }

    const nextUserOverrides = (userRes.data || []) as UserOverride[];
    const nextTeamOverrides = (teamRes.data || []) as TeamOverride[];
    setUserOverrides(nextUserOverrides);
    setTeamOverrides(nextTeamOverrides);
    await resolveOverrideLabels(nextUserOverrides, nextTeamOverrides);
  };

  const loadData = async () => {
    setLoading(true);
    const { data: flagsData, error: flagsError } = await supabase.from('feature_flags').select('*');
    if (flagsError) {
      console.error('Error fetching feature flags:', flagsError);
      toast({ title: 'Error fetching flags', variant: 'destructive' });
    } else {
      setFlags(flagsData || []);
    }
    await refreshOverrides();

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const runSearch = async () => {
      const query = pendingUserQuery.trim();
      if (!query) {
        setUserSearchResults([]);
        setSearchingUsers(false);
        return;
      }
      setSearchingUsers(true);
      const { data, error } = await supabase.functions.invoke('admin-search-users', { body: { q: query } });
      if (error) {
        toast({ title: 'User search failed', description: error.message, variant: 'destructive' });
        setUserSearchResults([]);
      } else {
        const results = ((data as { results?: UserSearchResult[] } | null)?.results || []).slice(0, 8);
        setUserSearchResults(results);
      }
      setSearchingUsers(false);
    };
    const timer = window.setTimeout(runSearch, 300);
    return () => window.clearTimeout(timer);
  }, [pendingUserQuery, toast]);

  useEffect(() => {
    const runSearch = async () => {
      const query = pendingTeamQuery.trim();
      if (!query) {
        setTeamSearchResults([]);
        setSearchingTeams(false);
        return;
      }
      setSearchingTeams(true);
      const { data, error } = await supabase.functions.invoke('admin-team-members', {
        body: { action: 'list_teams', query },
      });
      if (error) {
        toast({ title: 'Team search failed', description: error.message, variant: 'destructive' });
        setTeamSearchResults([]);
      } else {
        const teams = ((data as { teams?: TeamSearchResult[] } | null)?.teams || []).slice(0, 8);
        setTeamSearchResults(teams);
      }
      setSearchingTeams(false);
    };
    const timer = window.setTimeout(runSearch, 300);
    return () => window.clearTimeout(timer);
  }, [pendingTeamQuery, toast]);

  const overrideCounts = useMemo(() => {
    const counts: Record<string, { user: number; team: number }> = {};
    for (const flag of flags) {
      counts[flag.flag_name] = { user: 0, team: 0 };
    }
    for (const override of userOverrides) {
      counts[override.flag_name] = counts[override.flag_name] || { user: 0, team: 0 };
      counts[override.flag_name].user += 1;
    }
    for (const override of teamOverrides) {
      counts[override.flag_name] = counts[override.flag_name] || { user: 0, team: 0 };
      counts[override.flag_name].team += 1;
    }
    return counts;
  }, [flags, userOverrides, teamOverrides]);

  const filteredFlags = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const next = flags
      .filter((flag) => {
        const counts = overrideCounts[flag.flag_name] || { user: 0, team: 0 };
        const totalOverrides = counts.user + counts.team;
        const matchesSearch =
          !normalizedSearch ||
          flag.flag_name.toLowerCase().includes(normalizedSearch) ||
          (flag.description || '').toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) return false;
        if (filterPreset === 'overridden') return totalOverrides > 0;
        if (filterPreset === 'enabled') return flag.is_enabled;
        if (filterPreset === 'no-overrides') return totalOverrides === 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'overrides') {
          const aCount = (overrideCounts[a.flag_name]?.user || 0) + (overrideCounts[a.flag_name]?.team || 0);
          const bCount = (overrideCounts[b.flag_name]?.user || 0) + (overrideCounts[b.flag_name]?.team || 0);
          return bCount - aCount || a.flag_name.localeCompare(b.flag_name);
        }
        return a.flag_name.localeCompare(b.flag_name);
      });
    return next;
  }, [filterPreset, flags, overrideCounts, searchTerm, sortBy]);

  useEffect(() => {
    if (!selectedFlagName && filteredFlags.length > 0) {
      setSelectedFlagName(filteredFlags[0].flag_name);
      return;
    }
    if (selectedFlagName && !filteredFlags.some((flag) => flag.flag_name === selectedFlagName)) {
      setSelectedFlagName(filteredFlags[0]?.flag_name || null);
    }
  }, [filteredFlags, selectedFlagName]);

  const selectedFlag = useMemo(
    () => flags.find((flag) => flag.flag_name === selectedFlagName) || null,
    [flags, selectedFlagName]
  );

  const selectedUserOverrides = useMemo(
    () => userOverrides.filter((item) => item.flag_name === selectedFlagName),
    [selectedFlagName, userOverrides]
  );

  const selectedTeamOverrides = useMemo(
    () => teamOverrides.filter((item) => item.flag_name === selectedFlagName),
    [selectedFlagName, teamOverrides]
  );

  const handleToggle = async (flagName: string, isEnabled: boolean) => {
    setFlags((currentFlags) =>
      currentFlags.map((flag) => (flag.flag_name === flagName ? { ...flag, is_enabled: isEnabled } : flag))
    );

    const { error } = await supabase
      .from('feature_flags')
      .update({ is_enabled: isEnabled })
      .eq('flag_name', flagName);

    if (error) {
      setFlags((currentFlags) =>
        currentFlags.map((flag) => (flag.flag_name === flagName ? { ...flag, is_enabled: !isEnabled } : flag))
      );
      toast({ title: 'Error updating flag', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Feature flag updated' });
  };

  const setUserOverride = async () => {
    if (!selectedFlagName) return;
    const userId = pendingUserId?.trim() || '';
    if (!userId) {
      toast({ title: 'Select a user', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('feature_flag_user_overrides')
      .upsert({ flag_name: selectedFlagName, user_id: userId, state: pendingUserState }, { onConflict: 'user_id,flag_name' });
    if (error) {
      toast({ title: 'Failed to set user override', description: error.message, variant: 'destructive' });
      return;
    }
    setPendingUserId(null);
    setPendingUserLabel('');
    setPendingUserQuery('');
    setUserSearchResults([]);
    setUpdatingOverrides(true);
    await refreshOverrides();
    setUpdatingOverrides(false);
    toast({ title: 'User override saved' });
  };

  const setTeamOverride = async () => {
    if (!selectedFlagName) return;
    const teamId = pendingTeamId?.trim() || '';
    if (!teamId) {
      toast({ title: 'Select a team', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('feature_flag_team_overrides')
      .upsert({ flag_name: selectedFlagName, team_id: teamId, state: pendingTeamState }, { onConflict: 'team_id,flag_name' });
    if (error) {
      toast({ title: 'Failed to set team override', description: error.message, variant: 'destructive' });
      return;
    }
    setPendingTeamId(null);
    setPendingTeamLabel('');
    setPendingTeamQuery('');
    setTeamSearchResults([]);
    setUpdatingOverrides(true);
    await refreshOverrides();
    setUpdatingOverrides(false);
    toast({ title: 'Team override saved' });
  };

  const clearUserOverride = async (id: string) => {
    const { error } = await supabase.from('feature_flag_user_overrides').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to clear user override', description: error.message, variant: 'destructive' });
      return;
    }
    setUpdatingOverrides(true);
    await refreshOverrides();
    setUpdatingOverrides(false);
  };

  const clearTeamOverride = async (id: string) => {
    const { error } = await supabase.from('feature_flag_team_overrides').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to clear team override', description: error.message, variant: 'destructive' });
      return;
    }
    setUpdatingOverrides(true);
    await refreshOverrides();
    setUpdatingOverrides(false);
  };

  if (loading) return <div>Loading feature flags...</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr,220px,220px]">
        <Input
          placeholder="Search by flag name or description"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="h-10 rounded-md border px-3 text-sm bg-background"
          value={filterPreset}
          onChange={(e) => setFilterPreset(e.target.value as FilterPreset)}
        >
          {FILTER_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border px-3 text-sm bg-background"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="name">Sort: Name</option>
          <option value="overrides">Sort: Override count</option>
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flags</CardTitle>
            <CardDescription>{filteredFlags.length} matching flags</CardDescription>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-2">
                {filteredFlags.map((flag) => {
                  const counts = overrideCounts[flag.flag_name] || { user: 0, team: 0 };
                  const isSelected = selectedFlagName === flag.flag_name;
                  return (
                    <div
                      key={flag.flag_name}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedFlagName(flag.flag_name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedFlagName(flag.flag_name);
                        }
                      }}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected ? 'border-primary bg-muted/50' : 'border-border'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="break-words font-medium">{flag.flag_name}</div>
                          {flag.description && (
                            <p className="break-words text-xs text-muted-foreground">{flag.description}</p>
                          )}
                        </div>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <Switch
                            checked={flag.is_enabled}
                            onCheckedChange={(checked) => handleToggle(flag.flag_name, checked)}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>User overrides: {counts.user}</span>
                        <span>Team overrides: {counts.team}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flag</TableHead>
                    <TableHead>Global</TableHead>
                    <TableHead>User overrides</TableHead>
                    <TableHead>Team overrides</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlags.map((flag) => {
                    const counts = overrideCounts[flag.flag_name] || { user: 0, team: 0 };
                    const isSelected = selectedFlagName === flag.flag_name;
                    return (
                      <TableRow
                        key={flag.flag_name}
                        className={isSelected ? 'bg-muted/50' : undefined}
                        onClick={() => setSelectedFlagName(flag.flag_name)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{flag.flag_name}</div>
                            {flag.description && (
                              <p className="text-xs text-muted-foreground">{flag.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={flag.is_enabled}
                            onCheckedChange={(checked) => handleToggle(flag.flag_name, checked)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>{counts.user}</TableCell>
                        <TableCell>{counts.team}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flag Detail</CardTitle>
            <CardDescription>
              {selectedFlag ? selectedFlag.flag_name : 'Select a flag from the table'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFlag ? (
              <p className="text-sm text-muted-foreground">No flag selected.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Overrides precedence: user -&gt; team -&gt; tier -&gt; global.
                </p>

                <div className="space-y-2">
                  <Label className="text-xs">Set user override</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Search user by name, email, or UUID"
                      value={pendingUserQuery}
                      onChange={(e) => {
                        setPendingUserQuery(e.target.value);
                        setPendingUserId(null);
                        setPendingUserLabel('');
                      }}
                    />
                    {searchingUsers && <p className="text-xs text-muted-foreground">Searching users...</p>}
                    {pendingUserQuery.trim() && userSearchResults.length > 0 && (
                      <div className="max-h-36 space-y-1 overflow-auto rounded border p-2">
                        {userSearchResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted"
                            onClick={() => {
                              setPendingUserId(result.id);
                              setPendingUserLabel(`${result.full_name || '(no name)'}${result.email ? ` (${result.email})` : ''}`);
                              setPendingUserQuery(result.full_name || result.email || result.id);
                              setUserSearchResults([]);
                            }}
                          >
                            <div className="font-medium">{result.full_name || '(no name)'}</div>
                            <div className="text-muted-foreground">{result.email || 'no email'}</div>
                            <div className="font-mono text-muted-foreground">{result.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {pendingUserId && (
                      <div className="rounded border px-2 py-1 text-xs">
                        Selected: <span className="font-medium">{pendingUserLabel}</span>
                        <span className="font-mono text-muted-foreground"> - {pendingUserId}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[auto,auto]">
                    <select
                      className="h-10 rounded-md border px-3 text-sm bg-background"
                      value={pendingUserState}
                      onChange={(e) => setPendingUserState(e.target.value as 'enabled' | 'disabled')}
                    >
                      <option value="enabled">enabled</option>
                      <option value="disabled">disabled</option>
                    </select>
                    <Button size="sm" type="button" onClick={setUserOverride} disabled={updatingOverrides}>
                      Save
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Set team override</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Search team by name or UUID"
                      value={pendingTeamQuery}
                      onChange={(e) => {
                        setPendingTeamQuery(e.target.value);
                        setPendingTeamId(null);
                        setPendingTeamLabel('');
                      }}
                    />
                    {searchingTeams && <p className="text-xs text-muted-foreground">Searching teams...</p>}
                    {pendingTeamQuery.trim() && teamSearchResults.length > 0 && (
                      <div className="max-h-36 space-y-1 overflow-auto rounded border p-2">
                        {teamSearchResults.map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted"
                            onClick={() => {
                              setPendingTeamId(team.id);
                              setPendingTeamLabel(team.name);
                              setPendingTeamQuery(team.name);
                              setTeamSearchResults([]);
                            }}
                          >
                            <div className="font-medium">{team.name}</div>
                            <div className="font-mono text-muted-foreground">{team.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {pendingTeamId && (
                      <div className="rounded border px-2 py-1 text-xs">
                        Selected: <span className="font-medium">{pendingTeamLabel}</span>
                        <span className="font-mono text-muted-foreground"> - {pendingTeamId}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[auto,auto]">
                    <select
                      className="h-10 rounded-md border px-3 text-sm bg-background"
                      value={pendingTeamState}
                      onChange={(e) => setPendingTeamState(e.target.value as 'enabled' | 'disabled')}
                    >
                      <option value="enabled">enabled</option>
                      <option value="disabled">disabled</option>
                    </select>
                    <Button size="sm" type="button" onClick={setTeamOverride} disabled={updatingOverrides}>
                      Save
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">User overrides</Label>
                  {selectedUserOverrides.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No user overrides.</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedUserOverrides.map((override) => (
                        <div
                          key={override.id}
                          className="flex flex-col gap-2 rounded border px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0 break-words">
                            <span className="font-medium">
                              {userLabelById[override.user_id] || '(unknown user)'}
                            </span>
                            <span className="font-mono text-muted-foreground"> - {override.user_id}</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={override.state === 'enabled' ? 'default' : 'secondary'}>
                              {override.state}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => clearUserOverride(override.id)} disabled={updatingOverrides}>
                              Clear
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Team overrides</Label>
                  {selectedTeamOverrides.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No team overrides.</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedTeamOverrides.map((override) => (
                        <div
                          key={override.id}
                          className="flex flex-col gap-2 rounded border px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0 break-words">
                            <span className="font-medium">
                              {teamNameById[override.team_id] || '(unknown team)'}
                            </span>
                            <span className="font-mono text-muted-foreground"> - {override.team_id}</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={override.state === 'enabled' ? 'default' : 'secondary'}>
                              {override.state}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => clearTeamOverride(override.id)} disabled={updatingOverrides}>
                              Clear
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent User Overrides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {userOverrides.slice(0, 8).map((override) => (
              <div key={override.id} className="break-words text-xs text-muted-foreground">
                <span className="font-medium">{override.flag_name}</span> - {userLabelById[override.user_id] || '(unknown user)'} ({override.user_id}) - {override.state}
              </div>
            ))}
            {userOverrides.length === 0 && <p className="text-xs text-muted-foreground">No user overrides found.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Team Overrides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {teamOverrides.slice(0, 8).map((override) => (
              <div key={override.id} className="break-words text-xs text-muted-foreground">
                <span className="font-medium">{override.flag_name}</span> - {teamNameById[override.team_id] || '(unknown team)'} ({override.team_id}) - {override.state}
              </div>
            ))}
            {teamOverrides.length === 0 && <p className="text-xs text-muted-foreground">No team overrides found.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
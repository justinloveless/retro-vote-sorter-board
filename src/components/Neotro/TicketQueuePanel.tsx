import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistedJiraBrowseCollapsedBuckets } from '@/hooks/use-persisted-jira-browse-collapsed-buckets';
import { usePersistedJiraBrowseFilters } from '@/hooks/use-persisted-jira-browse-filters';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Search, Loader2, ListOrdered, Filter, FolderKanban, ChevronRight, ListPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { useJiraIntegration } from '@/hooks/useJiraIntegration';
import { JiraIssueDrawer } from './JiraIssueDrawer';
import { IssueCard, type JiraIssueDisplay } from './IssueCard';
import {
  getJiraBrowseDisabledReason,
  JIRA_BROWSE_DISABLED_REASON_META,
} from '@/lib/jiraBrowseDisabledReason';
import { buildJiraBrowseIssuesBySprint } from '@/lib/jiraBrowseSprintBuckets';

interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  priorityIconUrl: string;
  assignee: string | null;
  reporter: string | null;
  parent: { key: string; summary: string } | null;
  sprint: string | null;
  sprintStartDate?: string | null;
  issueType: string;
  issueTypeIconUrl: string;
  storyPoints: number | null;
}

interface TicketQueuePanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | undefined;
  onAddTicket: (
    key: string,
    summary: string | null,
    ticketParent?: { key: string; summary: string } | null,
    opts?: { forceNewRound?: boolean; pendingRound?: boolean }
  ) => Promise<string | null>;
  onAddTicketsBatch?: (
    tickets: Array<{
      ticketKey: string;
      ticketSummary: string | null;
      ticketParent?: { key: string; summary: string } | null;
    }>
  ) => Promise<void>;
  /** Tickets assigned to any session round (active or not) cannot be added again from Browse Jira */
  rounds?: PokerSessionRound[];
  /** When true, renders as bottom drawer (like Chat) instead of side sheet */
  isMobile?: boolean;
  /** Poker session — story point edits broadcast to all clients in this session. */
  pokerSessionId?: string;
  onIssueCreated?: (issueKey: string, summary: string) => void | Promise<void>;
}

const STATUS_OPTIONS = [
  { value: 'not-done', label: 'Exclude Done' },
  { value: 'all', label: 'All Statuses' },
  { value: 'To Do', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Done', label: 'Done' },
];

const POINTS_OPTIONS = [
  { value: 'any', label: 'Any Points' },
  { value: 'unestimated', label: 'Unestimated' },
  { value: '1', label: '1 pt' },
  { value: '2', label: '2 pts' },
  { value: '3', label: '3 pts' },
  { value: '5', label: '5 pts' },
  { value: '8', label: '8 pts' },
  { value: '13', label: '13 pts' },
  { value: '21', label: '21 pts' },
];

const SPRINT_SCOPE_OPTIONS = [
  { value: 'board-open-backlog', label: 'Board sprints + backlog' },
  { value: 'open-backlog', label: 'Any open sprint + backlog' },
  { value: 'all', label: 'All sprints (incl. closed)' },
];

function SprintBucket({
  name,
  count,
  isOpen,
  onOpenChange,
  issues,
  renderIssue,
  addAllDisabled,
  addAllBusy,
  onAddAllInBucket,
}: {
  name: string;
  count: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  issues: JiraIssue[];
  renderIssue: (issue: JiraIssue) => React.ReactNode;
  addAllDisabled: boolean;
  addAllBusy: boolean;
  onAddAllInBucket: () => void | Promise<void>;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <div className="sticky top-0 z-10 flex w-full items-center gap-0.5 rounded bg-background/95 backdrop-blur">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{name}</span>
            <span className="shrink-0 text-muted-foreground/80 font-normal">({count})</span>
          </button>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          disabled={addAllDisabled || addAllBusy}
          title="Add all in bucket to rounds"
          aria-label={`Add all issues in ${name} to active rounds`}
          onClick={(e) => {
            e.stopPropagation();
            void onAddAllInBucket();
          }}
        >
          {addAllBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
        </Button>
      </div>
      <CollapsibleContent>
        <div className="space-y-1 pt-1">
          {issues.map(renderIssue)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const TicketQueuePanel: React.FC<TicketQueuePanelProps> = ({
  isOpen,
  onOpenChange,
  teamId,
  pokerSessionId,
  onAddTicket,
  onAddTicketsBatch,
  onIssueCreated,
  rounds = [],
  isMobile = false,
}) => {
  const { isJiraConfigured } = useJiraIntegration(teamId);
  const [manualTicketKey, setManualTicketKey] = useState('');
  const {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    pointsFilter,
    setPointsFilter,
    sprintScopeFilter,
    setSprintScopeFilter,
    showFilters,
    setShowFilters,
    hidePointedOrPointing,
    setHidePointedOrPointing,
  } = usePersistedJiraBrowseFilters(teamId);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [collapsedBuckets, setCollapsedBuckets] = usePersistedJiraBrowseCollapsedBuckets(teamId);
  const [addingBucketId, setAddingBucketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTicketSummary, setNewTicketSummary] = useState('');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [newTicketSaving, setNewTicketSaving] = useState(false);
  const { toast } = useToast();

  const MIN_WIDTH = 320;
  const MAX_WIDTH = 800;
  const [drawerWidth, setDrawerWidth] = useState(480);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = drawerWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    const handleMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setDrawerWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [drawerWidth]);

  const browseIssues = useMemo(() => {
    const searching = !!searchText.trim();
    if (searching || !hidePointedOrPointing) return issues;
    return issues.filter((i) => getJiraBrowseDisabledReason(i.key, rounds) === null);
  }, [issues, hidePointedOrPointing, rounds, searchText]);

  const issuesBySprint = useMemo(() => buildJiraBrowseIssuesBySprint(browseIssues), [browseIssues]);

  const ticketKeysOnSessionRounds = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rounds) {
      const k = r.ticket_number?.trim();
      if (k) keys.add(k);
    }
    return keys;
  }, [rounds]);

  const ticketKeysOnSessionRoundsRef = useRef(ticketKeysOnSessionRounds);
  ticketKeysOnSessionRoundsRef.current = ticketKeysOnSessionRounds;

  const fetchAllIssues = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    setSearchError(null);
    try {
      const apiStatusFilter = statusFilter === 'not-done' ? undefined : statusFilter === 'all' ? 'all' : statusFilter;
      const includeKeySet = new Set<string>();
      for (const k of ticketKeysOnSessionRoundsRef.current) includeKeySet.add(k);
      const includeKeys = includeKeySet.size > 0 ? Array.from(includeKeySet) : undefined;
      const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
        body: {
          teamId,
          searchText: searchText || undefined,
          statusFilter: apiStatusFilter,
          pointsFilter: pointsFilter !== 'any' ? pointsFilter : undefined,
          sprintScopeFilter,
          includeKeys,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setIssues(data.issues || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to load issues');
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, searchText, statusFilter, pointsFilter, sprintScopeFilter]);

  useEffect(() => {
    if (isOpen && teamId && isJiraConfigured) {
      fetchAllIssues();
    }
  }, [isOpen, teamId, isJiraConfigured, statusFilter, pointsFilter, sprintScopeFilter, fetchAllIssues]);

  const handleAddManualTicket = async () => {
    const key = manualTicketKey.trim();
    if (!key) return;
    setAddingKeys(prev => new Set(prev).add(key));
    setManualTicketKey('');

    let summary: string | null = null;
    let parent: { key: string; summary: string } | null = null;
    if (isJiraConfigured && teamId) {
      try {
        const { data } = await supabase.functions.invoke('get-jira-issue', {
          body: { teamId, issueIdOrKey: key },
        });
        if (data && !data.error && data.fields) {
          summary = data.fields.summary || null;
          parent = data.fields.parent
            ? { key: data.fields.parent.key, summary: data.fields.parent.fields?.summary || '' }
            : null;
        }
      } catch {
        // Fall through with null summary
      }
    }

    await onAddTicket(key, summary, parent);
    setAddingKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleCreateNewJiraTicket = async () => {
    const sum = newTicketSummary.trim();
    if (!teamId || !sum) return;
    setNewTicketSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-jira-issue', {
        body: {
          teamId,
          summary: sum,
          description: newTicketDescription.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const key = typeof data?.key === 'string' ? data.key : '';
      if (!key) throw new Error('No issue key returned');
      toast({ title: `Created ${key}` });
      setNewTicketOpen(false);
      setNewTicketSummary('');
      setNewTicketDescription('');
      await onIssueCreated?.(key, sum);
    } catch (e) {
      toast({
        title: 'Failed to create ticket',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setNewTicketSaving(false);
    }
  };

  const handleAddTicket = async (issue: JiraIssue) => {
    setAddingKeys(prev => new Set(prev).add(issue.key));
    await onAddTicket(issue.key, issue.summary, issue.parent);
    setAddingKeys(prev => {
      const next = new Set(prev);
      next.delete(issue.key);
      return next;
    });
  };

  const isBlockedFromAdding = (key: string) => ticketKeysOnSessionRounds.has(key);

  const handleAddAllInBucket = useCallback(
    async (bucketId: string, bucketIssues: JiraIssue[]) => {
      const uniqueKeys = new Set<string>();
      const toAdd = bucketIssues.filter((i) => {
        const key = i.key?.trim() || '';
        if (!key) return false;
        if (uniqueKeys.has(key)) return false;
        if (ticketKeysOnSessionRounds.has(key)) return false;
        uniqueKeys.add(key);
        return true;
      });
      if (toAdd.length === 0) return;
      setAddingBucketId(bucketId);
      try {
        if (onAddTicketsBatch) {
          await onAddTicketsBatch(
            toAdd.map((issue) => ({
              ticketKey: issue.key.trim(),
              ticketSummary: issue.summary,
              ticketParent: issue.parent,
            }))
          );
        } else {
          for (const issue of toAdd) {
            await onAddTicket(issue.key.trim(), issue.summary, issue.parent);
          }
        }
        toast({
          title: `Added ${toAdd.length} ticket${toAdd.length === 1 ? '' : 's'} to active rounds`,
        });
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : 'Failed to add tickets',
          variant: 'destructive',
        });
      } finally {
        setAddingBucketId(null);
      }
    },
    [ticketKeysOnSessionRounds, onAddTicket, onAddTicketsBatch, toast],
  );

  const renderIssue = (issue: JiraIssue) => {
    const blocked = isBlockedFromAdding(issue.key);
    const disabledReason = blocked ? getJiraBrowseDisabledReason(issue.key, rounds) : null;
    const reasonMeta = disabledReason ? JIRA_BROWSE_DISABLED_REASON_META[disabledReason] : null;
    const issueContent = (
      <IssueCard
        browse
        issue={issue as JiraIssueDisplay}
        className={reasonMeta ? 'items-start' : undefined}
        rightSlot={
          <div className="flex flex-col items-end gap-1 shrink-0">
            {reasonMeta && (
              <Badge variant={reasonMeta.badgeVariant} className="text-xs px-2 py-0.5">
                {reasonMeta.label}
              </Badge>
            )}
            <Button
              variant={blocked ? 'secondary' : 'outline'}
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={blocked || addingKeys.has(issue.key)}
              onClick={(e) => { e.stopPropagation(); handleAddTicket(issue); }}
            >
              {addingKeys.has(issue.key) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        }
        cursorPointer={!!teamId}
      />
    );
    return teamId ? (
      <JiraIssueDrawer
        key={issue.key}
        issueIdOrKey={issue.key}
        teamId={teamId}
        pokerSessionId={pokerSessionId}
        onIssueCreated={onIssueCreated}
        trigger={issueContent}
      />
    ) : (
      <div key={issue.key}>{issueContent}</div>
    );
  };

  const browseJiraMain = (
    <>
      <div className="shrink-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search issues..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && teamId) fetchAllIssues(); }}
            className="flex-1 h-9 text-sm"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(prev => !prev)}
            className={showFilters ? 'bg-accent' : ''}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => teamId && fetchAllIssues()}
            disabled={isLoading}
            size="icon"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pointsFilter} onValueChange={setPointsFilter}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Points" />
                </SelectTrigger>
                <SelectContent>
                  {POINTS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={sprintScopeFilter} onValueChange={setSprintScopeFilter}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="Sprint scope" />
              </SelectTrigger>
              <SelectContent>
                {SPRINT_SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ticket-queue-jira-hide-pointed"
                checked={hidePointedOrPointing}
                onCheckedChange={(c) => setHidePointedOrPointing(c === true)}
              />
              <Label htmlFor="ticket-queue-jira-hide-pointed" className="text-sm font-normal cursor-pointer leading-none">
                Hide pointed or in session
              </Label>
            </div>
          </div>
        )}
      </div>

      {searchError && (
        <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md mt-2 shrink-0">
          {searchError}
        </div>
      )}

      <ScrollArea className="flex-1 mt-2 min-h-0">
        <div className="space-y-1 pr-2">
          {isLoading && issues.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : browseIssues.length === 0 && !searchError ? (
            <div className="text-base text-muted-foreground text-center p-4">
              {issues.length === 0 ? 'No issues found.' : 'No issues match your filters.'}
            </div>
          ) : (
            <>
              {issuesBySprint.sprintBuckets
                .filter(({ issues: sprintIssues }) => sprintIssues.length > 0)
                .map(({ name, issues: sprintIssues }) => (
                  <SprintBucket
                    key={name}
                    name={name}
                    count={sprintIssues.length}
                    isOpen={!collapsedBuckets.has(name)}
                    onOpenChange={(open) => setCollapsedBuckets(prev => {
                      const next = new Set(prev);
                      if (open) next.delete(name); else next.add(name);
                      return next;
                    })}
                    issues={sprintIssues}
                    renderIssue={renderIssue}
                    addAllDisabled={sprintIssues.every((i) => isBlockedFromAdding(i.key))}
                    addAllBusy={addingBucketId === name}
                    onAddAllInBucket={() => handleAddAllInBucket(name, sprintIssues)}
                  />
                ))}
              {issuesBySprint.backlog.length > 0 && (
                <SprintBucket
                  key="__backlog__"
                  name="Backlog"
                  count={issuesBySprint.backlog.length}
                  isOpen={!collapsedBuckets.has('__backlog__')}
                  onOpenChange={(open) => setCollapsedBuckets(prev => {
                    const next = new Set(prev);
                    if (open) next.delete('__backlog__'); else next.add('__backlog__');
                    return next;
                  })}
                  issues={issuesBySprint.backlog}
                  renderIssue={renderIssue}
                  addAllDisabled={
                    issuesBySprint.backlog.every((i) => isBlockedFromAdding(i.key))
                  }
                  addAllBusy={addingBucketId === '__backlog__'}
                  onAddAllInBucket={() => handleAddAllInBucket('__backlog__', issuesBySprint.backlog)}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const panelContent = (
    <>
      {isMobile && isJiraConfigured ? (
        <div className="flex flex-col flex-1 min-h-0 pb-4 pt-0">
          <DrawerHeader className="text-left p-0 pb-3">
            <DrawerTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <Search className="h-5 w-5 shrink-0" />
                <span className="truncate">Browse Jira</span>
              </span>
              {teamId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs shrink-0 gap-1"
                  onClick={() => setNewTicketOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  New
                </Button>
              ) : null}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {browseJiraMain}
          </div>
        </div>
      ) : (
        <div className={`flex flex-col flex-1 min-h-0 ${isMobile ? 'pb-4 pt-0' : 'p-6 pt-12'}`}>
          {isMobile ? (
            <DrawerHeader className="text-left p-0 pb-3">
              <DrawerTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Add Tickets
              </DrawerTitle>
            </DrawerHeader>
          ) : (
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Add Tickets
              </SheetTitle>
            </SheetHeader>
          )}

          <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
            <ResizablePanel defaultSize={isJiraConfigured ? 35 : 100} minSize={20} className="flex flex-col min-h-0">
              <div className="text-xs font-semibold text-muted-foreground mb-2 shrink-0">
                Add to active rounds
              </div>
              <div className="shrink-0 flex gap-2 mb-3">
                <Input
                  placeholder={isJiraConfigured ? 'Or add manually (e.g. PROJ-123)' : 'Ticket key (e.g. PROJ-123)'}
                  value={manualTicketKey}
                  onChange={(e) => setManualTicketKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddManualTicket(); }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={
                    !manualTicketKey.trim()
                    || addingKeys.has(manualTicketKey.trim())
                    || isBlockedFromAdding(manualTicketKey.trim())
                  }
                  onClick={handleAddManualTicket}
                >
                  {addingKeys.has(manualTicketKey.trim()) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                <div>
                  <ListOrdered className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>New tickets are added directly to active rounds.</p>
                  <p className="text-xs mt-1">{isJiraConfigured ? 'Add manually above or browse Jira below.' : 'Add tickets manually above.'}</p>
                </div>
              </div>
            </ResizablePanel>

            {isJiraConfigured && (
              <>
                <ResizableHandle withHandle className="shrink-0 !h-1 !min-h-1 bg-border" />
                <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-h-0 pt-4">
                  <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                    <span className="text-sm font-semibold text-muted-foreground">Browse Jira</span>
                    {teamId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => setNewTicketOpen(true)}
                      >
                        <Plus className="h-3 w-3" />
                        New ticket
                      </Button>
                    ) : null}
                  </div>
                  {browseJiraMain}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      )}
    </>
  );

  const newTicketDialog = (
    <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Jira ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tqp-new-ticket-summary">Summary</Label>
            <Input
              id="tqp-new-ticket-summary"
              value={newTicketSummary}
              onChange={(e) => setNewTicketSummary(e.target.value.slice(0, 255))}
              maxLength={255}
              disabled={newTicketSaving}
              placeholder="Short title"
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{newTicketSummary.length}/255</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tqp-new-ticket-desc">Description (optional)</Label>
            <Textarea
              id="tqp-new-ticket-desc"
              value={newTicketDescription}
              onChange={(e) => setNewTicketDescription(e.target.value)}
              disabled={newTicketSaving}
              placeholder="Details, acceptance criteria…"
              rows={5}
              className="text-sm resize-y min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setNewTicketOpen(false)}
            disabled={newTicketSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreateNewJiraTicket()}
            disabled={newTicketSaving || !newTicketSummary.trim()}
          >
            {newTicketSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create in Jira'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
          <DrawerContent className="h-[80vh] flex flex-col">
            <div className="h-full flex flex-col min-h-0 overflow-hidden px-5">
              {panelContent}
            </div>
          </DrawerContent>
        </Drawer>
        {newTicketDialog}
      </>
    );
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          className="flex flex-col p-0"
          style={{ width: drawerWidth, minWidth: drawerWidth, maxWidth: drawerWidth }}
        >
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors group z-10"
            title="Drag to resize"
          >
            <div className="w-1 h-16 rounded-full bg-border group-hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {panelContent}
        </SheetContent>
      </Sheet>
      {newTicketDialog}
    </>
  );
};

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Plus, Search, Loader2, ListOrdered, Filter, FolderKanban, ChevronRight, ListPlus, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { JiraIssueDrawer } from './JiraIssueDrawer';
import { IssueCard, type JiraIssueDisplay } from './IssueCard';
import { getStoryPointsFromJiraFields } from '@/lib/jiraStoryPoints';
import {
  getJiraBrowseDisabledReason,
  JIRA_BROWSE_DISABLED_REASON_META,
} from '@/lib/jiraBrowseDisabledReason';
import { buildJiraBrowseIssuesBySprint } from '@/lib/jiraBrowseSprintBuckets';
import type { JiraTicketMeta } from '@/hooks/use-jira-ticket-metadata';
import { usePersistedJiraBrowseCollapsedBuckets } from '@/hooks/use-persisted-jira-browse-collapsed-buckets';
import { usePersistedJiraBrowseFilters } from '@/hooks/use-persisted-jira-browse-filters';

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
  /** ISO date from Jira sprint; null when backlog or unknown. */
  sprintStartDate?: string | null;
  issueType: string;
  issueTypeIconUrl: string;
  storyPoints: number | null;
}

interface EmbeddedTicketQueueProps {
  teamId: string | undefined;
  /** Poker session id — story point edits broadcast to all clients in this session. */
  pokerSessionId?: string;
  isJiraConfigured: boolean;
  onAddTicket: (
    key: string,
    summary: string | null,
    ticketParent?: { key: string; summary: string } | null
  ) => Promise<void>;
  onAddTicketsBatch?: (
    tickets: Array<{
      ticketKey: string;
      ticketSummary: string | null;
      ticketParent?: { key: string; summary: string } | null;
    }>
  ) => Promise<void>;
  displayTicketNumber: string;
  onSelectTicket: (ticketKey: string) => void;
  /** Tickets on any session round (active or not) are excluded from adding via Browse Jira */
  rounds?: PokerSessionRound[];
  /** When false, hides the Browse Jira panel (only Queue is shown). Default true when isJiraConfigured. */
  showJiraBrowser?: boolean;
  /** Called when browse fetch completes — parent can merge this into shared ticket metadata to avoid duplicate get-jira-board-issues. */
  onMetadataFromBrowse?: (meta: Record<string, JiraTicketMeta>) => void;
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
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-2">
      <div className="sticky top-0 z-10 flex w-full items-center gap-0.5 rounded bg-background/95 backdrop-blur">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{name}</span>
            <span className="shrink-0 text-muted-foreground/80 font-normal">({count})</span>
          </button>
        </CollapsibleTrigger>
        <NeotroPressableButton
          size="xs"
          activeShowsPressed={false}
          isDisabled={addAllDisabled || addAllBusy}
          onClick={(e) => {
            e.stopPropagation();
            void onAddAllInBucket();
          }}
          aria-label={`Add all issues in ${name} to active rounds`}
          title="Add all in bucket to rounds"
          className="shrink-0"
        >
          {addAllBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
        </NeotroPressableButton>
      </div>
      <CollapsibleContent>
        <div className="space-y-1 pt-1">
          {issues.map(renderIssue)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const EmbeddedTicketQueue: React.FC<EmbeddedTicketQueueProps> = ({
  teamId,
  pokerSessionId,
  showJiraBrowser = true,
  isJiraConfigured,
  onAddTicket,
  onAddTicketsBatch,
  displayTicketNumber,
  onMetadataFromBrowse,
  onSelectTicket,
  rounds = [],
}) => {
  const queue = useMemo<{ id: string; ticket_key: string; ticket_summary: string | null; position: number }[]>(
    () => [],
    []
  );
  const onClearQueue = () => {};
  const onRemoveTicket = (_id: string) => {};
  const onReorderQueue = async (_items: typeof queue) => {};
  const onPlayQueueTicketNow = (_item: (typeof queue)[number]) => {};
  const playQueueTicketNowDisabled = true;
  const playQueueNowBusyId: string | null = null;
  const [manualTicketKey, setManualTicketKey] = useState('');
  const {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    pointsFilter,
    setPointsFilter,
    showFilters,
    setShowFilters,
    hidePointedOrPointing,
    setHidePointedOrPointing,
  } = usePersistedJiraBrowseFilters(teamId);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [manualIssues, setManualIssues] = useState<Map<string, JiraIssue>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [collapsedBuckets, setCollapsedBuckets] = usePersistedJiraBrowseCollapsedBuckets(teamId);
  const [addingBucketId, setAddingBucketId] = useState<string | null>(null);
  const { toast } = useToast();
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);
  /** Browse Jira list scroll — native overflow so we can save/restore scrollTop across refetches. */
  const jiraBrowseScrollRef = useRef<HTMLDivElement>(null);
  const browseScrollTopBeforeFetchRef = useRef(0);
  const pendingBrowseScrollRestoreRef = useRef(false);

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

  /** Latest round keys for `includeKeys` without putting them in fetchAllIssues deps (avoids refetch when rounds change). */
  const ticketKeysOnSessionRoundsRef = useRef(ticketKeysOnSessionRounds);
  ticketKeysOnSessionRoundsRef.current = ticketKeysOnSessionRounds;

  const pushIssuesMetadataToParent = useCallback(
    (issueList: JiraIssue[]) => {
      if (!onMetadataFromBrowse || issueList.length === 0) return;
      const meta: Record<string, JiraTicketMeta> = {};
      for (const issue of issueList) {
        if (!issue?.key) continue;
        meta[issue.key] = {
          issueTypeIconUrl: issue.issueTypeIconUrl,
          storyPoints: issue.storyPoints ?? null,
          summary: issue.summary,
        };
      }
      if (Object.keys(meta).length > 0) onMetadataFromBrowse(meta);
    },
    [onMetadataFromBrowse]
  );

  const fetchAllIssues = useCallback(async () => {
    if (!teamId) return;
    const scrollEl = jiraBrowseScrollRef.current;
    if (scrollEl) {
      browseScrollTopBeforeFetchRef.current = scrollEl.scrollTop;
      pendingBrowseScrollRestoreRef.current = true;
    }
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
          includeKeys,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const issuesList = data.issues || [];
      setIssues(issuesList);
      if (onMetadataFromBrowse && issuesList.length > 0) {
        const meta: Record<string, JiraTicketMeta> = {};
        for (const i of issuesList) {
          if (i?.key) {
            meta[i.key] = {
              issueTypeIconUrl: i.issueTypeIconUrl,
              storyPoints: i.storyPoints ?? null,
              summary: i.summary,
            };
          }
        }
        onMetadataFromBrowse(meta);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to load issues');
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, searchText, statusFilter, pointsFilter, onMetadataFromBrowse]);

  useLayoutEffect(() => {
    if (!pendingBrowseScrollRestoreRef.current) return;
    pendingBrowseScrollRestoreRef.current = false;
    const el = jiraBrowseScrollRef.current;
    if (!el) return;
    const top = browseScrollTopBeforeFetchRef.current;
    el.scrollTop = top;
    requestAnimationFrame(() => {
      if (jiraBrowseScrollRef.current) {
        jiraBrowseScrollRef.current.scrollTop = top;
      }
    });
  }, [issues]);

  const handleAddManualTicket = async () => {
    const key = manualTicketKey.trim();
    if (!key) return;
    setAddingKeys(prev => new Set(prev).add(key));
    setManualTicketKey('');

    let summary: string | null = null;
    let enrichedIssue: JiraIssue | null = null;
    if (isJiraConfigured && teamId) {
      try {
        const { data } = await supabase.functions.invoke('get-jira-issue', {
          body: { teamId, issueIdOrKey: key },
        });
        if (data && !data.error && data.fields) {
          summary = data.fields.summary || null;
          enrichedIssue = {
            key: data.key || key,
            summary: data.fields.summary || '',
            status: data.fields.status?.name || '',
            statusCategory: data.fields.status?.statusCategory?.key || '',
            priority: data.fields.priority?.name || '',
            priorityIconUrl: data.fields.priority?.iconUrl || '',
            assignee: data.fields.assignee?.displayName || null,
            reporter: data.fields.reporter?.displayName || null,
            parent: data.fields.parent
              ? { key: data.fields.parent.key, summary: data.fields.parent.fields?.summary || '' }
              : null,
            sprint: null,
            sprintStartDate: null,
            issueType: data.fields.issuetype?.name || '',
            issueTypeIconUrl: data.fields.issuetype?.iconUrl || '',
            storyPoints: getStoryPointsFromJiraFields(data.fields as Record<string, unknown>),
          };
          setManualIssues((prev) => {
            const next = new Map(prev);
            next.set(enrichedIssue!.key, enrichedIssue!);
            return next;
          });
        }
      } catch {
        // Fall through with null summary
      }
    }

    await onAddTicket(key, summary, enrichedIssue?.parent ?? null);
    if (enrichedIssue) pushIssuesMetadataToParent([enrichedIssue]);
    setAddingKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleAddTicket = async (issue: JiraIssue) => {
    setAddingKeys(prev => new Set(prev).add(issue.key));
    await onAddTicket(issue.key, issue.summary, issue.parent);
    pushIssuesMetadataToParent([issue]);
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
        pushIssuesMetadataToParent(toAdd);
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
    [ticketKeysOnSessionRounds, onAddTicket, onAddTicketsBatch, toast, pushIssuesMetadataToParent],
  );

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItemRef.current = index;
  };

  const handleDrop = () => {
    if (dragItemRef.current === null || dragOverItemRef.current === null) return;
    if (dragItemRef.current === dragOverItemRef.current) return;
    const reordered = [...queue];
    const [removed] = reordered.splice(dragItemRef.current, 1);
    reordered.splice(dragOverItemRef.current, 0, removed);
    dragItemRef.current = null;
    dragOverItemRef.current = null;
    onReorderQueue(reordered.map((item, i) => ({ ...item, position: i })));
  };

  const renderBrowseIssue = (issue: JiraIssue) => {
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
            <NeotroPressableButton
              size="sm"
              isActive={!blocked}
              activeShowsPressed={false}
              isDisabled={blocked || addingKeys.has(issue.key)}
              onClick={(e) => { e.stopPropagation(); handleAddTicket(issue); }}
              aria-label={blocked ? 'Already on a round' : 'Add to active rounds'}
              title={blocked ? 'Already on a round' : 'Add to rounds'}
            >
              {addingKeys.has(issue.key) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </NeotroPressableButton>
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
        trigger={issueContent}
      />
    ) : (
      <div key={issue.key}>{issueContent}</div>
    );
  };

  useEffect(() => {
    if (teamId && isJiraConfigured) {
      fetchAllIssues();
    }
    // Intentionally omit fetchAllIssues: only load when team / Jira availability changes, not when rounds change.
    // includeKeys for the next search uses ticketKeysOnSessionRoundsRef at click time; parent gets metadata via pushIssuesMetadataToParent on add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, isJiraConfigured]);

  useEffect(() => {
    if (!teamId || !isJiraConfigured || queue.length === 0) return;
    const missingKeys = queue
      .map(q => q.ticket_key)
      .filter(k => !issues.some(i => i.key === k) && !manualIssues.has(k));
    if (missingKeys.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
          body: { teamId, includeKeys: missingKeys, keysOnly: true },
        });
        if (cancelled || error || data?.error) return;
        const rows = data?.issues || [];
        if (rows.length === 0) return;
        setManualIssues((prev) => {
          const next = new Map(prev);
          for (const row of rows) {
            if (!row?.key) continue;
            const enriched: JiraIssue = {
              key: row.key,
              summary: row.summary || '',
              status: row.status || '',
              statusCategory: row.statusCategory || '',
              priority: row.priority || '',
              priorityIconUrl: row.priorityIconUrl || '',
              assignee: row.assignee ?? null,
              reporter: row.reporter ?? null,
              parent: row.parent ?? null,
              sprint: row.sprint ?? null,
              sprintStartDate: row.sprintStartDate ?? null,
              issueType: row.issueType || '',
              issueTypeIconUrl: row.issueTypeIconUrl || '',
              storyPoints: row.storyPoints ?? null,
            };
            next.set(enriched.key, enriched);
          }
          return next;
        });
      } catch {
        /* skip */
      }
    })();
    return () => { cancelled = true; };
  }, [teamId, isJiraConfigured, queue, issues, manualIssues]);

  const showQueuePanel = false;
  const showJiraPanel = isJiraConfigured && showJiraBrowser;

  const queuePanel = (
    <ResizablePanel defaultSize={showJiraPanel ? 50 : 100} minSize={20} className="flex flex-col min-h-0 pl-2">
      <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListOrdered className="h-4 w-4" />
              Queue {queue.length > 0 && `(${queue.length})`}
            </div>
            {queue.length > 0 && (
              <NeotroPressableButton
                variant="destructive"
                size="compact"
                activeShowsPressed={false}
                onClick={onClearQueue}
                title="Clear queue"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </NeotroPressableButton>
            )}
          </div>
          <div className="shrink-0 flex gap-1 mb-2">
            <Input
              placeholder={isJiraConfigured ? 'Or add manually (e.g. PROJ-123)' : 'Ticket key (e.g. PROJ-123)'}
              value={manualTicketKey}
              onChange={(e) => setManualTicketKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddManualTicket(); }}
              className="flex-1 h-7 text-xs"
            />
            <NeotroPressableButton
              size="sm"
              isActive={!!manualTicketKey.trim()}
              activeShowsPressed={false}
              isDisabled={
                !manualTicketKey.trim()
                || addingKeys.has(manualTicketKey.trim())
                || isBlockedFromAdding(manualTicketKey.trim())
              }
              onClick={handleAddManualTicket}
              aria-label="Add ticket"
              title="Add ticket"
            >
              {addingKeys.has(manualTicketKey.trim()) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </NeotroPressableButton>
          </div>
          {queue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs text-center p-4">
              <div>
                <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No tickets in queue.</p>
                <p className="mt-1">{isJiraConfigured ? 'Add manually above or browse Jira below.' : 'Add tickets manually above.'}</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1 p-1 pr-3">
                {queue.map((item, index) => {
                  const isActive = displayTicketNumber === item.ticket_key;
                  const enrichedIssue: JiraIssueDisplay = issues.find((i) => i.key === item.ticket_key)
                    ?? manualIssues.get(item.ticket_key)
                    ?? { key: item.ticket_key, summary: item.ticket_summary };
                  const card = (
                    <div
                      className={`relative ${isActive ? 'ring-2 ring-primary rounded-md' : ''}`}
                    >
                      <IssueCard
                        issue={enrichedIssue}
                        leftSlot={<GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />}
                        rightSlot={
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                            <NeotroPressableButton
                              size="compact"
                              isActive
                              activeShowsPressed={false}
                              isDisabled={playQueueTicketNowDisabled || playQueueNowBusyId !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onPlayQueueTicketNow(item);
                              }}
                              aria-label="Play now"
                              title="New round for everyone"
                              className="min-w-[4.25rem]"
                            >
                              {playQueueNowBusyId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Play now'
                              )}
                            </NeotroPressableButton>
                            <NeotroPressableButton
                              variant="destructive"
                              size="xs"
                              activeShowsPressed={false}
                              onClick={(e) => { e.stopPropagation(); onRemoveTicket(item.id); }}
                              aria-label="Remove from queue"
                              title="Remove from queue"
                            >
                              <Trash2 className="h-3 w-3" />
                            </NeotroPressableButton>
                          </div>
                        }
                        showNextBadge={index === 0}
                        className="cursor-grab active:cursor-grabbing group"
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={handleDrop}
                        cursorPointer
                      />
                    </div>
                  );
                  return teamId ? (
                    <JiraIssueDrawer
                      key={item.id}
                      issueIdOrKey={item.ticket_key}
                      teamId={teamId}
                      pokerSessionId={pokerSessionId}
                      trigger={card}
                    />
                  ) : (
                    <div key={item.id}>{card}</div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
    </ResizablePanel>
  );

  const jiraContent = (
    <div className="neotro-jira-scroll-group flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-2 text-base font-semibold mb-2 shrink-0">
                <Search className="h-5 w-5" />
                Browse Jira
              </div>
          <div className="space-y-2 shrink-0">
            <div className="flex flex-wrap gap-1">
              <Input
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && teamId) fetchAllIssues(); }}
                className="flex-1 h-8 text-sm"
              />
              <NeotroPressableButton
                size="sm"
                isActive={showFilters}
                onClick={() => setShowFilters(prev => !prev)}
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
                title={showFilters ? 'Hide filters' : 'Filters'}
              >
                <Filter className="h-4 w-4" />
              </NeotroPressableButton>
              <NeotroPressableButton
                size="sm"
                isActive={!isLoading}
                activeShowsPressed={false}
                isDisabled={isLoading}
                onClick={() => teamId && fetchAllIssues()}
                aria-label="Search"
                title="Search"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </NeotroPressableButton>
            </div>

            {showFilters && (
                <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1 h-8 text-sm">
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
                  <SelectTrigger className="flex-1 h-8 text-sm">
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="neotro-jira-hide-pointed"
                    checked={hidePointedOrPointing}
                    onCheckedChange={(c) => setHidePointedOrPointing(c === true)}
                  />
                  <Label htmlFor="neotro-jira-hide-pointed" className="text-sm font-normal cursor-pointer leading-none">
                    Hide pointed or in session
                  </Label>
                </div>
              </div>
            )}

            {searchError && (
              <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
                {searchError}
              </div>
            )}
          </div>

          <div
            ref={jiraBrowseScrollRef}
            className="neotro-jira-browse-scroll flex-1 min-h-0 mt-2 overflow-y-auto overflow-x-hidden rounded-[inherit] pr-1"
          >
            <div className="space-y-1 pr-2">
              {isLoading && issues.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : browseIssues.length === 0 && !searchError ? (
                <div className="text-sm text-muted-foreground text-center p-4">
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
                      renderIssue={renderBrowseIssue}
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
                      renderIssue={renderBrowseIssue}
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
          </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {showQueuePanel && showJiraPanel ? (
        <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
          {queuePanel}
          <ResizableHandle withHandle className="shrink-0 my-2" />
          <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col min-h-0 pl-2">
            {jiraContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : showQueuePanel ? (
        <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
          {queuePanel}
        </ResizablePanelGroup>
      ) : showJiraPanel ? (
        <div className="flex flex-col flex-1 min-h-0 pl-2">
          {jiraContent}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4">
          Enable Jira in team settings to browse issues.
        </div>
      )}
    </div>
  );
};

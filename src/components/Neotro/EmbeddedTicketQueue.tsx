import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Plus, Trash2, GripVertical, Search, Loader2, ListOrdered, Filter, FolderKanban, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TicketQueueItem } from '@/hooks/useTicketQueue';
import { JiraIssueDrawer } from './JiraIssueDrawer';
import { IssueCard, type JiraIssueDisplay } from './IssueCard';

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
  issueType: string;
  issueTypeIconUrl: string;
  storyPoints: number | null;
}

interface EmbeddedTicketQueueProps {
  teamId: string | undefined;
  queue: TicketQueueItem[];
  onAddTicket: (key: string, summary: string | null) => Promise<void>;
  onRemoveTicket: (id: string) => Promise<void>;
  onReorderQueue: (items: TicketQueueItem[]) => Promise<void>;
  onClearQueue: () => Promise<void>;
  displayTicketNumber: string;
  onSelectTicket: (ticketKey: string) => void;
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
}: {
  name: string;
  count: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  issues: JiraIssue[];
  renderIssue: (issue: JiraIssue) => React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 py-1 px-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-background/95 backdrop-blur z-10 hover:bg-muted/50 rounded transition-colors text-left"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          <FolderKanban className="h-3 w-3 shrink-0" />
          <span className="truncate">{name}</span>
          <span className="text-muted-foreground/80 font-normal">({count})</span>
        </button>
      </CollapsibleTrigger>
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
  queue,
  onAddTicket,
  onRemoveTicket,
  onReorderQueue,
  onClearQueue,
  displayTicketNumber,
  onSelectTicket,
}) => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('not-done');
  const [pointsFilter, setPointsFilter] = useState('any');
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const issuesBySprint = useMemo(() => {
    const BACKLOG_KEY = '__backlog__';
    const groups = new Map<string, JiraIssue[]>();
    for (const issue of issues) {
      const bucket = issue.sprint || BACKLOG_KEY;
      const list = groups.get(bucket) || [];
      list.push(issue);
      groups.set(bucket, list);
    }
    const backlog = groups.get(BACKLOG_KEY) || [];
    groups.delete(BACKLOG_KEY);
    const sprintNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { backlog, sprintBuckets: sprintNames.map(name => ({ name, issues: groups.get(name)! })) };
  }, [issues]);

  const fetchAllIssues = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    setSearchError(null);
    try {
      const apiStatusFilter = statusFilter === 'not-done' ? undefined : statusFilter === 'all' ? 'all' : statusFilter;
      const queueKeys = queue.map((q) => q.ticket_key);
      const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
        body: {
          teamId,
          searchText: searchText || undefined,
          statusFilter: apiStatusFilter,
          pointsFilter: pointsFilter !== 'any' ? pointsFilter : undefined,
          includeKeys: queueKeys.length > 0 ? queueKeys : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setIssues(data.issues || []);
      setCollapsedBuckets(new Set());
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to load issues');
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, searchText, statusFilter, pointsFilter, queue]);


  const handleAddTicket = async (issue: JiraIssue) => {
    setAddingKeys(prev => new Set(prev).add(issue.key));
    await onAddTicket(issue.key, issue.summary);
    setAddingKeys(prev => {
      const next = new Set(prev);
      next.delete(issue.key);
      return next;
    });
  };

  const isInQueue = (key: string) => queue.some(q => q.ticket_key === key);

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
    const alreadyQueued = isInQueue(issue.key);
    const issueContent = (
      <IssueCard
        issue={issue as JiraIssueDisplay}
        rightSlot={
          <Button
            variant={alreadyQueued ? 'secondary' : 'outline'}
            size="icon"
            className="h-6 w-6 shrink-0"
            disabled={alreadyQueued || addingKeys.has(issue.key)}
            onClick={(e) => { e.stopPropagation(); handleAddTicket(issue); }}
          >
            {addingKeys.has(issue.key) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </Button>
        }
        cursorPointer={!!teamId}
      />
    );
    return teamId ? (
      <JiraIssueDrawer key={issue.key} issueIdOrKey={issue.key} teamId={teamId} trigger={issueContent} />
    ) : (
      <div key={issue.key}>{issueContent}</div>
    );
  };

  useEffect(() => {
    if (teamId) {
      fetchAllIssues();
    }
  }, [teamId]);

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListOrdered className="h-4 w-4" />
              Queue {queue.length > 0 && `(${queue.length})`}
            </div>
            {queue.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={onClearQueue}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          {queue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs text-center p-4">
              <div>
                <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No tickets in queue.</p>
                <p className="mt-1">Browse Jira below to add.</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1 pr-2">
                {queue.map((item, index) => {
                  const isActive = displayTicketNumber === item.ticket_key;
                  const enrichedIssue: JiraIssueDisplay = issues.find((i) => i.key === item.ticket_key) ?? {
                    key: item.ticket_key,
                    summary: item.ticket_summary,
                  };
                  const card = (
                    <div
                      className={`relative ${isActive ? 'ring-2 ring-primary rounded-md' : ''}`}
                      onClick={() => onSelectTicket(item.ticket_key)}
                    >
                      <IssueCard
                        issue={enrichedIssue}
                        leftSlot={<GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />}
                        rightSlot={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={(e) => { e.stopPropagation(); onRemoveTicket(item.id); }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
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
                    <JiraIssueDrawer key={item.id} issueIdOrKey={item.ticket_key} teamId={teamId} trigger={card} />
                  ) : (
                    <div key={item.id}>{card}</div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle className="shrink-0 my-2" />

        <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2 shrink-0">
            <Search className="h-4 w-4" />
            Browse Jira
          </div>
          <div className="space-y-2 shrink-0">
            <div className="flex gap-1">
              <Input
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && teamId) fetchAllIssues(); }}
                className="flex-1 h-7 text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowFilters(prev => !prev)}
              >
                <Filter className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => teamId && fetchAllIssues()}
                disabled={isLoading}
                size="icon"
                className="h-7 w-7"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              </Button>
            </div>

            {showFilters && (
              <div className="flex gap-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1 h-6 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pointsFilter} onValueChange={setPointsFilter}>
                  <SelectTrigger className="flex-1 h-6 text-xs">
                    <SelectValue placeholder="Points" />
                  </SelectTrigger>
                  <SelectContent>
                    {POINTS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {searchError && (
              <div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
                {searchError}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-0 mt-2">
            <div className="space-y-1 pr-2">
              {isLoading && issues.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : issues.length === 0 && !searchError ? (
                <div className="text-xs text-muted-foreground text-center p-4">
                  No issues found.
                </div>
              ) : (
                <>
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
                    />
                  )}
                  {issuesBySprint.sprintBuckets.map(({ name, issues: sprintIssues }) => (
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
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

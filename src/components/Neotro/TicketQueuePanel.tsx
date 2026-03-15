import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

interface TicketQueuePanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | undefined;
  queue: TicketQueueItem[];
  onAddTicket: (key: string, summary: string | null) => Promise<void>;
  onRemoveTicket: (id: string) => Promise<void>;
  onReorderQueue: (items: TicketQueueItem[]) => Promise<void>;
  onClearQueue: () => Promise<void>;
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
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-4">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 py-1.5 px-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-background/95 backdrop-blur z-10 hover:bg-muted/50 rounded transition-colors text-left"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
          {name}
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

export const TicketQueuePanel: React.FC<TicketQueuePanelProps> = ({
  isOpen,
  onOpenChange,
  teamId,
  queue,
  onAddTicket,
  onRemoveTicket,
  onReorderQueue,
  onClearQueue,
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
      setCollapsedBuckets(new Set()); // Reset: all expanded on new fetch
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to load issues');
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, searchText, statusFilter, pointsFilter, queue]);

  useEffect(() => {
    if (isOpen && teamId) {
      fetchAllIssues();
    }
  }, [isOpen, teamId, statusFilter, pointsFilter, queue, fetchAllIssues]);

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

  const renderIssue = (issue: JiraIssue) => {
    const alreadyQueued = isInQueue(issue.key);
    const issueContent = (
      <IssueCard
        issue={issue as JiraIssueDisplay}
        rightSlot={
          <Button
            variant={alreadyQueued ? 'secondary' : 'outline'}
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={alreadyQueued || addingKeys.has(issue.key)}
            onClick={(e) => { e.stopPropagation(); handleAddTicket(issue); }}
          >
            {addingKeys.has(issue.key) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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

  return (
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
        <div className="flex flex-col flex-1 min-h-0 p-6 pt-12">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Ticket Queue
          </SheetTitle>
        </SheetHeader>

        <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-h-0">
            <div className="text-xs font-semibold text-muted-foreground mb-2 shrink-0">
              Queue {queue.length > 0 && `(${queue.length})`}
            </div>
            {queue.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                <div>
                  <ListOrdered className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No tickets in queue.</p>
                  <p className="text-xs mt-1">Browse Jira below to add tickets.</p>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-1 pr-2">
                    {queue.map((item, index) => {
                      const enrichedIssue: JiraIssueDisplay = issues.find((i) => i.key === item.ticket_key) ?? {
                        key: item.ticket_key,
                        summary: item.ticket_summary,
                      };
                      const card = (
                        <IssueCard
                          issue={enrichedIssue}
                          leftSlot={<GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
                          rightSlot={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={(e) => { e.stopPropagation(); onRemoveTicket(item.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
                      );
                      return teamId ? (
                        <JiraIssueDrawer key={item.id} issueIdOrKey={item.ticket_key} teamId={teamId} trigger={card} />
                      ) : (
                        <div key={item.id}>{card}</div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="pt-2 pb-4 border-t mt-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={onClearQueue}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Clear Queue
                  </Button>
                </div>
              </>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle className="shrink-0 !h-1 !min-h-1 bg-border" />

          <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-h-0 pt-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2 shrink-0">
              Browse Jira
            </div>
            <div className="shrink-0 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search issues..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && teamId) fetchAllIssues(); }}
                  className="flex-1"
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
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="flex-1 h-8 text-xs">
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
                    <SelectTrigger className="flex-1 h-8 text-xs">
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
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : issues.length === 0 && !searchError ? (
                  <div className="text-sm text-muted-foreground text-center p-4">
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
                        renderIssue={renderIssue}
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
                        renderIssue={renderIssue}
                      />
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
};

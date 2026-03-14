import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Search, Loader2, ListOrdered, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TicketQueueItem } from '@/hooks/useTicketQueue';

interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  priorityIconUrl: string;
  assignee: string | null;
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
  const [activeTab, setActiveTab] = useState('queue');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('not-done');
  const [pointsFilter, setPointsFilter] = useState('any');
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const searchJira = useCallback(async (text?: string) => {
    if (!teamId) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      let apiStatusFilter: string | undefined;
      if (statusFilter === 'not-done') {
        apiStatusFilter = undefined;
      } else if (statusFilter === 'all') {
        apiStatusFilter = 'all';
      } else {
        apiStatusFilter = statusFilter;
      }

      const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
        body: {
          teamId,
          searchText: text ?? searchText,
          statusFilter: apiStatusFilter,
          pointsFilter: pointsFilter !== 'any' ? pointsFilter : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIssues(data.issues || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search Jira');
      setIssues([]);
    } finally {
      setIsSearching(false);
    }
  }, [teamId, searchText, statusFilter, pointsFilter]);

  useEffect(() => {
    if (hasSearched) {
      searchJira();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pointsFilter]);

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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Ticket Queue
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="queue">
              Queue {queue.length > 0 && `(${queue.length})`}
            </TabsTrigger>
            <TabsTrigger value="browse">Browse Jira</TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="flex-1 flex flex-col min-h-0 mt-2">
              {queue.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-8">
                  <div>
                    <ListOrdered className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No tickets in queue.</p>
                    <p className="text-xs mt-1">Browse Jira to add tickets for upcoming rounds.</p>
                  </div>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1">
                    <div className="space-y-1 pr-2">
                      {queue.map((item, index) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={handleDrop}
                          className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 cursor-grab active:cursor-grabbing group"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          {index === 0 && (
                            <Badge variant="default" className="shrink-0 text-xs">
                              Next
                            </Badge>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs text-primary font-semibold">
                              {item.ticket_key}
                            </div>
                            {item.ticket_summary && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.ticket_summary}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => onRemoveTicket(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="pt-3 border-t mt-3">
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
            </div>
          )}

          {/* Browse Tab */}
          {activeTab === 'browse' && (
            <div className="flex-1 flex flex-col min-h-0 mt-2">
              {/* Search bar pinned at top */}
              <div className="shrink-0 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search issues..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchJira()}
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
                    onClick={() => searchJira()}
                    disabled={isSearching}
                    size="icon"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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

              {/* Results area */}
              {!hasSearched && !isSearching && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                  <div>
                    <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Search your Jira backlog.</p>
                    <p className="text-xs mt-1">Press Enter or click search to browse.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => searchJira('')}
                      disabled={isSearching}
                    >
                      Load All Issues
                    </Button>
                  </div>
                </div>
              )}

              {searchError && (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md mt-2">
                  {searchError}
                </div>
              )}

              {hasSearched && !isSearching && !searchError && (
                <ScrollArea className="flex-1 mt-2">
                  <div className="space-y-1 pr-2">
                    {issues.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center p-4">
                        No issues found.
                      </div>
                    ) : (
                      issues.map((issue) => {
                        const alreadyQueued = isInQueue(issue.key);
                        return (
                          <div
                            key={issue.key}
                            className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {issue.issueTypeIconUrl && (
                                  <img src={issue.issueTypeIconUrl} alt={issue.issueType} className="h-4 w-4" />
                                )}
                                <span className="font-mono text-xs text-primary font-semibold">
                                  {issue.key}
                                </span>
                                <Badge
                                  variant={issue.statusCategory === 'done' ? 'default' : 'secondary'}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {issue.status}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">
                                  {issue.storyPoints != null ? `${issue.storyPoints} pts` : '-'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {issue.summary}
                              </div>
                              {issue.assignee && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {issue.assignee}
                                </div>
                              )}
                            </div>
                            <Button
                              variant={alreadyQueued ? 'secondary' : 'outline'}
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              disabled={alreadyQueued || addingKeys.has(issue.key)}
                              onClick={() => handleAddTicket(issue)}
                            >
                              {addingKeys.has(issue.key) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              )}

              {isSearching && (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

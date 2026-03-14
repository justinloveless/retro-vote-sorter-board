import React, { useState, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, Search, Loader2, ListOrdered } from 'lucide-react';
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
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingKeys, setAddingKeys] = useState<Set<string>>(new Set());
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const searchJira = useCallback(async (text?: string) => {
    if (!teamId) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
        body: { teamId, searchText: text ?? searchText },
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
  }, [teamId, searchText]);

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

  // Drag and drop handlers
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

        <Tabs defaultValue="queue" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="queue">
              Queue {queue.length > 0 && `(${queue.length})`}
            </TabsTrigger>
            <TabsTrigger value="browse">Browse Jira</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="flex-1 flex flex-col min-h-0 mt-4">
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
          </TabsContent>

          <TabsContent value="browse" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Search issues..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchJira()}
                className="flex-1"
              />
              <Button
                onClick={() => searchJira()}
                disabled={isSearching}
                size="icon"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {!hasSearched && !isSearching && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center p-8">
                <div>
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Search your Jira backlog to find tickets.</p>
                  <p className="text-xs mt-1">Press Enter or click search to browse issues.</p>
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
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                {searchError}
              </div>
            )}

            {hasSearched && !isSearching && !searchError && (
              <ScrollArea className="flex-1">
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
                            <div className="flex items-center gap-1.5">
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
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {issue.summary}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {issue.assignee && (
                                <span className="text-[10px] text-muted-foreground">
                                  {issue.assignee}
                                </span>
                              )}
                              {issue.storyPoints != null && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {issue.storyPoints} pts
                                </Badge>
                              )}
                            </div>
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
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScanSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    nickname?: string | null;
  } | null;
}

interface RetroItem {
  id: string;
  text: string;
  column_id?: string | null;
  [key: string]: any;
}

interface MentionMatch {
  itemId: string;
  itemText: string;
  memberName: string;
  memberId: string;
  displayName: string; // nickname or full_name used in the mention tag
  columnTitle: string;
}

interface MentionScannerProps {
  items: RetroItem[];
  columns: { id: string; title: string }[];
  teamMembers: TeamMember[];
  onUpdateItem: (itemId: string, text: string) => void;
}

export const MentionScanner: React.FC<MentionScannerProps> = ({
  items,
  columns,
  teamMembers,
  onUpdateItem,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Build search terms for each member: full name, first name, nickname
  const memberSearchTerms = useMemo(() => {
    const terms: { term: string; memberId: string; displayName: string; fullName: string }[] = [];
    for (const member of teamMembers) {
      const fullName = member.profiles?.full_name;
      const nickname = member.profiles?.nickname;
      if (!fullName) continue;

      const addedTerms = new Set<string>();

      // Full name (highest priority)
      addedTerms.add(fullName.toLowerCase());
      terms.push({ term: fullName, memberId: member.user_id, displayName: nickname || fullName, fullName });

      // Individual name parts (first name, last name, etc.) — only if 2+ chars
      const nameParts = fullName.split(/\s+/).filter(p => p.length >= 2);
      for (const part of nameParts) {
        if (!addedTerms.has(part.toLowerCase())) {
          addedTerms.add(part.toLowerCase());
          terms.push({ term: part, memberId: member.user_id, displayName: nickname || fullName, fullName });
        }
      }

      // Nickname
      if (nickname && !addedTerms.has(nickname.toLowerCase())) {
        addedTerms.add(nickname.toLowerCase());
        terms.push({ term: nickname, memberId: member.user_id, displayName: nickname, fullName });
      }
    }
    // Sort by term length descending so longer matches are found first
    terms.sort((a, b) => b.term.length - a.term.length);
    return terms;
  }, [teamMembers]);

  // Scan items for raw name strings that aren't already mentions
  const matches = useMemo(() => {
    if (!open) return [];
    const found: MentionMatch[] = [];

    for (const item of items) {
      // Strip existing mentions from text before scanning
      const textWithoutMentions = item.text.replace(/\[\[mention:[^\]]+\]\]/g, '');
      // Also strip mention spans (HTML format)
      const cleanText = textWithoutMentions.replace(/<span[^>]*data-mention-id="[^"]*"[^>]*>[^<]*<\/span>/g, '')
        // Strip remaining HTML tags for matching
        .replace(/<[^>]+>/g, '');

      if (!cleanText.trim()) continue;

      for (const { term, memberId, displayName, fullName } of memberSearchTerms) {
        // Case-insensitive search — no word boundary requirement so partial names match within strings
        const regex = new RegExp(escapeRegex(term), 'gi');
        if (regex.test(cleanText)) {
          // Avoid duplicate item+member combos for the same matched term
          const existingMatch = found.find(f => f.itemId === item.id && f.memberId === memberId);
          if (!existingMatch) {
            const col = columns.find(c => c.id === item.column_id);
            found.push({
              itemId: item.id,
              itemText: item.text,
              memberName: term,
              memberId,
              displayName,
              columnTitle: col?.title || 'Unknown',
            });
          }
        }
      }
    }

    return found;
  }, [open, items, memberSearchTerms, columns]);

  // Select all by default when matches change
  React.useEffect(() => {
    if (open && matches.length > 0) {
      setSelectedMatches(new Set(matches.map(m => `${m.itemId}:${m.memberId}`)));
    }
  }, [open, matches]);

  const toggleMatch = (key: string) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedMatches.size === matches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(matches.map(m => `${m.itemId}:${m.memberId}`)));
    }
  };

  const handleReplace = () => {
    // Group selected matches by item
    const byItem = new Map<string, MentionMatch[]>();
    for (const match of matches) {
      const key = `${match.itemId}:${match.memberId}`;
      if (!selectedMatches.has(key)) continue;
      if (!byItem.has(match.itemId)) byItem.set(match.itemId, []);
      byItem.get(match.itemId)!.push(match);
    }

    let replacedCount = 0;
    for (const [itemId, itemMatches] of byItem) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;

      let newText = item.text;
      for (const match of itemMatches) {
        const mentionTag = `[[mention:${match.memberId}:${match.displayName}]]`;
        // Replace the raw name with the mention tag (case-insensitive, first occurrence not already in a mention)
        const regex = new RegExp(`(?<![\\w@])${escapeRegex(match.memberName)}(?![\\w])`, 'gi');
        newText = newText.replace(regex, mentionTag);
        replacedCount++;
      }

      if (newText !== item.text) {
        onUpdateItem(itemId, newText);
      }
    }

    toast({
      title: 'Mentions replaced',
      description: `Replaced ${replacedCount} name${replacedCount !== 1 ? 's' : ''} with mention tags.`,
    });
    setOpen(false);
  };

  // Highlight the matched name in the item text for preview
  const highlightMatch = (text: string, name: string) => {
    // Strip HTML for preview display
    const plainText = text.replace(/<[^>]+>/g, '').replace(/\[\[mention:[^\]]+\]\]/g, (m) => {
      const parts = m.match(/\[\[mention:([^:]+):([^\]]+)\]\]/);
      return parts ? `@${parts[2]}` : m;
    });
    const truncated = plainText.length > 120 ? plainText.slice(0, 120) + '…' : plainText;
    
    const regex = new RegExp(`(${escapeRegex(name)})`, 'gi');
    const parts = truncated.split(regex);
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5 font-semibold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Scan for names to convert to mentions">
          <ScanSearch className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace Names with Mentions</DialogTitle>
        </DialogHeader>

        {matches.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">
            No unlinked team member names found in retro items.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={selectedMatches.size === matches.length}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all ({matches.length} match{matches.length !== 1 ? 'es' : ''})
              </label>
            </div>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {matches.map((match) => {
                  const key = `${match.itemId}:${match.memberId}`;
                  return (
                    <div key={key} className="flex gap-2 items-start p-2 rounded-md border bg-card">
                      <Checkbox
                        checked={selectedMatches.has(key)}
                        onCheckedChange={() => toggleMatch(key)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          <span className="font-medium">{match.columnTitle}</span>
                          {' · '}
                          <span className="text-primary font-medium">{match.memberName}</span>
                          {' → '}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                            @{match.displayName}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 truncate">
                          {highlightMatch(match.itemText, match.memberName)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          {matches.length > 0 && (
            <Button onClick={handleReplace} disabled={selectedMatches.size === 0}>
              Replace {selectedMatches.size} match{selectedMatches.size !== 1 ? 'es' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Loader2, Plus, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  buildLinkTypeOptions,
  looksLikeJiraIssueKey,
  type JiraIssueLinkDisplay,
  type JiraLinkTypeOption,
  type JiraLinkTypeRaw,
} from '@/lib/jiraIssueLinks';

const statusColorMap: Record<string, string> = {
  'blue-gray': 'bg-muted text-muted-foreground',
  'yellow': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'green': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'medium-gray': 'bg-muted text-muted-foreground',
};

function statusBadgeClassName(colorName?: string): string {
  if (!colorName) return 'bg-muted text-muted-foreground';
  return statusColorMap[colorName] || 'bg-muted text-muted-foreground';
}

interface JiraIssueLinksSectionProps {
  teamId: string | null;
  issueKey: string | null;
  jiraDomain?: string;
  links: JiraIssueLinkDisplay[];
  linkTypes: JiraLinkTypeRaw[];
  canEdit: boolean;
  noApiCredentials: boolean;
  /** Container for the popover so it renders inside the dialog and isn't scroll-locked. */
  portalContainer?: HTMLElement | null;
  /** Called after a successful add/remove so the parent can refresh the issue. */
  onLinksChanged: () => void | Promise<void>;
}

interface IssuePreview {
  key: string;
  summary: string;
  status?: { name: string; colorName?: string };
  issueTypeIconUrl?: string;
  issueTypeName?: string;
}

export function JiraIssueLinksSection({
  teamId,
  issueKey,
  jiraDomain,
  links,
  linkTypes,
  canEdit,
  noApiCredentials,
  portalContainer,
  onLinksChanged,
}: JiraIssueLinksSectionProps) {
  const { toast } = useToast();

  const linkTypeOptions = useMemo<JiraLinkTypeOption[]>(
    () => buildLinkTypeOptions(linkTypes),
    [linkTypes],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>('');
  const [targetKeyDraft, setTargetKeyDraft] = useState('');
  const [preview, setPreview] = useState<IssuePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset transient state when the popover closes.
  useEffect(() => {
    if (!addOpen) {
      setTargetKeyDraft('');
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
    }
  }, [addOpen]);

  // Default link type selection once options arrive.
  useEffect(() => {
    if (!selectedOptionKey && linkTypeOptions.length > 0) {
      // Prefer "relates to" as a sensible default when present.
      const relates = linkTypeOptions.find((o) => /^relates(\s|$)/i.test(o.label));
      setSelectedOptionKey((relates ?? linkTypeOptions[0]).key);
    }
  }, [linkTypeOptions, selectedOptionKey]);

  const selectedOption = useMemo<JiraLinkTypeOption | undefined>(
    () => linkTypeOptions.find((o) => o.key === selectedOptionKey),
    [linkTypeOptions, selectedOptionKey],
  );

  // Debounced preview lookup. `get-jira-issue` is reused here so we don't need a new search endpoint.
  const previewSeqRef = useRef(0);
  useEffect(() => {
    if (!addOpen) return;
    const trimmed = targetKeyDraft.trim();
    setPreviewError(null);
    if (!trimmed) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    if (!looksLikeJiraIssueKey(trimmed)) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError('Enter a full issue key (e.g. PROJ-123)');
      return;
    }
    if (!teamId) return;

    const seq = ++previewSeqRef.current;
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-jira-issue', {
          body: { issueIdOrKey: trimmed, teamId },
        });
        if (seq !== previewSeqRef.current) return;
        if (error || data?.error) {
          setPreview(null);
          setPreviewError("Couldn't find that issue. Check the key.");
          return;
        }
        const fields = data?.fields ?? {};
        setPreview({
          key: String(data?.key ?? trimmed.toUpperCase()),
          summary: String(fields?.summary ?? ''),
          status: fields?.status?.name
            ? {
                name: String(fields.status.name),
                colorName: fields.status.statusCategory?.colorName
                  ? String(fields.status.statusCategory.colorName)
                  : undefined,
              }
            : undefined,
          issueTypeIconUrl: fields?.issuetype?.iconUrl ? String(fields.issuetype.iconUrl) : undefined,
          issueTypeName: fields?.issuetype?.name ? String(fields.issuetype.name) : undefined,
        });
      } catch {
        if (seq !== previewSeqRef.current) return;
        setPreview(null);
        setPreviewError("Couldn't load the issue.");
      } finally {
        if (seq === previewSeqRef.current) setPreviewLoading(false);
      }
    }, 320);
    return () => clearTimeout(handle);
  }, [addOpen, targetKeyDraft, teamId]);

  const handleCreate = async () => {
    if (!teamId || !issueKey || !selectedOption) return;
    const target = targetKeyDraft.trim();
    if (!target) return;
    if (!looksLikeJiraIssueKey(target)) {
      setPreviewError('Enter a full issue key (e.g. PROJ-123)');
      return;
    }
    if (target.toUpperCase() === issueKey.toUpperCase()) {
      toast({
        title: "Can't link an issue to itself",
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-jira-issue-link', {
        body: {
          action: 'create',
          teamId,
          issueKey,
          targetIssueKey: target,
          linkTypeName: selectedOption.typeName,
          direction: selectedOption.direction,
        },
      });
      if (error || data?.error) {
        const msg = (data?.error as string | undefined) ?? error?.message ?? 'Failed to link issue.';
        toast({ title: 'Could not link issue', description: msg, variant: 'destructive' });
        return;
      }
      setAddOpen(false);
      await onLinksChanged();
    } finally {
      setSaving(false);
    }
  };

  // Group links by relationship label so e.g. all "blocks" links appear together (matches Jira UX).
  const grouped = useMemo(() => {
    const map = new Map<string, JiraIssueLinkDisplay[]>();
    for (const link of links) {
      const list = map.get(link.relationshipLabel) ?? [];
      list.push(link);
      map.set(link.relationshipLabel, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }, [links]);

  const showAddButton = canEdit && !noApiCredentials && linkTypeOptions.length > 0;

  if (links.length === 0 && !showAddButton) {
    // Nothing to show and no way to add — hide the section entirely.
    return null;
  }

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Linked work items ({links.length})
            </p>
          </div>
          {showAddButton && (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs"
                  disabled={saving}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Link issue
                </Button>
              </PopoverTrigger>
              <PopoverContent
                container={portalContainer ?? undefined}
                className="w-[min(100vw-2rem,340px)] p-3 space-y-2.5"
                align="end"
              >
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Relationship</p>
                  <Select value={selectedOptionKey} onValueChange={setSelectedOptionKey}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select a relationship" />
                    </SelectTrigger>
                    <SelectContent container={portalContainer ?? undefined}>
                      {linkTypeOptions.map((opt) => (
                        <SelectItem key={opt.key} value={opt.key} className="text-sm">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Issue key</p>
                  <Input
                    autoFocus
                    placeholder="PROJ-123"
                    value={targetKeyDraft}
                    onChange={(e) => setTargetKeyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && preview && !saving) {
                        e.preventDefault();
                        void handleCreate();
                      }
                    }}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                  <div className="min-h-[36px]">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Looking up issue…
                      </div>
                    ) : previewError ? (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{previewError}</span>
                      </div>
                    ) : preview ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1.5 text-xs">
                        {preview.issueTypeIconUrl ? (
                          <img
                            src={preview.issueTypeIconUrl}
                            alt={preview.issueTypeName ?? ''}
                            className="h-3.5 w-3.5 shrink-0"
                          />
                        ) : null}
                        <span className="font-mono font-medium text-foreground shrink-0">{preview.key}</span>
                        <span className="text-muted-foreground truncate">{preview.summary}</span>
                        {preview.status?.name && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-[10px] py-0 px-1.5',
                              statusBadgeClassName(preview.status.colorName),
                            )}
                          >
                            {preview.status.name}
                          </Badge>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleCreate()}
                    disabled={saving || !preview || !selectedOption}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Link'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No linked work items.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([label, group]) => (
              <div key={label} className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground capitalize">{label}</p>
                <ul className="space-y-1">
                  {group.map((link) => {
                    const href = jiraDomain ? `${jiraDomain}/browse/${link.issue.key}` : null;
                    const colorName = link.issue.status?.statusCategory?.colorName;
                    const rowClassName = cn(
                      'flex items-center gap-2 rounded-md border bg-card/50 px-2 py-1.5 text-sm',
                      href && 'transition-colors hover:bg-muted/50',
                    );
                    const rowContent = (
                      <>
                        {link.issue.issuetype?.iconUrl ? (
                          <img
                            src={link.issue.issuetype.iconUrl}
                            alt={link.issue.issuetype.name}
                            className="h-4 w-4 shrink-0"
                          />
                        ) : null}
                        <span className="font-mono text-xs font-medium text-primary shrink-0">
                          {link.issue.key}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-sm text-foreground"
                          title={link.issue.summary}
                        >
                          {link.issue.summary || <span className="text-muted-foreground italic">No summary</span>}
                        </span>
                        {link.issue.status?.name && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-[10px] py-0 px-1.5',
                              statusBadgeClassName(colorName),
                            )}
                          >
                            {link.issue.status.name}
                          </Badge>
                        )}
                      </>
                    );
                    return (
                      <li key={link.id}>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={rowClassName}
                            title={`Open ${link.issue.key} in Jira`}
                          >
                            {rowContent}
                          </a>
                        ) : (
                          <div className={rowClassName}>{rowContent}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

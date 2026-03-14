import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { ChevronDown, ExternalLink, Loader2, User, AlertCircle, Tag, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface JiraIssueFields {
  summary: string;
  description: string | null;
  status?: { name: string; statusCategory?: { colorName: string } };
  priority?: { name: string; iconUrl?: string };
  assignee?: { displayName: string; avatarUrls?: Record<string, string> } | null;
  reporter?: { displayName: string; avatarUrls?: Record<string, string> } | null;
  issuetype?: { name: string; iconUrl?: string };
  labels?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface JiraIssueData {
  key: string;
  fields: JiraIssueFields;
  shouldUseIframe: boolean;
  domain?: string;
}

interface JiraIssueDrawerProps {
  issueIdOrKey: string | null;
  teamId: string | null;
}

const statusColorMap: Record<string, string> = {
  'blue-gray': 'bg-muted text-muted-foreground',
  'yellow': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'green': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'medium-gray': 'bg-muted text-muted-foreground',
};

function getStoryPoints(fields: JiraIssueFields): number | null {
  const pointFields = ['story_points', 'customfield_10016', 'customfield_10028', 'customfield_10004'];
  for (const field of pointFields) {
    if (fields[field] != null) return fields[field];
  }
  return null;
}

/**
 * Parse Jira wiki markup to React elements.
 * Handles: *bold*, h1.-h6. headers, # ordered lists, * unordered lists,
 * {panel:bgColor=...}...{panel} blocks, and {color}...{color} inline.
 */
function parseJiraWikiMarkup(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  // First, split by {panel} blocks
  const panelRegex = /\{panel(?::([^}]*))?\}([\s\S]*?)\{panel\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const segments: { type: 'text' | 'panel'; content: string; attrs?: string }[] = [];

  while ((match = panelRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'panel', content: match[2], attrs: match[1] || '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  segments.forEach((segment, segIdx) => {
    if (segment.type === 'panel') {
      // Extract bgColor from attrs like "bgColor=#fffae6"
      const bgMatch = segment.attrs?.match(/bgColor=([#\w]+)/);
      const bgColor = bgMatch ? bgMatch[1] : undefined;
      nodes.push(
        <Card
          key={`panel-${segIdx}`}
          className="my-3 p-4 border"
          style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
          <div className="text-sm text-foreground">{parseLines(segment.content)}</div>
        </Card>
      );
    } else {
      nodes.push(...parseLines(segment.content, segIdx));
    }
  });

  return nodes;
}

function parseLines(text: string, keyPrefix: number | string = 0): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headers: h1. h2. h3. etc
    const headerMatch = line.match(/^h([1-6])\.\s*(.*)/);
    if (headerMatch) {
      const level = parseInt(headerMatch[1]);
      const content = parseInline(headerMatch[2]);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      const sizeClass = level === 1 ? 'text-xl font-bold' : level === 2 ? 'text-lg font-semibold' : level === 3 ? 'text-base font-semibold' : 'text-sm font-semibold';
      nodes.push(
        <Tag key={`${keyPrefix}-h-${i}`} className={`${sizeClass} text-foreground mt-3 mb-1`}>
          {content}
        </Tag>
      );
      i++;
      continue;
    }

    // Ordered list: lines starting with # (or ## for nested)
    if (/^#\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^#\s/.test(lines[i].trimEnd())) {
        listItems.push(
          <li key={`${keyPrefix}-ol-${i}`} className="text-sm text-foreground">
            {parseInline(lines[i].trimEnd().replace(/^#\s*/, ''))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ol key={`${keyPrefix}-ol-group-${i}`} className="list-decimal list-inside my-2 space-y-1">
          {listItems}
        </ol>
      );
      continue;
    }

    // Unordered list: lines starting with *  (but not bold markers like *text*)
    if (/^\*\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\*\s/.test(lines[i].trimEnd())) {
        listItems.push(
          <li key={`${keyPrefix}-ul-${i}`} className="text-sm text-foreground">
            {parseInline(lines[i].trimEnd().replace(/^\*\s*/, ''))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={`${keyPrefix}-ul-group-${i}`} className="list-disc list-inside my-2 space-y-1">
          {listItems}
        </ul>
      );
      continue;
    }

    // Regular line
    nodes.push(
      <p key={`${keyPrefix}-p-${i}`} className="text-sm text-foreground my-1">
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

/** Parse inline markup: *bold*, _italic_, {{monospace}}, [links], {color} */
function parseInline(text: string): React.ReactNode {
  // Remove {color:...}...{color} wrappers but keep content
  let cleaned = text.replace(/\{color:[^}]*\}/g, '').replace(/\{color\}/g, '');

  // Split by bold markers *text*
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*([^*]+)\*/g;
  let lastIdx = 0;
  let inlineMatch: RegExpExecArray | null;

  while ((inlineMatch = boldRegex.exec(cleaned)) !== null) {
    if (inlineMatch.index > lastIdx) {
      parts.push(cleaned.slice(lastIdx, inlineMatch.index));
    }
    parts.push(<strong key={`b-${inlineMatch.index}`}>{inlineMatch[1]}</strong>);
    lastIdx = inlineMatch.index + inlineMatch[0].length;
  }
  if (lastIdx < cleaned.length) {
    parts.push(cleaned.slice(lastIdx));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderDescription(description: string | null): React.ReactNode {
  if (!description) return <p className="text-sm text-muted-foreground italic">No description provided.</p>;

  // If it looks like HTML, render it
  if (description.startsWith('<') || description.includes('<p>') || description.includes('<br')) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    );
  }

  // Parse Jira wiki markup
  return <div className="space-y-1">{parseJiraWikiMarkup(description)}</div>;
}

export const JiraIssueDrawer: React.FC<JiraIssueDrawerProps> = ({ issueIdOrKey, teamId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [issueData, setIssueData] = useState<JiraIssueData | null>(null);
  const [jiraDomain, setJiraDomain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [noApiCredentials, setNoApiCredentials] = useState(false);

  const handleShowIssue = async () => {
    setIsLoading(true);
    setError(null);
    setIssueData(null);
    setNoApiCredentials(false);

    if (!issueIdOrKey || !teamId) {
      setError("Ticket number or Team ID is missing.");
      setIsOpen(true);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-jira-issue', {
        body: { issueIdOrKey, teamId },
      });

      if (invokeError) throw new Error(`Function invocation failed: ${invokeError.message}`);
      if (data.error) throw new Error(data.error);

      if (data.shouldUseIframe) {
        setJiraDomain(data.domain);
        setNoApiCredentials(true);
        setIsOpen(true);
      } else {
        setIssueData(data);
        setJiraDomain(data.domain || null);
        setIsOpen(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const externalUrl = jiraDomain && (issueData?.key || issueIdOrKey)
    ? `${jiraDomain}/browse/${issueData?.key || issueIdOrKey}`
    : null;
  const fields = issueData?.fields;
  const storyPoints = fields ? getStoryPoints(fields) : null;
  const statusColor = fields?.status?.statusCategory?.colorName
    ? statusColorMap[fields.status.statusCategory.colorName] || 'bg-muted text-muted-foreground'
    : 'bg-muted text-muted-foreground';

  return (
    <>
      <Button variant="outline" className="w-full" onClick={handleShowIssue} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ChevronDown className="h-4 w-4 mr-2" />
        )}
        Show Jira Issue
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[50vw] max-h-[70vh] overflow-y-auto top-[40%]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-lg">
                {issueData?.key || issueIdOrKey || 'Jira Issue'}
              </DialogTitle>
              {externalUrl && (
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Jira
                  </Button>
                </a>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-5">
            {/* Error state */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* No API credentials fallback */}
            {noApiCredentials && (
              <div className="space-y-3 text-center py-6">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Jira API credentials are not configured for this team. Configure them in Team Settings to view issue details inline.
                </p>
                {externalUrl && (
                  <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="default" className="gap-2 mt-2">
                      <ExternalLink className="h-4 w-4" />
                      Open in Jira
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Issue details */}
            {fields && (
              <>
                <h2 className="text-base font-semibold text-foreground leading-snug">
                  {fields.summary}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {fields.status && (
                    <Badge variant="secondary" className={`${statusColor} text-xs`}>
                      {fields.status.name}
                    </Badge>
                  )}
                  {fields.issuetype && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {fields.issuetype.iconUrl && (
                        <img src={fields.issuetype.iconUrl} alt="" className="h-4 w-4" />
                      )}
                      <span>{fields.issuetype.name}</span>
                    </div>
                  )}
                  {fields.priority && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {fields.priority.iconUrl && (
                        <img src={fields.priority.iconUrl} alt="" className="h-4 w-4" />
                      )}
                      <span>{fields.priority.name}</span>
                    </div>
                  )}
                  {storyPoints != null && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Layers className="h-3 w-3" />
                      {storyPoints} pts
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* People */}
                <div className="grid grid-cols-2 gap-3">
                  {fields.assignee && (
                    <div className="flex items-center gap-2">
                      {fields.assignee.avatarUrls?.['24x24'] ? (
                        <img src={fields.assignee.avatarUrls['24x24']} alt="" className="h-5 w-5 rounded-full" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assignee</p>
                        <p className="text-sm text-foreground">{fields.assignee.displayName}</p>
                      </div>
                    </div>
                  )}
                  {fields.reporter && (
                    <div className="flex items-center gap-2">
                      {fields.reporter.avatarUrls?.['24x24'] ? (
                        <img src={fields.reporter.avatarUrls['24x24']} alt="" className="h-5 w-5 rounded-full" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reporter</p>
                        <p className="text-sm text-foreground">{fields.reporter.displayName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Labels */}
                {fields.labels && fields.labels.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Labels</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {fields.labels.map((label) => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Description */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Description</p>
                  {renderDescription(fields.description)}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

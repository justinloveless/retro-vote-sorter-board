import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronDown, Copy, ExternalLink, Loader2, Plus, User, AlertCircle, Tag, Layers, MessageSquare, Settings, Pencil, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getStoryPointsFromJiraFields } from '@/lib/jiraStoryPoints';
import { parentBadgeClassName } from '@/lib/parentBadgeTone';
import { broadcastPokerSessionJiraStoryPoints } from '@/lib/pokerJiraStoryPointsBroadcast';
import { getSprintBucketFromIssueFields } from '@/lib/jiraSprintFromFields';
import {
  buildSprintPickerDataFromCacheAndIssue,
  getCachedTeamSprintPickerOptions,
  setCachedTeamSprintPickerOptions,
  type SprintPickerData,
} from '@/lib/jiraSprintOptionsCache';
import {
  getCachedIssueFieldOptions,
  setCachedIssueFieldOptions,
  type JiraFieldOptionsPayload,
} from '@/lib/jiraIssueFieldOptionsCache';
import { cn } from '@/lib/utils';
import { jiraAtlaskitIntlMessages } from '@/lib/jiraAtlaskitIntlMessages';
import { ensurePanelContrast } from '@/lib/jiraWiki/panelColors';
import { stripHtmlForWikiParse } from '@/lib/jiraWiki/htmlStrip';
import { segmentJiraWikiTopLevel, normalizeDescriptionForEdit, canEditDescriptionRichly, adfToWikiMarkup } from '@/lib/jiraWiki/segmentWiki';
import { JiraIssueWikiEditor } from '@/components/Neotro/JiraIssueWikiEditor';
import { AtlaskitDescriptionEditor } from '@/components/Neotro/AtlaskitDescriptionEditor';
import type { AtlaskitDescriptionEditorHandle } from '@/components/Neotro/AtlaskitDescriptionEditor';
import { SmartCardProvider, CardClient } from '@atlaskit/link-provider';
import { IntlProvider } from 'react-intl-next';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Markdown } from '@/components/ui/markdown';

/** Popover + cmdk: Radix ScrollArea for lists; pair with `container={jiraDialogPortalContainer}` on popovers inside the Jira dialog so wheel scroll is not blocked by modal scroll-lock. */
const jiraPopoverListScrollClass = 'h-[min(60vh,320px)]';

// Context to allow images inside parsed markup to open a shared preview dialog
const ImagePreviewContext = React.createContext<((src: string) => void) | null>(null);

// Context to resolve Jira account IDs to display names
const JiraUserMapContext = React.createContext<Map<string, string>>(new Map());

function ClickableImage({ src, alt, maxWidth }: { src: string; alt: string; maxWidth?: number }) {
  const openPreview = React.useContext(ImagePreviewContext);
  return (
    <img
      src={src}
      alt={alt}
      className="my-2 rounded-lg border max-w-full cursor-pointer hover:opacity-80 transition-opacity"
      style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
      onClick={(e) => { e.stopPropagation(); openPreview?.(src); }}
    />
  );
}

function JiraMention({ accountId }: { accountId: string }) {
  const userMap = React.useContext(JiraUserMapContext);
  const displayName = userMap.get(accountId) || accountId;
  // If it looks like an accountId (long alphanumeric), show a generic label if not found
  const label = userMap.has(accountId) ? displayName : (accountId.length > 20 ? 'user' : accountId);
  return (
    <span className={cn(badgeVariants({ variant: 'secondary' }), 'text-xs font-normal px-1.5 py-0')}>
      @{label}
    </span>
  );
}

interface JiraAttachment {
  filename: string;
  content: string; // URL to the attachment content
}

interface JiraComment {
  id: string;
  author: { displayName: string; avatarUrls?: Record<string, string> };
  /** Jira API v2: wiki/HTML string; v3: often Atlassian Document Format (object). */
  body: string | unknown;
  created: string;
  updated: string;
}

interface JiraIssueFields {
  summary: string;
  description: unknown;
  created?: string;
  status?: { name: string; statusCategory?: { colorName: string } };
  priority?: { name: string; iconUrl?: string };
  assignee?: { displayName: string; avatarUrls?: Record<string, string> } | null;
  reporter?: { displayName: string; avatarUrls?: Record<string, string> } | null;
  issuetype?: { name: string; iconUrl?: string };
  /** Present when the issue is under a parent (same shape as Jira browse lists). */
  parent?: { key: string; fields?: { summary?: string } } | null;
  labels?: string[];
  comment?: { comments: JiraComment[]; total: number };
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
  /** When set (poker table), story point saves broadcast to this session so all clients update immediately. */
  pokerSessionId?: string | null;
  /** Custom trigger element; when provided, clicking it opens the preview instead of the default button */
  trigger?: React.ReactElement;
  /** After creating a clone (or external create flow), optional hook to add the new ticket to the poker session. */
  onIssueCreated?: (issueKey: string, summary: string) => void | Promise<unknown>;
  /**
   * Spotlight browse preview: show "Add to rounds" until the user commits; parent removes the tentative round on close if still uncommitted.
   */
  spotlightBrowseRoundActions?: { committed: boolean; onCommitToRounds: () => void } | null;
  /**
   * When set, the drawer opens in preview mode: no Jira fetch; stub data is shown instead.
   * Title and description are editable; changes stay local until onCreateInJira fires.
   */
  previewIssue?: { summary: string; description: string | Record<string, unknown> } | null;
  /** Controlled open state (required when using previewIssue). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Replaces "Open in Jira" with a "Create in Jira" primary action button when set. */
  onCreateInJira?: (opts: { summary: string; description: string | Record<string, unknown> }) => void | Promise<void>;
  createInJiraLoading?: boolean;
}

function formatJiraDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatJiraDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return dateStr;
  }
}

const statusColorMap: Record<string, string> = {
  'blue-gray': 'bg-muted text-muted-foreground',
  'yellow': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'green': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'medium-gray': 'bg-muted text-muted-foreground',
};

/**
 * Parse Jira wiki markup to React elements.
 * Handles: *bold*, {{inline code}}, h1.-h6. headers, # ordered lists, * unordered lists,
 * {panel:bgColor=...}...{panel} blocks, {noformat}...{noformat} code blocks,
 * !image.png|opts! images, and {color}...{color} inline.
 */
function parseJiraWikiMarkup(text: string, attachments?: JiraAttachment[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  if (typeof text !== 'string') {
    return [
      <p key="parse-non-string" className="text-sm text-muted-foreground italic">
        Unsupported text format.
      </p>,
    ];
  }

  // Normalize line endings and trim
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const segments = segmentJiraWikiTopLevel(normalized);

  segments.forEach((segment, segIdx) => {
    if (segment.type === 'panel') {
      const bgMatch = segment.attrs?.match(/bgColor=([#\w]+)/);
      const bgColor = bgMatch ? bgMatch[1] : undefined;
      const titleMatch = segment.attrs?.match(/(?:^|[|])title=([^|]+)/);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      nodes.push(
        <Card
          key={`panel-${segIdx}`}
          className="my-3 border overflow-hidden"
          style={bgColor ? { backgroundColor: ensurePanelContrast(bgColor) } : undefined}
        >
          {title && (
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={title ? 'p-3 pt-0' : 'p-4'}>
            <div className="text-sm text-foreground">{parseJiraWikiMarkup(segment.content, attachments)}</div>
          </CardContent>
        </Card>
      );
    } else if (segment.type === 'code') {
      nodes.push(
        <pre
          key={`code-${segIdx}`}
          className="my-3 p-4 rounded-lg bg-muted text-foreground text-xs font-mono overflow-x-auto border whitespace-pre-wrap break-words"
        >
          <code>{segment.content.replace(/^\n/, '')}</code>
        </pre>
      );
    } else {
      nodes.push(...parseLines(segment.content, segIdx, attachments));
    }
  });

  return nodes;
}

interface ListItemNode {
  level: number;
  content: React.ReactNode;
  children: ListItemNode[];
}

function collectListItems(
  lines: string[],
  startI: number,
  pattern: RegExp,
  stripPrefix: (line: string) => string,
  attachments?: JiraAttachment[],
  keyPrefix: number | string = 0
): { items: ListItemNode[]; nextI: number } {
  const items: ListItemNode[] = [];
  const stack: { node: ListItemNode; level: number }[] = [];
  let i = startI;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const match = line.match(pattern);
    if (!match) break;

    const level = match[1].length;
    const content = parseInline(stripPrefix(line), attachments);
    const node: ListItemNode = { level, content, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      items.push(node);
      stack.push({ node, level });
    } else {
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, level });
    }
    i++;
  }

  return { items, nextI: i };
}

const ORDERED_LIST_STYLES: Record<number, string> = {
  1: 'list-decimal',
  2: 'list-[lower-alpha]',
  3: 'list-[lower-roman]',
};

function renderNestedOrderedList(items: ListItemNode[], keyPrefix: number | string, baseKey: number): React.ReactNode {
  const listStyle = (level: number) => ORDERED_LIST_STYLES[level] || 'list-[lower-alpha]';
  const render = (nodes: ListItemNode[], level: number, key: string): React.ReactNode => (
    <ol key={key} className={`${listStyle(level)} list-inside my-1 ml-4 space-y-1`}>
      {nodes.map((item, idx) => (
        <li key={`${key}-${idx}`} className="text-sm text-foreground">
          {item.content}
          {item.children.length > 0 && render(item.children, level + 1, `${key}-${idx}-sub`)}
        </li>
      ))}
    </ol>
  );
  return (
    <ol key={`${keyPrefix}-ol-group-${baseKey}`} className="list-decimal list-inside my-2 space-y-1">
      {items.map((item, idx) => (
        <li key={`${keyPrefix}-ol-${baseKey}-${idx}`} className="text-sm text-foreground">
          {item.content}
          {item.children.length > 0 && render(item.children, 2, `${keyPrefix}-ol-${baseKey}-${idx}`)}
        </li>
      ))}
    </ol>
  );
}

function renderNestedUnorderedList(items: ListItemNode[], keyPrefix: number | string, baseKey: number): React.ReactNode {
  const render = (nodes: ListItemNode[], key: string): React.ReactNode => (
    <ul key={key} className="list-disc list-inside my-1 ml-4 space-y-1">
      {nodes.map((item, idx) => (
        <li key={`${key}-${idx}`} className="text-sm text-foreground">
          {item.content}
          {item.children.length > 0 && render(item.children, `${key}-${idx}-sub`)}
        </li>
      ))}
    </ul>
  );
  return (
    <ul key={`${keyPrefix}-ul-group-${baseKey}`} className="list-disc list-inside my-2 space-y-1">
      {items.map((item, idx) => (
        <li key={`${keyPrefix}-ul-${baseKey}-${idx}`} className="text-sm text-foreground">
          {item.content}
          {item.children.length > 0 && render(item.children, `${keyPrefix}-ul-${baseKey}-${idx}`)}
        </li>
      ))}
    </ul>
  );
}

function parseLines(text: string, keyPrefix: number | string = 0, attachments?: JiraAttachment[]): React.ReactNode[] {
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
      const content = parseInline(headerMatch[2], attachments);
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

    // Ordered list (supports #, ##, ### for nested)
    const olMatch = line.match(/^(#+)\s+(.*)$/);
    if (olMatch) {
      const { items, nextI } = collectListItems(lines, i, /^(#+)\s/, (raw) => raw.replace(/^#+\s*/, ''), attachments, keyPrefix);
      i = nextI;
      nodes.push(renderNestedOrderedList(items, keyPrefix, i));
      continue;
    }

    // Unordered list (supports *, **, *** for nested)
    const ulMatch = line.match(/^(\*+)\s+(.*)$/);
    if (ulMatch) {
      const { items, nextI } = collectListItems(lines, i, /^(\*+)\s/, (raw) => raw.replace(/^\*+\s*/, ''), attachments, keyPrefix);
      i = nextI;
      nodes.push(renderNestedUnorderedList(items, keyPrefix, i));
      continue;
    }

    // Regular line — use div (not p) so inline parse may include span-badges, images, etc. without invalid nesting
    nodes.push(
      <div key={`${keyPrefix}-p-${i}`} role="paragraph" className="text-sm text-foreground my-1">
        {parseInline(line, attachments)}
      </div>
    );
    i++;
  }

  return nodes;
}

/** Parse inline markup: *bold*, _italic_, -strikethrough-, {{inline code}}, [text|url], !image!, {color} */
function parseInline(text: string, attachments?: JiraAttachment[]): React.ReactNode {
  // Remove {color:...}...{color} wrappers but keep content, and resolve [~accountid:xxx] mentions
  const cleaned = text.replace(/\{color:[^}]*\}/g, '').replace(/\{color\}/g, '');

  /**
   * Jira sometimes renders bare `text|https://url` as a link (no brackets).
   * We support that here, but only when the RHS looks like an http(s) URL.
   *
   * Important: we only apply this transformation to plain-text segments (not inside other tokens),
   * so it won't interfere with existing `[text|url]`, `!img|opts!`, or `{{code}}`.
   */
  const pushTextWithBareLinks = (
    parts: React.ReactNode[],
    raw: string,
    keySeed: string,
  ) => {
    // Prefix is preserved (whitespace or "(") so we don't lose spacing.
    // Keep the match conservative so we don't accidentally convert table-like content.
    const re = /(^|[\s(])([^|\n<>\[\]]{1,120}?)\|(https?:\/\/[^\s<>()]+)(?=($|[\s).,!?]))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(raw)) !== null) {
      const fullIdx = m.index;
      if (fullIdx > last) parts.push(raw.slice(last, fullIdx));

      const prefix = m[1] ?? '';
      const label = (m[2] ?? '').trim();
      const url = m[3] ?? '';

      if (prefix) parts.push(prefix);
      if (!label) {
        parts.push(m[0]);
      } else {
        parts.push(
          <a
            key={`${keySeed}-bare-${n}-${fullIdx}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            {label}
          </a>
        );
      }

      last = fullIdx + m[0].length;
      n++;
    }
    if (last < raw.length) parts.push(raw.slice(last));
  };

  // Tokenize: {{inline code}}, *bold*, _italic_, -strikethrough-, [text|url], [~accountid:xxx], !image!
  const tokenRegex = /\{\{((?:(?!\}\}).)+)\}\}|\*([^*]+)\*|(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])|(?<![-\w])-([^-]+)-(?![-\w])|\[([^[\]]*)\|([^\]]*)\]|\[~(?:accountid:)?([^\]]+)\]|!([^|!]+)(?:\|([^!]*))?!/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let inlineMatch: RegExpExecArray | null;

  while ((inlineMatch = tokenRegex.exec(cleaned)) !== null) {
    if (inlineMatch.index > lastIdx) {
      pushTextWithBareLinks(parts, cleaned.slice(lastIdx, inlineMatch.index), `txt-${inlineMatch.index}`);
    }

    if (inlineMatch[1] !== undefined) {
      // {{inline code}}
      parts.push(
        <code key={`ic-${inlineMatch.index}`} className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono break-all">
          {inlineMatch[1]}
        </code>
      );
    } else if (inlineMatch[2] !== undefined) {
      // *bold*
      parts.push(<strong key={`b-${inlineMatch.index}`}>{inlineMatch[2]}</strong>);
    } else if (inlineMatch[3] !== undefined) {
      // _italic_
      parts.push(<em key={`i-${inlineMatch.index}`}>{inlineMatch[3]}</em>);
    } else if (inlineMatch[4] !== undefined) {
      // -strikethrough-
      parts.push(<span key={`s-${inlineMatch.index}`} className="line-through">{parseInline(inlineMatch[4], attachments)}</span>);
    } else if (inlineMatch[5] !== undefined) {
      // [visible text|url] — visible text can contain formatting
      const linkText = inlineMatch[5];
      const linkUrl = inlineMatch[6];
      parts.push(
        <a
          key={`a-${inlineMatch.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          {parseInline(linkText, attachments)}
        </a>
      );
    } else if (inlineMatch[7] !== undefined) {
      // [~accountid:xxx] or [~username] — span + badge styles (Badge is a div; invalid inside <p> / headings)
      parts.push(
        <span
          key={`mention-${inlineMatch.index}`}
          className={cn(badgeVariants({ variant: 'secondary' }), 'text-xs font-normal px-1.5 py-0')}
        >
          @{inlineMatch[7].length > 20 ? 'user' : inlineMatch[7]}
        </span>
      );
    } else if (inlineMatch[8] !== undefined) {
      // !image.png|opts!
      const filename = inlineMatch[8].trim();
      const opts = inlineMatch[9] || '';
      const widthMatch = opts.match(/width=(\d+)/);
      const altMatch = opts.match(/alt="([^"]*)"/);
      const attachment = attachments?.find(a => a.filename === filename);
      const src = attachment?.content || filename;
      const alt = altMatch ? altMatch[1] : filename;

      parts.push(
        <ClickableImage
          key={`img-${inlineMatch.index}`}
          src={src}
          alt={alt}
          maxWidth={widthMatch ? Math.min(parseInt(widthMatch[1]), 600) : undefined}
        />
      );
    }

    lastIdx = inlineMatch.index + inlineMatch[0].length;
  }
  if (lastIdx < cleaned.length) {
    pushTextWithBareLinks(parts, cleaned.slice(lastIdx), `txt-${lastIdx}`);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function isAdfDoc(v: unknown): v is { type: 'doc'; version?: number } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return r.type === 'doc';
}

type AdfRendererComponent = React.ComponentType<{ document: unknown }>;

/** Same env as AtlaskitDescriptionEditor — required for ADF inline cards / smart links in ReactRenderer. */
const jiraDrawerAtlaskitCardClient = new CardClient('staging');

function renderDescription(
  description: unknown,
  attachments?: JiraAttachment[],
  AtlaskitRendererComponent?: AdfRendererComponent | null,
): React.ReactNode {
  if (description == null || description === '') {
    return <p className="text-sm text-muted-foreground italic">No description provided.</p>;
  }

  if (isAdfDoc(description)) {
    if (AtlaskitRendererComponent) {
      return (
        <div className="text-sm overflow-x-hidden break-words [&_*]:max-w-full">
          <IntlProvider locale={typeof navigator !== 'undefined' ? navigator.language : 'en'} messages={jiraAtlaskitIntlMessages}>
            <SmartCardProvider client={jiraDrawerAtlaskitCardClient}>
              <AtlaskitRendererComponent document={description} />
            </SmartCardProvider>
          </IntlProvider>
        </div>
      );
    }
    const wikiMarkup = adfToWikiMarkup(description);
    if (wikiMarkup) {
      return <div className="space-y-1 break-words overflow-wrap-anywhere [overflow-wrap:anywhere]">{parseJiraWikiMarkup(wikiMarkup, attachments)}</div>;
    }
    return <p className="text-sm text-muted-foreground italic">Loading rich description…</p>;
  }

  if (typeof description !== 'string') {
    return <p className="text-sm text-muted-foreground italic">No description provided.</p>;
  }

  // Normalize line endings
  const normalized = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // If content contains Jira wiki markup (e.g. {panel}, {noformat}), parse it - even when wrapped in HTML
  const hasWikiMarkup = /\{(?:panel|noformat|norformat|color)(?::[^}]*)?\}/i.test(normalized);
  if (hasWikiMarkup) {
    const toParse = (/^\s*</.test(normalized) || /<(?:p|div|br|table|ul|ol)\b/i.test(normalized))
      ? stripHtmlForWikiParse(normalized)
      : normalized;
    return <div className="space-y-1 break-words overflow-wrap-anywhere [overflow-wrap:anywhere]">{parseJiraWikiMarkup(toParse, attachments)}</div>;
  }

  // If it looks like HTML (and no wiki markup), render as HTML
  if (/^\s*</.test(normalized) || /<(?:p|div|br|table|ul|ol)\b/i.test(normalized)) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-sm overflow-x-hidden break-words"
        dangerouslySetInnerHTML={{ __html: normalized }}
      />
    );
  }

  // Parse Jira wiki markup
  return <div className="space-y-1 break-words overflow-wrap-anywhere [overflow-wrap:anywhere]">{parseJiraWikiMarkup(normalized, attachments)}</div>;
}

// Simple cache for Jira issue data
const jiraCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60_000;

function getCached(key: string) {
  const entry = jiraCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data;
  if (entry) jiraCache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  jiraCache.set(key, { data, timestamp: Date.now() });
}

function invalidateJiraIssueCache(teamId: string, issueIdOrKey: string) {
  jiraCache.delete(`${teamId}:${issueIdOrKey}`);
}

export const JiraIssueDrawer: React.FC<JiraIssueDrawerProps> = ({
  issueIdOrKey,
  teamId,
  pokerSessionId,
  trigger,
  onIssueCreated,
  spotlightBrowseRoundActions,
  previewIssue,
  open: openProp,
  onOpenChange,
  onCreateInJira,
  createInJiraLoading,
}) => {
  const isPreviewMode = !!previewIssue;
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = openProp !== undefined ? openProp : internalIsOpen;
  /** Ref avoids stale `fetchIssue` closures: parent passes new `onOpenChange` each render but async open must notify latest callback. */
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const setIsOpen = useCallback(
    (v: boolean) => {
      if (openProp !== undefined) {
        onOpenChangeRef.current?.(v);
      } else {
        setInternalIsOpen(v);
        onOpenChangeRef.current?.(v);
      }
    },
    [openProp]
  );
  const [issueData, setIssueData] = useState<JiraIssueData | null>(null);
  const [jiraDomain, setJiraDomain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [noApiCredentials, setNoApiCredentials] = useState(false);
  const [canAccessTeamSettings, setCanAccessTeamSettings] = useState<boolean | null>(null);
  /** Popovers must portal into the dialog panel so react-remove-scroll (dialog overlay) does not cancel wheel events on body. */
  const [jiraDialogPortalContainer, setJiraDialogPortalContainer] = useState<HTMLDivElement | null>(null);
  const fetchRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!noApiCredentials || !teamId || !profile?.id) {
      setCanAccessTeamSettings(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (!cancelled && data) {
        setCanAccessTeamSettings(['owner', 'admin'].includes(data.role));
      } else if (!cancelled) {
        setCanAccessTeamSettings(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noApiCredentials, teamId, profile?.id]);

  const fetchIssue = React.useCallback(async (
    openOnComplete: boolean,
    options?: { skipCache?: boolean; keepPreviousData?: boolean },
  ) => {
    if (isPreviewMode) { if (openOnComplete) setIsOpen(true); return; }
    if (!issueIdOrKey || !teamId) {
      if (openOnComplete) {
        setError("Ticket number or Team ID is missing.");
        setIsOpen(true);
      }
      return;
    }

    const cacheKey = `${teamId}:${issueIdOrKey}`;

    if (!options?.skipCache) {
      const cached = getCached(cacheKey);
      if (cached) {
        if (cached.shouldUseIframe) {
          setJiraDomain(cached.domain);
          setNoApiCredentials(true);
        } else {
          setIssueData(cached);
          setJiraDomain(cached.domain || null);
        }
        if (openOnComplete) setIsOpen(true);
        return;
      }
    }

    if (fetchRef.current === cacheKey && !openOnComplete) return;
    fetchRef.current = cacheKey;

    setIsLoading(true);
    setError(null);
    if (!options?.keepPreviousData) {
      setIssueData(null);
    }
    setNoApiCredentials(false);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-jira-issue-v3', {
        body: { issueIdOrKey, teamId },
      });

      if (invokeError) throw new Error(`Function invocation failed: ${invokeError.message}`);
      if (data.error) throw new Error(data.error);

      setCache(cacheKey, data);

      if (data.shouldUseIframe) {
        setJiraDomain(data.domain);
        setNoApiCredentials(true);
      } else {
        setIssueData(data);
        setJiraDomain(data.domain || null);
      }
      if (openOnComplete) setIsOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      if (openOnComplete) setIsOpen(true);
    } finally {
      setIsLoading(false);
      setClicked(false);
      fetchRef.current = null;
    }
  }, [issueIdOrKey, teamId, isPreviewMode, setIsOpen]);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      fetchIssue(false);
      hoverTimerRef.current = null;
    }, 600);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleClick = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setClicked(true);
    fetchIssue(true);
  };

  const showSpinner = clicked && isLoading;

  const externalUrl = jiraDomain && (issueData?.key || issueIdOrKey)
    ? `${jiraDomain}/browse/${issueData?.key || issueIdOrKey}`
    : null;
  const fields = issueData?.fields;
  const sprintBucket = fields
    ? getSprintBucketFromIssueFields(fields as unknown as Record<string, unknown>)
    : null;
  const canEditJira = !isPreviewMode && !!(fields && issueData && !noApiCredentials);
  const canEditPreview = isPreviewMode && !!(fields && issueData);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSaving, setCloneSaving] = useState(false);
  const [cloneSummaryDraft, setCloneSummaryDraft] = useState('');

  const openCloneDialog = useCallback(() => {
    const s = fields?.summary?.trim() || 'Issue';
    setCloneSummaryDraft(`Clone: ${s}`.slice(0, 255));
    setCloneDialogOpen(true);
  }, [fields?.summary]);

  const handleCloneConfirm = useCallback(async () => {
    if (!teamId || !issueData?.key) return;
    const sum = cloneSummaryDraft.trim();
    if (!sum) {
      toast({ title: 'Summary required', variant: 'destructive' });
      return;
    }
    setCloneSaving(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-jira-issue', {
        body: { teamId, cloneFromIssueKey: issueData.key, summary: sum },
      });
      if (invokeError) throw new Error(invokeError.message);
      const errMsg = data && typeof data === 'object' && 'error' in data ? String((data as { error?: string }).error) : '';
      if (errMsg) throw new Error(errMsg);
      const newKey = data && typeof data === 'object' && 'key' in data ? String((data as { key?: string }).key) : '';
      if (!newKey) throw new Error('No issue key returned');
      toast({ title: `Created ${newKey}`, description: 'Clone created in Jira.' });
      setCloneDialogOpen(false);
      await onIssueCreated?.(newKey, sum);
    } catch (e: unknown) {
      toast({
        title: 'Clone failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setCloneSaving(false);
    }
  }, [teamId, issueData?.key, cloneSummaryDraft, toast, onIssueCreated]);

  const storyPoints = fields ? getStoryPointsFromJiraFields(fields as Record<string, unknown>) : null;
  const statusColor = fields?.status?.statusCategory?.colorName
    ? statusColorMap[fields.status.statusCategory.colorName] || 'bg-muted text-muted-foreground'
    : 'bg-muted text-muted-foreground';
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const openPreview = useCallback((src: string) => setPreviewImage(src), []);

  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  /** Locked when entering edit mode so pasting unsupported wiki does not swap UI mid-edit. */
  const [descriptionEditorKind, setDescriptionEditorKind] = useState<'rich' | 'raw' | 'adf' | null>(null);
  /** Holds the original ADF document when editing an ADF description (for WYSIWYG init). */
  const [descriptionAdf, setDescriptionAdf] = useState<unknown>(null);
  const atlaskitEditorRef = useRef<AtlaskitDescriptionEditorHandle>(null);
  const [savingDescription, setSavingDescription] = useState(false);
  const [adfRendererComponent, setAdfRendererComponent] = useState<AdfRendererComponent | null>(null);
  const [adfRendererLoadFailed, setAdfRendererLoadFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!isAdfDoc(fields?.description)) return;
    if (adfRendererComponent || adfRendererLoadFailed) return;
    let cancelled = false;
    import('prosemirror-state').then(({ Selection }) => {
      const orig = Selection.jsonID;
      Selection.jsonID = function (id: string, cls: any) {
        try { return orig.call(this, id, cls); } catch { return cls; }
      };
    }).catch(() => {}).then(() => import('@atlaskit/renderer'))
      .then((mod) => {
        if (cancelled) return;
        setAdfRendererComponent(() => mod.ReactRenderer as AdfRendererComponent);
        setAdfRendererLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAdfRendererLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fields?.description, adfRendererComponent, adfRendererLoadFailed]);

  const startDescriptionEdit = useCallback(() => {
    if (!canEditJira && !canEditPreview) return;
    if (savingDescription || !fields) return;
    if (isAdfDoc(fields.description)) {
      setDescriptionAdf(fields.description);
      setDescriptionDraft('');
      setDescriptionEditorKind('adf');
    } else {
      setDescriptionAdf(null);
      const draft = normalizeDescriptionForEdit(fields.description);
      setDescriptionDraft(draft);
      setDescriptionEditorKind(canEditDescriptionRichly(draft) ? 'rich' : 'raw');
    }
    setDescriptionEditing(true);
  }, [canEditJira, canEditPreview, savingDescription, fields]);
  const onDescriptionViewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canEditJira && !canEditPreview) return;
      if (savingDescription) return;
      const t = e.target as HTMLElement;
      if (t.closest('a[href], button, img')) return;
      startDescriptionEdit();
    },
    [canEditJira, canEditPreview, savingDescription, startDescriptionEdit],
  );
  const onDescriptionViewKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!canEditJira && !canEditPreview) return;
      if (savingDescription) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      startDescriptionEdit();
    },
    [canEditJira, canEditPreview, savingDescription, startDescriptionEdit],
  );

  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignUsers, setAssignUsers] = useState<Array<{ accountId: string; displayName: string; avatarUrls?: Record<string, string> }>>([]);
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [newCommentDraft, setNewCommentDraft] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [pointsPopoverOpen, setPointsPopoverOpen] = useState(false);
  const [pointsDraft, setPointsDraft] = useState('');
  const [savingPoints, setSavingPoints] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [fieldOptions, setFieldOptions] = useState<JiraFieldOptionsPayload | null>(null);
  const [fieldOptionsLoading, setFieldOptionsLoading] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [issueTypePopoverOpen, setIssueTypePopoverOpen] = useState(false);
  const [savingJiraField, setSavingJiraField] = useState<'status' | 'priority' | 'issuetype' | null>(null);

  const [sprintPopoverOpen, setSprintPopoverOpen] = useState(false);
  const [sprintPickerData, setSprintPickerData] = useState<SprintPickerData | null>(null);
  const [sprintPickerLoading, setSprintPickerLoading] = useState(false);
  const [savingSprint, setSavingSprint] = useState(false);

  const startTitleEdit = useCallback(() => {
    if (!canEditJira && !canEditPreview) return;
    if (savingTitle || !fields) return;
    setTitleDraft(fields.summary ?? '');
    setTitleEditing(true);
  }, [canEditJira, canEditPreview, savingTitle, fields]);
  const onTitleViewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canEditJira && !canEditPreview) return;
      if (savingTitle) return;
      const t = e.target as HTMLElement;
      if (t.closest('a[href], button, img')) return;
      startTitleEdit();
    },
    [canEditJira, canEditPreview, savingTitle, startTitleEdit],
  );
  const onTitleViewKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!canEditJira && !canEditPreview) return;
      if (savingTitle) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      startTitleEdit();
    },
    [canEditJira, canEditPreview, savingTitle, startTitleEdit],
  );

  const senderDisplayName =
    profile?.full_name?.trim() ||
    profile?.nickname?.trim() ||
    user?.email ||
    'Unknown user';

  useEffect(() => {
    if (isPreviewMode && isOpen && previewIssue) {
      setIssueData({ key: 'Preview', fields: { summary: previewIssue.summary, description: previewIssue.description }, shouldUseIframe: false });
    }
    if (!isOpen) {
      setDescriptionEditing(false);
      setDescriptionEditorKind(null);
      setDescriptionDraft('');
      setAssignPopoverOpen(false);
      setPointsPopoverOpen(false);
      setNewCommentDraft('');
      setTitleEditing(false);
      setTitleDraft('');
      setStatusPopoverOpen(false);
      setPriorityPopoverOpen(false);
      setIssueTypePopoverOpen(false);
      setSprintPopoverOpen(false);
      if (isPreviewMode) setIssueData(null);
    }
  }, [isOpen, isPreviewMode, previewIssue]);

  useEffect(() => {
    if (!assignPopoverOpen) setAssignSearch('');
  }, [assignPopoverOpen]);

  useEffect(() => {
    if (!assignPopoverOpen || !teamId || !issueData?.key || noApiCredentials) return;
    const delayMs = assignSearch.length === 0 ? 0 : 280;
    let cancelled = false;
    const t = setTimeout(async () => {
      setAssignSearchLoading(true);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('search-jira-assignable-users', {
          body: { teamId, issueKey: issueData.key, query: assignSearch },
        });
        if (cancelled) return;
        if (invokeError || data?.error) {
          setAssignUsers([]);
          return;
        }
        setAssignUsers(data?.users ?? []);
      } finally {
        if (!cancelled) setAssignSearchLoading(false);
      }
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [assignPopoverOpen, assignSearch, teamId, issueData?.key, noApiCredentials]);

  useEffect(() => {
    if (!pointsPopoverOpen) return;
    setPointsDraft(storyPoints != null ? String(storyPoints) : '');
  }, [pointsPopoverOpen, storyPoints]);

  useEffect(() => {
    if (!canEditJira || !teamId || !issueData?.key) {
      setFieldOptions(null);
      return;
    }

    const cached = getCachedIssueFieldOptions(teamId, issueData.key);
    if (cached) {
      setFieldOptions(cached);
      setFieldOptionsLoading(false);
      return;
    }

    let cancelled = false;
    setFieldOptionsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-jira-issue-field-options', {
          body: { teamId, issueKey: issueData.key },
        });
        if (cancelled) return;
        if (error || data?.error) {
          setFieldOptions(null);
          return;
        }
        const payload: JiraFieldOptionsPayload = {
          priorities: data.priorities ?? [],
          issueTypes: data.issueTypes ?? [],
          transitions: data.transitions ?? [],
        };
        setCachedIssueFieldOptions(teamId, issueData.key, payload);
        setFieldOptions(payload);
      } finally {
        if (!cancelled) setFieldOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditJira, teamId, issueData?.key]);

  useEffect(() => {
    if (!canEditJira || !teamId || !issueData?.key || noApiCredentials) {
      setSprintPickerData(null);
      return;
    }

    const cached = getCachedTeamSprintPickerOptions(teamId);
    if (cached) {
      if (fields) {
        setSprintPickerData(
          buildSprintPickerDataFromCacheAndIssue(
            issueData.key,
            fields as unknown as Record<string, unknown>,
            cached,
          ),
        );
      }
      setSprintPickerLoading(false);
      return;
    }

    let cancelled = false;
    setSprintPickerLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-jira-sprint-options', {
          body: { teamId, issueKey: issueData.key },
        });
        if (cancelled) return;
        if (error || data?.error) {
          setSprintPickerData(null);
          return;
        }
        setCachedTeamSprintPickerOptions(teamId, {
          boardId: data.boardId ?? null,
          pickerSprints: data.pickerSprints ?? [],
        });
        setSprintPickerData(data as SprintPickerData);
      } finally {
        if (!cancelled) setSprintPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    canEditJira,
    teamId,
    issueData?.key,
    noApiCredentials,
    sprintBucket?.displayName,
    sprintBucket?.sprintId,
  ]);

  const refreshFieldOptionsAfterUpdate = useCallback(async () => {
    if (!teamId || !issueData?.key) return;
    const { data, error } = await supabase.functions.invoke('get-jira-issue-field-options', {
      body: { teamId, issueKey: issueData.key },
    });
    if (error || data?.error) return;
    const payload: JiraFieldOptionsPayload = {
      priorities: data.priorities ?? [],
      issueTypes: data.issueTypes ?? [],
      transitions: data.transitions ?? [],
    };
    setCachedIssueFieldOptions(teamId, issueData.key, payload);
    setFieldOptions(payload);
  }, [teamId, issueData?.key]);

  const handleSaveDescription = async () => {
    if (isPreviewMode) {
      let newDesc: unknown = descriptionDraft;
      if (descriptionEditorKind === 'adf') {
        newDesc = await atlaskitEditorRef.current?.getAdfValue() ?? descriptionDraft;
      }
      setIssueData((prev) => prev ? { ...prev, fields: { ...prev.fields, description: newDesc } } : prev);
      setDescriptionEditing(false);
      setDescriptionEditorKind(null);
      setDescriptionDraft('');
      setDescriptionAdf(null);
      return;
    }
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    setSavingDescription(true);
    try {
      let body: Record<string, unknown>;
      if (descriptionEditorKind === 'adf') {
        const adfValue = await atlaskitEditorRef.current?.getAdfValue();
        if (!adfValue) throw new Error('Could not retrieve editor content');
        body = { teamId, issueKey: issueData.key, descriptionAdf: adfValue };
      } else {
        body = { teamId, issueKey: issueData.key, description: descriptionDraft };
      }
      const fnName = descriptionEditorKind === 'adf' ? 'update-jira-issue-v2' : 'update-jira-issue';
      const { data, error: invokeError } = await supabase.functions.invoke(fnName, {
        body,
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setDescriptionEditing(false);
      setDescriptionEditorKind(null);
      setDescriptionAdf(null);
      toast({ title: 'Description updated' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update description',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSaveTitle = async () => {
    if (isPreviewMode) {
      const trimmed = titleDraft.trim();
      if (!trimmed) { toast({ title: 'Title cannot be empty', variant: 'destructive' }); return; }
      setIssueData((prev) => prev ? { ...prev, fields: { ...prev.fields, summary: trimmed } } : prev);
      setTitleEditing(false);
      setTitleDraft('');
      return;
    }
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      toast({ title: 'Title cannot be empty', variant: 'destructive' });
      return;
    }
    if (trimmed.length > 255) {
      toast({ title: 'Title must be 255 characters or fewer', variant: 'destructive' });
      return;
    }
    setSavingTitle(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue', {
        body: { teamId, issueKey: issueData.key, summary: trimmed },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setTitleEditing(false);
      toast({ title: 'Title updated' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update title',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingTitle(false);
    }
  };

  const handleAssigneeSelect = async (accountId: string | null) => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    setSavingAssignee(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue', {
        body: { teamId, issueKey: issueData.key, assigneeAccountId: accountId },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setAssignPopoverOpen(false);
      toast({ title: accountId ? 'Assignee updated' : 'Assignee cleared' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update assignee',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingAssignee(false);
    }
  };

  const handlePostComment = async () => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    const trimmed = newCommentDraft.trim();
    if (!trimmed) return;
    setSavingComment(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('add-jira-issue-comment', {
        body: {
          teamId,
          issueKey: issueData.key,
          commentText: trimmed,
          senderDisplayName,
        },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setNewCommentDraft('');
      toast({ title: 'Comment posted' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to post comment',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingComment(false);
    }
  };

  const handleSavePoints = async () => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    const trimmed = pointsDraft.trim();
    let pointsValue: number | null;
    if (trimmed === '') {
      pointsValue = null;
    } else {
      const n = parseFloat(trimmed);
      if (Number.isNaN(n) || n < 0) {
        toast({
          title: 'Enter a valid non-negative number',
          variant: 'destructive',
        });
        return;
      }
      pointsValue = n;
    }
    setSavingPoints(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue-points', {
        body: { teamId, issueKey: issueData.key, points: pointsValue },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setPointsPopoverOpen(false);
      if (pokerSessionId) {
        void broadcastPokerSessionJiraStoryPoints(pokerSessionId, {
          issueKey: issueData.key,
          points: pointsValue,
        });
      }
      toast({ title: pointsValue === null ? 'Story points cleared' : 'Story points updated' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update story points',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingPoints(false);
    }
  };

  const handleJiraTransition = async (transitionId: string) => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    setSavingJiraField('status');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue', {
        body: { teamId, issueKey: issueData.key, transitionId },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setStatusPopoverOpen(false);
      toast({ title: 'Status updated' });
      await refreshFieldOptionsAfterUpdate();
    } catch (e: unknown) {
      toast({
        title: 'Failed to update status',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingJiraField(null);
    }
  };

  const handleJiraPriorityChange = async (priorityId: string) => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    setSavingJiraField('priority');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue', {
        body: { teamId, issueKey: issueData.key, priorityId },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setPriorityPopoverOpen(false);
      toast({ title: 'Priority updated' });
      await refreshFieldOptionsAfterUpdate();
    } catch (e: unknown) {
      toast({
        title: 'Failed to update priority',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingJiraField(null);
    }
  };

  const handleJiraIssueTypeChange = async (issueTypeId: string) => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    setSavingJiraField('issuetype');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue', {
        body: { teamId, issueKey: issueData.key, issueTypeId },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setIssueTypePopoverOpen(false);
      toast({ title: 'Issue type updated' });
      await refreshFieldOptionsAfterUpdate();
    } catch (e: unknown) {
      toast({
        title: 'Failed to update issue type',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingJiraField(null);
    }
  };

  const handleSprintChange = async (nextSprintId: number | null) => {
    if (!teamId || !issueData?.key || !issueIdOrKey) return;
    setSavingSprint(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-jira-issue-sprint', {
        body: { teamId, issueKey: issueData.key, sprintId: nextSprintId },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      invalidateJiraIssueCache(teamId, issueIdOrKey);
      await fetchIssue(false, { skipCache: true, keepPreviousData: true });
      setSprintPopoverOpen(false);
      toast({ title: nextSprintId == null ? 'Moved to backlog' : 'Sprint updated' });
    } catch (e: unknown) {
      toast({
        title: 'Failed to update sprint',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSavingSprint(false);
    }
  };

  // Build a map of Jira accountId -> displayName from issue data
  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!fields) return map;
    if (fields.assignee?.displayName) {
      // We don't have the accountId directly on assignee in our interface,
      // but the raw data has it
      const raw = fields as any;
      if (raw.assignee?.accountId) map.set(raw.assignee.accountId, raw.assignee.displayName);
      if (raw.reporter?.accountId) map.set(raw.reporter.accountId, raw.reporter.displayName);
    }
    if (fields.comment?.comments) {
      for (const comment of fields.comment.comments) {
        const rawAuthor = comment.author as any;
        if (rawAuthor?.accountId && rawAuthor?.displayName) {
          map.set(rawAuthor.accountId, rawAuthor.displayName);
        }
      }
    }
    return map;
  }, [fields]);

  const sprintEditable = canEditJira && sprintPickerData?.boardId != null;
  const sprintLabel =
    sprintPickerData?.currentSprintName ?? sprintBucket?.displayName ?? '—';

  const activeBoardSprintId = React.useMemo(
    () =>
      sprintPickerData?.pickerSprints?.find((s) => s.state?.toLowerCase() === 'active')?.id ??
      null,
    [sprintPickerData?.pickerSprints],
  );
  const issueInActiveSprint =
    activeBoardSprintId != null &&
    sprintPickerData?.currentSprintId === activeBoardSprintId;

  const triggerElement = trigger ? (
    React.cloneElement(trigger, {
      onClick: (e: React.MouseEvent) => {
        (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
        handleClick();
      },
      onMouseEnter: (e: React.MouseEvent) => {
        (trigger.props as { onMouseEnter?: (e: React.MouseEvent) => void }).onMouseEnter?.(e);
        handleMouseEnter();
      },
      onMouseLeave: (e: React.MouseEvent) => {
        (trigger.props as { onMouseLeave?: (e: React.MouseEvent) => void }).onMouseLeave?.(e);
        handleMouseLeave();
      },
    } as React.HTMLAttributes<HTMLElement>)
  ) : (
    <Button variant="outline" className="w-full" onClick={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} disabled={showSpinner}>
      {showSpinner ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <ChevronDown className="h-4 w-4 mr-2" />
      )}
      Show Jira Issue
    </Button>
  );

  return (
    <ImagePreviewContext.Provider value={openPreview}>
    <JiraUserMapContext.Provider value={userMap}>
      {!isPreviewMode && triggerElement}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          ref={setJiraDialogPortalContainer}
          className="sm:max-w-[60vw] max-h-[90vh] min-h-0 overflow-x-hidden overflow-visible p-0 gap-0 flex flex-col"
          overlayClassName="bg-black/45"
          aria-describedby={undefined}
        >
          {/* grid row minmax(0,1fr) gives ScrollArea a real height cap; flex-1 alone lets the area grow with content (no overflow → no scrollbar). */}
          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <DialogHeader className="shrink-0 px-6 pt-6">
              <div className="flex items-start justify-between gap-3 pr-6 pb-4">
                <DialogTitle className="text-lg">
                  {issueData?.key || issueIdOrKey || 'Jira Issue'}
                </DialogTitle>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  {!isPreviewMode && canEditJira && issueData?.key && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={openCloneDialog}
                    >
                      <Copy className="h-3 w-3" />
                      Clone
                    </Button>
                  )}
                  {!isPreviewMode &&
                    spotlightBrowseRoundActions &&
                    !spotlightBrowseRoundActions.committed && (
                      <NeotroPressableButton
                        type="button"
                        onClick={() => spotlightBrowseRoundActions.onCommitToRounds()}
                        isActive
                        activeShowsPressed={false}
                        size="compact"
                        className="gap-1.5 shrink-0"
                        aria-label="Keep this ticket as a session round"
                        title="Keep in the round list when you close this window"
                      >
                        <Plus className="h-3 w-3" />
                        Add to rounds
                      </NeotroPressableButton>
                    )}
                  {isPreviewMode && onCreateInJira ? (
                    <NeotroPressableButton
                      onClick={() => {
                        const sum = (issueData?.fields.summary ?? '').trim();
                        const desc = issueData?.fields.description ?? previewIssue?.description ?? '';
                        void onCreateInJira({ summary: sum, description: desc as string | Record<string, unknown> });
                      }}
                      isDisabled={createInJiraLoading || !(issueData?.fields.summary ?? '').trim()}
                      isActive
                      activeShowsPressed={false}
                      size="compact"
                      className="gap-1.5 shrink-0"
                    >
                      {createInJiraLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {createInJiraLoading ? 'Creating…' : 'Create in Jira'}
                    </NeotroPressableButton>
                  ) : externalUrl ? (
                    <NeotroPressableButton
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="compact"
                      isActive
                      activeShowsPressed={false}
                      className="gap-1.5 shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Jira
                    </NeotroPressableButton>
                  ) : null}
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="min-h-0 h-full w-full">
          <div className="space-y-5 px-6 pb-6">
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
                {canAccessTeamSettings ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Jira API credentials are not configured for this team. Configure them in Team Settings to view issue details inline.
                    </p>
                    <NeotroPressableButton
                      onClick={() => teamId && navigate(`/teams/${teamId}/settings#jira-integration`)}
                      size="default"
                      isActive
                      activeShowsPressed={false}
                      className="gap-2 mt-2 mx-auto"
                    >
                      <Settings className="h-4 w-4" />
                      Team Settings
                    </NeotroPressableButton>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Jira API credentials are not configured for this team. A team Admin will need to set up Jira Integration in Team Settings to view issue details inline.
                  </p>
                )}
              </div>
            )}

            {/* Issue details */}
            {fields && (
              <>
                {titleEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      maxLength={255}
                      disabled={savingTitle}
                      className="text-base font-semibold"
                      aria-label="Issue title"
                    />
                    <p className="text-[11px] text-muted-foreground">{titleDraft.length}/255</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSaveTitle()}
                        disabled={savingTitle || !titleDraft.trim()}
                      >
                        {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingTitle}
                        onClick={() => {
                          setTitleEditing(false);
                          setTitleDraft('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (canEditJira || canEditPreview) ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Edit title"
                    onClick={onTitleViewClick}
                    onKeyDown={onTitleViewKeyDown}
                    className="rounded-lg p-2 -m-2 transition-colors flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <h2 className="text-base font-semibold text-foreground leading-snug flex-1 min-w-0">
                      {fields.summary}
                    </h2>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                ) : (
                  <h2 className="text-base font-semibold text-foreground leading-snug">
                    {fields.summary}
                  </h2>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {canEditJira ? (
                    <>
                      <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={fieldOptionsLoading || savingJiraField !== null}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium transition-colors',
                              !(fieldOptionsLoading || savingJiraField) &&
                                'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              (fieldOptionsLoading || savingJiraField) && 'opacity-70',
                            )}
                            aria-label="Change status"
                          >
                            {fields.status ? (
                              <Badge variant="secondary" className={cn(statusColor, 'text-xs pointer-events-none')}>
                                {fields.status.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Status</span>
                            )}
                            {savingJiraField === 'status' && (
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          container={jiraDialogPortalContainer ?? undefined}
                          className="w-[min(100vw-2rem,300px)] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false} className="overflow-visible">
                            <ScrollArea className={jiraPopoverListScrollClass}>
                              <CommandList className="max-h-none overflow-visible">
                                {fieldOptionsLoading ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                                ) : (
                                  <>
                                    <CommandGroup>
                                      {(fieldOptions?.transitions ?? []).map((t) => (
                                        <CommandItem
                                          key={t.id}
                                          value={`${t.id}-${t.name}`}
                                          onSelect={() => void handleJiraTransition(t.id)}
                                          disabled={savingJiraField !== null}
                                        >
                                          <span className="truncate">{t.toStatusName ?? t.name}</span>
                                          {t.toStatusName && t.name && t.toStatusName !== t.name && (
                                            <span className="text-muted-foreground text-xs truncate ml-1">({t.name})</span>
                                          )}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    {(fieldOptions?.transitions?.length ?? 0) === 0 && (
                                      <CommandEmpty>No transitions available.</CommandEmpty>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </ScrollArea>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <Popover open={issueTypePopoverOpen} onOpenChange={setIssueTypePopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={fieldOptionsLoading || savingJiraField !== null}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium transition-colors',
                              !(fieldOptionsLoading || savingJiraField) &&
                                'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              (fieldOptionsLoading || savingJiraField) && 'opacity-70',
                            )}
                            aria-label="Change issue type"
                          >
                            {fields.issuetype ? (
                              <>
                                {fields.issuetype.iconUrl && (
                                  <img src={fields.issuetype.iconUrl} alt="" className="h-4 w-4 shrink-0" />
                                )}
                                <span className="text-muted-foreground truncate max-w-[140px]">{fields.issuetype.name}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Issue type</span>
                            )}
                            {savingJiraField === 'issuetype' && (
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          container={jiraDialogPortalContainer ?? undefined}
                          className="w-[min(100vw-2rem,300px)] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false} className="overflow-visible">
                            <ScrollArea className={jiraPopoverListScrollClass}>
                              <CommandList className="max-h-none overflow-visible">
                                {fieldOptionsLoading ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                                ) : (
                                  <>
                                    <CommandGroup>
                                      {(fieldOptions?.issueTypes ?? []).map((it) => (
                                        <CommandItem
                                          key={it.id}
                                          value={`${it.id}-${it.name}`}
                                          onSelect={() => void handleJiraIssueTypeChange(it.id)}
                                          disabled={savingJiraField !== null}
                                        >
                                          {it.iconUrl ? (
                                            <img src={it.iconUrl} alt="" className="h-4 w-4 mr-2 shrink-0" />
                                          ) : null}
                                          <span className="truncate">{it.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    {(fieldOptions?.issueTypes?.length ?? 0) === 0 && (
                                      <CommandEmpty>No issue types available.</CommandEmpty>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </ScrollArea>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <Popover open={priorityPopoverOpen} onOpenChange={setPriorityPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={fieldOptionsLoading || savingJiraField !== null}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium transition-colors',
                              !(fieldOptionsLoading || savingJiraField) &&
                                'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              (fieldOptionsLoading || savingJiraField) && 'opacity-70',
                            )}
                            aria-label="Change priority"
                          >
                            {fields.priority ? (
                              <>
                                {fields.priority.iconUrl && (
                                  <img src={fields.priority.iconUrl} alt="" className="h-4 w-4 shrink-0" />
                                )}
                                <span className="text-muted-foreground truncate max-w-[120px]">{fields.priority.name}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Priority</span>
                            )}
                            {savingJiraField === 'priority' && (
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          container={jiraDialogPortalContainer ?? undefined}
                          className="w-[min(100vw-2rem,300px)] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false} className="overflow-visible">
                            <ScrollArea className={jiraPopoverListScrollClass}>
                              <CommandList className="max-h-none overflow-visible">
                                {fieldOptionsLoading ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                                ) : (
                                  <>
                                    <CommandGroup>
                                      {(fieldOptions?.priorities ?? []).map((p) => (
                                        <CommandItem
                                          key={p.id}
                                          value={`${p.id}-${p.name}`}
                                          onSelect={() => void handleJiraPriorityChange(p.id)}
                                          disabled={savingJiraField !== null}
                                        >
                                          {p.iconUrl ? (
                                            <img src={p.iconUrl} alt="" className="h-4 w-4 mr-2 shrink-0" />
                                          ) : null}
                                          <span className="truncate">{p.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    {(fieldOptions?.priorities?.length ?? 0) === 0 && (
                                      <CommandEmpty>No priorities available.</CommandEmpty>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </ScrollArea>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                  {canEditJira ? (
                    <Popover open={pointsPopoverOpen} onOpenChange={setPointsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={savingPoints}
                          aria-label="Edit story points"
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium transition-colors',
                            !savingPoints &&
                              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            savingPoints && 'opacity-70 cursor-wait',
                          )}
                        >
                          <Layers className="h-3 w-3 shrink-0" />
                          <span>{storyPoints != null ? `${storyPoints} pts` : 'Set points'}</span>
                          {savingPoints && (
                            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        container={jiraDialogPortalContainer ?? undefined}
                        className="w-[min(100vw-2rem,260px)] p-3"
                        align="start"
                      >
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="jira-drawer-points">Story points</Label>
                            <Input
                              id="jira-drawer-points"
                              type="number"
                              min={0}
                              step={0.5}
                              value={pointsDraft}
                              onChange={(e) => setPointsDraft(e.target.value)}
                              disabled={savingPoints}
                              className="font-mono"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingPoints}
                              onClick={() => void handleSavePoints()}
                            >
                              {savingPoints ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={savingPoints}
                              onClick={() => setPointsPopoverOpen(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    storyPoints != null && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Layers className="h-3 w-3" />
                        {storyPoints} pts
                      </Badge>
                    )
                  )}
                  {sprintEditable ? (
                    <Popover open={sprintPopoverOpen} onOpenChange={setSprintPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={savingSprint || savingJiraField !== null}
                          aria-label="Change sprint"
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-xs font-medium transition-colors max-w-[min(100%,220px)]',
                            !(savingSprint || savingJiraField) &&
                              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            (savingSprint || savingJiraField) && 'opacity-70',
                          )}
                        >
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="truncate min-w-0">{sprintLabel}</span>
                          {issueInActiveSprint && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                              Active
                            </Badge>
                          )}
                          {savingSprint && (
                            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        container={jiraDialogPortalContainer ?? undefined}
                        className="w-[min(100vw-2rem,300px)] p-0"
                        align="start"
                      >
                        <Command shouldFilter={false} className="overflow-visible">
                          <ScrollArea className={jiraPopoverListScrollClass}>
                            <CommandList className="max-h-none overflow-visible">
                              <CommandGroup>
                                <CommandItem
                                  value="__backlog__"
                                  onSelect={() => void handleSprintChange(null)}
                                  disabled={savingSprint}
                                >
                                  Backlog
                                </CommandItem>
                                {(sprintPickerData?.pickerSprints ?? []).map((s) => {
                                  const isBoardActive = s.state?.toLowerCase() === 'active';
                                  return (
                                  <CommandItem
                                    key={s.id}
                                    value={`${s.id}-${s.name}`}
                                    onSelect={() => void handleSprintChange(s.id)}
                                    disabled={savingSprint}
                                  >
                                    <div className="flex w-full min-w-0 items-center justify-between gap-2">
                                      <span className="truncate">{s.name}</span>
                                      {isBoardActive && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                                          Active
                                        </Badge>
                                      )}
                                    </div>
                                  </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </ScrollArea>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span
                      className="inline-flex max-w-[min(100%,220px)]"
                      title={
                        canEditJira && !sprintEditable && !sprintPickerLoading
                          ? 'Configure a Jira board in Team Settings to change sprint here'
                          : undefined
                      }
                    >
                      <Badge variant="outline" className="text-xs gap-1 max-w-full">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="truncate">{sprintLabel}</span>
                        {issueInActiveSprint && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                            Active
                          </Badge>
                        )}
                        {sprintPickerLoading && (
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        )}
                      </Badge>
                    </span>
                  )}
                </div>

                <Separator />

                {/* People & parent */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    {canEditJira ? (
                      <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assignee</p>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              disabled={savingAssignee}
                              aria-label="Change assignee"
                              className={cn(
                                'flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-transparent p-2 -m-2 text-left transition-colors',
                                !savingAssignee &&
                                  'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                savingAssignee && 'opacity-70 cursor-wait',
                              )}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                {fields.assignee ? (
                                  <>
                                    {fields.assignee.avatarUrls?.['24x24'] ? (
                                      <img src={fields.assignee.avatarUrls['24x24']} alt="" className="h-5 w-5 rounded-full shrink-0" />
                                    ) : (
                                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                    <p className="text-sm text-foreground truncate">{fields.assignee.displayName}</p>
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">Unassigned</p>
                                )}
                              </div>
                              {savingAssignee ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                              ) : (
                                <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                          </PopoverTrigger>
                        </div>
                        <PopoverContent
                          container={jiraDialogPortalContainer ?? undefined}
                          className="w-[min(100vw-2rem,280px)] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false} className="overflow-visible">
                            <CommandInput placeholder="Search users…" value={assignSearch} onValueChange={setAssignSearch} />
                            <ScrollArea className="h-[min(50vh,280px)]">
                              <CommandList className="max-h-none overflow-visible">
                                {assignSearchLoading ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                                ) : (
                                  <>
                                    <CommandGroup>
                                      <CommandItem
                                        value="__unassigned__"
                                        onSelect={() => void handleAssigneeSelect(null)}
                                        disabled={savingAssignee}
                                      >
                                        <User className="mr-2 h-4 w-4 opacity-50" />
                                        Unassigned
                                      </CommandItem>
                                      {assignUsers.map((u) => (
                                        <CommandItem
                                          key={u.accountId}
                                          value={`${u.displayName}-${u.accountId}`}
                                          onSelect={() => void handleAssigneeSelect(u.accountId)}
                                          disabled={savingAssignee}
                                        >
                                          {u.avatarUrls?.['24x24'] ? (
                                            <img src={u.avatarUrls['24x24']} alt="" className="mr-2 h-5 w-5 rounded-full shrink-0" />
                                          ) : (
                                            <User className="mr-2 h-4 w-4 opacity-50 shrink-0" />
                                          )}
                                          <span className="truncate">{u.displayName}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    {assignUsers.length === 0 && (
                                      <CommandEmpty>No matching users.</CommandEmpty>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </ScrollArea>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assignee</p>
                        <div className="flex items-center gap-2 min-w-0">
                          {fields.assignee ? (
                            <>
                              {fields.assignee.avatarUrls?.['24x24'] ? (
                                <img src={fields.assignee.avatarUrls['24x24']} alt="" className="h-5 w-5 rounded-full shrink-0" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <p className="text-sm text-foreground truncate">{fields.assignee.displayName}</p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Unassigned</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {fields.reporter && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reporter</p>
                      <div className="flex items-center gap-2 min-w-0">
                        {fields.reporter.avatarUrls?.['24x24'] ? (
                          <img src={fields.reporter.avatarUrls['24x24']} alt="" className="h-5 w-5 rounded-full shrink-0" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <p className="text-sm text-foreground truncate">{fields.reporter.displayName}</p>
                      </div>
                    </div>
                  )}
                  {fields.created && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Created</p>
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-sm text-foreground truncate" title={fields.created}>
                          {formatJiraDateTime(fields.created)}
                        </p>
                      </div>
                    </div>
                  )}
                  {fields.parent?.key && (
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Parent</p>
                      {jiraDomain ? (
                        <a
                          href={`${jiraDomain}/browse/${fields.parent.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-0 max-w-full self-start"
                          title={fields.parent.key}
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-sm font-medium border max-w-full truncate hover:opacity-90',
                              parentBadgeClassName(fields.parent.key),
                            )}
                          >
                            {(fields.parent.fields?.summary ?? '').trim() || fields.parent.key}
                          </Badge>
                        </a>
                      ) : (
                        <Badge
                          variant="outline"
                          title={fields.parent.key}
                          className={cn(
                            'text-sm font-medium border max-w-full truncate self-start',
                            parentBadgeClassName(fields.parent.key),
                          )}
                        >
                          {(fields.parent.fields?.summary ?? '').trim() || fields.parent.key}
                        </Badge>
                      )}
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
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</p>
                    {(canEditJira || canEditPreview) && !descriptionEditing && (
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                    )}
                  </div>
                  {descriptionEditing ? (
                    <div className="space-y-2">
                      {descriptionEditorKind === 'adf' ? (
                        <AtlaskitDescriptionEditor
                          ref={atlaskitEditorRef}
                          key={`${issueData?.key ?? 'issue'}-adf-desc`}
                          defaultValue={descriptionAdf}
                          disabled={savingDescription}
                        />
                      ) : descriptionEditorKind === 'rich' ? (
                        <JiraIssueWikiEditor
                          key={`${issueData?.key ?? 'issue'}-desc`}
                          initialValue={descriptionDraft}
                          onChange={setDescriptionDraft}
                          disabled={savingDescription}
                        />
                      ) : (
                        <Textarea
                          value={descriptionDraft}
                          onChange={(e) => setDescriptionDraft(e.target.value)}
                          rows={10}
                          className="font-mono text-sm min-h-[160px]"
                          disabled={savingDescription}
                        />
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleSaveDescription()}
                          disabled={savingDescription}
                        >
                          {savingDescription ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingDescription}
                          onClick={() => {
                            setDescriptionEditing(false);
                            setDescriptionEditorKind(null);
                            setDescriptionDraft('');
                            setDescriptionAdf(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role={(canEditJira || canEditPreview) ? 'button' : undefined}
                      tabIndex={(canEditJira || canEditPreview) && !savingDescription ? 0 : undefined}
                      aria-label={(canEditJira || canEditPreview) ? 'Edit description' : undefined}
                      onClick={onDescriptionViewClick}
                      onKeyDown={onDescriptionViewKeyDown}
                      className={cn(
                        'rounded-lg p-2 -m-2 transition-colors',
                        (canEditJira || canEditPreview) &&
                          !savingDescription &&
                          'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        savingDescription && 'pointer-events-none opacity-70',
                      )}
                    >
                      {isPreviewMode && typeof fields.description === 'string' ? (
                        <Markdown className="text-sm prose prose-sm dark:prose-invert max-w-none">
                          {fields.description}
                        </Markdown>
                      ) : renderDescription(
                        fields.description,
                        fields.attachment,
                        adfRendererComponent,
                      )}
                    </div>
                  )}
                </div>
                {/* Comments */}
                <Separator />
                <div>
                  <div className="flex items-center gap-1 mb-3">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Comments ({fields.comment?.comments?.length ?? 0})
                    </p>
                  </div>
                  {canEditJira && (
                    <div className="space-y-2 mb-4">
                      <Textarea
                        placeholder="Write a comment…"
                        value={newCommentDraft}
                        onChange={(e) => setNewCommentDraft(e.target.value)}
                        rows={4}
                        className="text-sm min-h-[88px] resize-y"
                        disabled={savingComment}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Jira will show:{' '}
                        <span className="font-mono text-[10px] whitespace-pre-wrap break-words">
                          {`-- This message was sent from Retroscope on behalf of ${senderDisplayName} --`}
                        </span>
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingComment || !newCommentDraft.trim()}
                        onClick={() => void handlePostComment()}
                      >
                        {savingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post comment'}
                      </Button>
                    </div>
                  )}
                  {(fields.comment?.comments?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {[...(fields.comment?.comments ?? [])]
                        .sort(
                          (a, b) =>
                            new Date(b.created).getTime() - new Date(a.created).getTime(),
                        )
                        .map((comment) => {
                        const avatarUrl = comment.author?.avatarUrls?.['24x24'] || comment.author?.avatarUrls?.['16x16'];
                        const initials = comment.author?.displayName
                          ?.split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || '?';
                        const timeAgo = formatJiraDate(comment.created);

                        return (
                          <Card key={comment.id} className="p-3 gap-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={avatarUrl} alt={comment.author?.displayName} />
                                <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{comment.author?.displayName}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo}</span>
                            </div>
                            <div className="text-sm break-words [overflow-wrap:anywhere]">
                              {renderDescription(comment.body, fields.attachment, adfRendererComponent)}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview dialog — same pattern as chat */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0" aria-describedby={undefined}>
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-0">
            {previewImage && (
              <img
                src={previewImage}
                alt="Full size preview"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Clone issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="jira-clone-summary">Summary</Label>
            <Input
              id="jira-clone-summary"
              value={cloneSummaryDraft}
              onChange={(e) => setCloneSummaryDraft(e.target.value.slice(0, 255))}
              maxLength={255}
              disabled={cloneSaving}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{cloneSummaryDraft.length}/255</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloneDialogOpen(false)}
              disabled={cloneSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCloneConfirm()} disabled={cloneSaving || !cloneSummaryDraft.trim()}>
              {cloneSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </JiraUserMapContext.Provider>
    </ImagePreviewContext.Provider>
  );
};

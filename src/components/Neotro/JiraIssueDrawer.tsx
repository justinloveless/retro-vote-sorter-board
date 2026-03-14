import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  // Common field names for story points
  const pointFields = ['story_points', 'customfield_10016', 'customfield_10028', 'customfield_10004'];
  for (const field of pointFields) {
    if (fields[field] != null) return fields[field];
  }
  return null;
}

function renderDescription(description: string | null): React.ReactNode {
  if (!description) return <p className="text-sm text-muted-foreground italic">No description provided.</p>;

  // Jira API v2 returns description as a string (plain text or rendered HTML depending on config)
  // If it looks like HTML, render it; otherwise treat as plain text
  if (description.startsWith('<') || description.includes('<p>') || description.includes('<br')) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    );
  }

  // Plain text — preserve line breaks
  return (
    <div className="text-sm whitespace-pre-wrap text-foreground">
      {description}
    </div>
  );
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
        // No API credentials — can't fetch details, offer external link
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

  const externalUrl = jiraDomain && issueIdOrKey ? `${jiraDomain}/browse/${issueIdOrKey}` : null;
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

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">
                {issueData?.key || issueIdOrKey || 'Jira Issue'}
              </SheetTitle>
              {externalUrl && (
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Jira
                  </Button>
                </a>
              )}
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-5">
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
                {/* Summary */}
                <h2 className="text-base font-semibold text-foreground leading-snug">
                  {fields.summary}
                </h2>

                {/* Status & Type row */}
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
                        <img
                          src={fields.assignee.avatarUrls['24x24']}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
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
                        <img
                          src={fields.reporter.avatarUrls['24x24']}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
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
        </SheetContent>
      </Sheet>
    </>
  );
};

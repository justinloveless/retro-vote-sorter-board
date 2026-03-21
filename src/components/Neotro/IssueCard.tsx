import React from 'react';
import { Badge } from '@/components/ui/badge';
import { parentBadgeClassName } from '@/lib/parentBadgeTone';
import { cn } from '@/lib/utils';

export interface JiraIssueDisplay {
  key: string;
  summary: string | null;
  status?: string;
  statusCategory?: string;
  issueTypeIconUrl?: string;
  storyPoints?: number | null;
  assignee?: string | null;
  reporter?: string | null;
  parent?: { key: string; summary: string } | null;
}

interface IssueCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDragStart' | 'onDragOver' | 'onDrop'> {
  issue: JiraIssueDisplay;
  /** Larger type for Jira browse lists (queue cards stay default). */
  browse?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showNextBadge?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  cursorPointer?: boolean;
}

const statusCategoryColorMap: Record<string, string> = {
  done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  indeterminate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  new: 'bg-muted text-muted-foreground',
};

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  browse = false,
  leftSlot,
  rightSlot,
  showNextBadge,
  className = '',
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  cursorPointer,
  ...rest
}) => {
  const cardBase = browse
    ? 'flex items-center gap-2 p-2.5 rounded-md border bg-card hover:bg-accent/50'
    : 'flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50';
  const hasFullData = 'status' in issue && issue.status != null;
  const body = browse ? 'text-sm' : 'text-xs';
  const badgeSm = browse ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0';
  const metaSm = browse ? 'text-xs' : 'text-[10px]';

  return (
    <div
      className={`${cardBase} ${className}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={cursorPointer ? { cursor: 'pointer' } : undefined}
      {...rest}
    >
      {leftSlot}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {issue.issueTypeIconUrl && (
            <img src={issue.issueTypeIconUrl} alt="" className={browse ? 'h-5 w-5' : 'h-4 w-4'} />
          )}
          <span className={cn('font-mono text-primary font-semibold', body)}>{issue.key}</span>
          {showNextBadge && (
            <Badge variant="default" className={badgeSm}>
              Next
            </Badge>
          )}
          {hasFullData && (
            <>
              <Badge
                variant="secondary"
                className={cn(
                  badgeSm,
                  statusCategoryColorMap[issue.statusCategory || ''] || 'bg-muted text-muted-foreground',
                )}
              >
                {issue.status}
              </Badge>
              <Badge variant="outline" className={cn(badgeSm, 'font-bold')}>
                {issue.storyPoints != null ? `${issue.storyPoints} pts` : '-'}
              </Badge>
            </>
          )}
        </div>
        {(issue.summary ?? '').length > 0 && (
          <div className={cn('text-muted-foreground truncate mt-0.5', body)}>{issue.summary}</div>
        )}
        {issue.parent && (
          <div className={cn('mt-0.5 flex items-center gap-1.5 min-w-0', metaSm)}>
            <span className="text-muted-foreground shrink-0">Parent:</span>
            <Badge
              variant="outline"
              className={cn(
                'font-medium border min-w-0 max-w-full truncate',
                badgeSm,
                parentBadgeClassName(issue.parent.key),
              )}
              title={issue.parent.key}
            >
              {(issue.parent.summary ?? '').trim() || issue.parent.key}
            </Badge>
          </div>
        )}
        {hasFullData && (issue.assignee || issue.reporter) && (
          <div className={cn('text-muted-foreground mt-0.5 space-y-0.5', metaSm)}>
            {issue.assignee && <div>Assignee: {issue.assignee}</div>}
            {issue.reporter && <div>Reporter: {issue.reporter}</div>}
          </div>
        )}
      </div>
      {rightSlot}
    </div>
  );
};

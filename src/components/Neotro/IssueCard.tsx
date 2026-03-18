import React from 'react';
import { Badge } from '@/components/ui/badge';

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
  const cardBase = 'flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50';
  const hasFullData = 'status' in issue && issue.status != null;

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
            <img src={issue.issueTypeIconUrl} alt="" className="h-4 w-4" />
          )}
          <span className="font-mono text-xs text-primary font-semibold">{issue.key}</span>
          {showNextBadge && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              Next
            </Badge>
          )}
          {hasFullData && (
            <>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 ${statusCategoryColorMap[issue.statusCategory || ''] || 'bg-muted text-muted-foreground'}`}
              >
                {issue.status}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">
                {issue.storyPoints != null ? `${issue.storyPoints} pts` : '-'}
              </Badge>
            </>
          )}
        </div>
        {(issue.summary ?? '').length > 0 && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{issue.summary}</div>
        )}
        {hasFullData && (issue.assignee || issue.reporter || issue.parent) && (
          <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
            {issue.assignee && <div>Assignee: {issue.assignee}</div>}
            {issue.reporter && <div>Reporter: {issue.reporter}</div>}
            {issue.parent && (
              <div className="truncate" title={issue.parent.summary || undefined}>
                Parent: {issue.parent.key}
                {issue.parent.summary ? ` — ${issue.parent.summary}` : ''}
              </div>
            )}
          </div>
        )}
      </div>
      {rightSlot}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Upload, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { broadcastPokerSessionJiraStoryPoints } from '@/lib/pokerJiraStoryPointsBroadcast';
import { useToast } from '@/hooks/use-toast';
import { usePokerTable } from './PokerTableComponent/context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';
import type { WinningPoints } from '@/hooks/usePokerSession';

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21];

function nearestPointOption(avg: number): number {
  let nearest = POINT_OPTIONS[0];
  let minDiff = Math.abs(avg - nearest);
  for (const p of POINT_OPTIONS) {
    const diff = Math.abs(avg - p);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = p;
    }
  }
  return nearest;
}

interface SubmitPointsToJiraProps {
  teamId?: string;
  ticketNumber: string | null;
  winningVote: WinningPoints;
  isHandPlayed: boolean;
  isJiraConfigured: boolean;
  className?: string;
  compact?: boolean;
}

const SubmitPointsToJira: React.FC<SubmitPointsToJiraProps> = ({
  teamId,
  ticketNumber,
  winningVote,
  isHandPlayed,
  isJiraConfigured,
  className = '',
  compact = false,
}) => {
  const { toast } = useToast();
  const { activeUserSelection, sendSystemMessage, session } = usePokerTable();

  const defaultPoints = useMemo(() => {
    if (winningVote.kind === 'between') {
      return winningVote.high;
    }
    const n = winningVote.points;
    if (POINT_OPTIONS.includes(n)) return n;
    return nearestPointOption(n);
  }, [winningVote]);

  const [selectedPoints, setSelectedPoints] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const finalPoints = selectedPoints ?? defaultPoints;

  if (!isHandPlayed) return null;

  const isDisabled =
    !isJiraConfigured || !ticketNumber || !teamId || isSyntheticRoundTicket(ticketNumber);

  const handleSubmit = async () => {
    if (isDisabled) return;
    setIsSubmitting(true);
    try {
      const pressedBy = (activeUserSelection?.name || '').trim() || 'Someone';
      await sendSystemMessage(
        `<p>Submitted ${finalPoints} pts to Jira by ${pressedBy}</p>`
      );

      const { data, error } = await supabase.functions.invoke('update-jira-issue-points', {
        body: { teamId, issueKey: ticketNumber, points: finalPoints },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const resolvedKey = typeof data?.issueKey === 'string' ? data.issueKey : ticketNumber;
      if (session?.session_id && resolvedKey) {
        void broadcastPokerSessionJiraStoryPoints(session.session_id, {
          issueKey: resolvedKey,
          points: finalPoints,
        });
      }

      setIsSubmitted(true);
      toast({ title: `${ticketNumber} updated to ${finalPoints} pts in Jira` });
    } catch (e: any) {
      console.error('Error submitting points to Jira:', e);
      toast({
        title: 'Failed to update Jira',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabledReason = !teamId
    ? 'No team context'
    : !isJiraConfigured
      ? 'Jira integration not configured'
      : !ticketNumber
        ? 'No ticket number set'
        : isSyntheticRoundTicket(ticketNumber)
          ? 'Set a Jira key on this round to submit points'
          : null;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'flex-row' : 'flex-col space-y-2'} ${className}`}>
      <div className="flex gap-1 justify-center shrink-0">
        {POINT_OPTIONS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setSelectedPoints(p);
              setIsSubmitted(false);
            }}
            disabled={isDisabled}
            className={`
              rounded font-medium transition-colors
              ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
              ${p === finalPoints
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {p}
          </button>
        ))}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={compact ? 'inline-block' : 'w-full block'}>
              <NeotroPressableButton
                onClick={handleSubmit}
                isDisabled={isDisabled || isSubmitting}
                isActive={!isSubmitted}
                activeShowsPressed={false}
                size={compact ? 'compact' : 'default'}
                className={compact ? 'shrink-0' : 'w-full'}
              >
                {isSubmitted ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Submitted {finalPoints} pts
                  </>
                ) : isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit {finalPoints} pts to Jira
                  </>
                )}
              </NeotroPressableButton>
            </span>
          </TooltipTrigger>
          {disabledReason && (
            <TooltipContent>
              <p>{disabledReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default SubmitPointsToJira;

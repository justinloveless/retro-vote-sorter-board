import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  /** Winning points (most votes) - used as default for Jira submission */
  winningPoints: number;
  isHandPlayed: boolean;
  isJiraConfigured: boolean;
}

const SubmitPointsToJira: React.FC<SubmitPointsToJiraProps> = ({
  teamId,
  ticketNumber,
  winningPoints,
  isHandPlayed,
  isJiraConfigured,
}) => {
  const { toast } = useToast();
  const defaultPoints = useMemo(
    () => (POINT_OPTIONS.includes(winningPoints) ? winningPoints : nearestPointOption(winningPoints)),
    [winningPoints]
  );
  const [selectedPoints, setSelectedPoints] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const finalPoints = selectedPoints ?? defaultPoints;

  if (!isHandPlayed) return null;

  const isDisabled = !isJiraConfigured || !ticketNumber || !teamId;

  const handleSubmit = async () => {
    if (isDisabled) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-jira-issue-points', {
        body: { teamId, issueKey: ticketNumber, points: finalPoints },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

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
        : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 justify-center">
        {POINT_OPTIONS.map((p) => (
          <button
            key={p}
            onClick={() => { setSelectedPoints(p); setIsSubmitted(false); }}
            disabled={isDisabled}
            className={`
              px-2.5 py-1 rounded text-sm font-medium transition-colors
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
            <span className="w-full block">
              <Button
                onClick={handleSubmit}
                disabled={isDisabled || isSubmitting}
                variant={isSubmitted ? 'outline' : 'default'}
                className="w-full"
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
              </Button>
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

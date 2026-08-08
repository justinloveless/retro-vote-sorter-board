import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Github } from 'lucide-react';

interface Props {
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  onOpenRequested?: () => void;
  /** Controlled open state. When provided with onOpenChange, the dialog is controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, only the dialog is rendered (no trigger button). Defaults to true. */
  showTrigger?: boolean;
}

export const FeedbackButton: React.FC<Props> = ({
  variant = 'outline',
  size = 'sm',
  className,
  onOpenRequested,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const pageUrl = useMemo(() => window.location.href, []);
  const [loading, setLoading] = useState(false);

  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange(next);
    } else {
      setUncontrolledOpen(next);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      toast({ title: 'Please provide a title', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const insertRes = await supabase.from('feedback_reports').insert({
        user_id: user?.id || null,
        email: user?.email || null,
        type,
        title: title.trim(),
        description: description.trim(),
        page_url: pageUrl,
      }).select('id').single();
      if (insertRes.error) throw insertRes.error;

      // Create the GitHub issue server-side (token never leaves the backend)
      try {
        await supabase.functions.invoke('create-feedback-github-issue', {
          body: { feedbackId: insertRes.data.id },
        });
      } catch (e) {
        // Best-effort; ignore errors
      }


      toast({ title: 'Thanks for the feedback!' });
      setOpen(false);
      setTitle('');
      setDescription('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: 'Failed to submit feedback', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showTrigger && (
        <Button variant={variant} size={size} onClick={() => {
          onOpenRequested?.();
          setOpen(true);
        }} className={className || 'inline-flex items-center gap-2'}>
          <Github className="h-4 w-4" />
          Feedback
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300">Type</label>
              <select
                className="border border-input rounded px-2 py-1 text-sm bg-background text-foreground"
                value={type}
                onChange={(e) => setType(e.target.value as 'bug' | 'feature' | 'other')}
              >
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-300">
                Description <span className="text-gray-400 dark:text-gray-500">(optional)</span>
              </label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? What did you expect?" rows={6} />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Page: {pageUrl}</div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={loading}>{loading ? 'Submitting…' : 'Submit'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { insertFeedbackReport, updateFeedbackReport, getAppConfigValue } from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Github } from 'lucide-react';

interface Props { }

export const FeedbackButton: React.FC<Props> = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const pageUrl = useMemo(() => window.location.href, []);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Please provide a title and description', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { id: feedbackId } = await insertFeedbackReport({
        userId: user?.id || null,
        email: user?.email || null,
        type,
        title,
        description,
        pageUrl,
      });

      // Try to create GitHub issue if similar not found using Admin-configured settings
      try {
        const ghRepo = await getAppConfigValue('GITHUB_REPO');
        const ghToken = await getAppConfigValue('GITHUB_TOKEN');
        if (ghToken && ghRepo) {
          // search similar issues
          const searchQ = encodeURIComponent(`${title} repo:${ghRepo} in:title state:open`);
          const searchRes = await fetch(`https://api.github.com/search/issues?q=${searchQ}`, {
            headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
          });
          const searchJson = await searchRes.json();
          const similar = Array.isArray(searchJson.items) ? searchJson.items.find((i: any) => i.title.toLowerCase() === title.toLowerCase()) : null;
          if (!similar) {
            const issueRes = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
              body: JSON.stringify({
                title: `[${type}] ${title}`,
                body: `${description}\n\nSubmitted by: ${user?.email || 'anonymous'}\nPage: ${pageUrl}`,
                labels: [type, 'in-app-feedback'],
              })
            });
            if (issueRes.ok) {
              const issue = await issueRes.json();
              await updateFeedbackReport(feedbackId, { github_issue_url: issue.html_url });
            }
          }
        }
      } catch (e) {
        // Best-effort; ignore errors
      }

      toast({ title: 'Thanks for the feedback!' });
      setOpen(false);
      setTitle('');
      setDescription('');
    } catch (e: any) {
      toast({ title: 'Failed to submit feedback', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="inline-flex items-center gap-2">
        <Github className="h-4 w-4" />
        Feedback
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300">Type</label>
              <select className="border rounded px-2 py-1 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
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
              <label className="text-sm text-gray-600 dark:text-gray-300">Description</label>
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



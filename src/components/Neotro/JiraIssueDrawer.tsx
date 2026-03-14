import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface JiraIssue {
  title: string;
  description: string;
}

interface JiraIssueDrawerProps {
  issueIdOrKey: string | null;
  teamId: string | null;
}

export const JiraIssueDrawer: React.FC<JiraIssueDrawerProps> = ({ issueIdOrKey, teamId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleShowIssue = async () => {
    setIsLoading(true);
    setError(null);
    setIssue(null);
    setIframeUrl(null);

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
        const url = `${data.domain}/browse/${issueIdOrKey}`;
        setIframeUrl(url);
        setIsOpen(true);
      } else {
        setIssue({
          title: data.fields.summary,
          description: data.fields.description,
        });
        setIsOpen(true);
      }
    } catch (err: any) {
      setError(err.message);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Jira Issue Details</DialogTitle>
            {iframeUrl && (
              <a href={iframeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in Jira
                </Button>
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {error && <p className="text-destructive p-4">{error}</p>}
            {iframeUrl && (
              <iframe
                src={iframeUrl}
                className="w-full h-[70vh] border-0 rounded-md"
                title="Jira Issue"
              />
            )}
            {issue && (
              <div className="font-custom bg-muted p-4 space-y-4 rounded-xl">
                <h2 className="text-2xl font-bold">{issue.title}</h2>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: issue.description }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
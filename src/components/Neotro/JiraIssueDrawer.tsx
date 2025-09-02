import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet.tsx';
import { Button } from '../../components/ui/button.tsx';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client.ts';

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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleShowIssue = async () => {
    setIsLoading(true);
    setError(null);
    setIssue(null);

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

      if (data.shouldUseIframe) { // This now means "should use link"
        const url = `${data.domain}/browse/${issueIdOrKey}`;
        window.open(url, '_blank', 'noopener,noreferrer');
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
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="top">
          <SheetHeader>
            <SheetTitle>Jira Issue Details</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {error && <p className="text-red-500">{error}</p>}
            {issue && (
              <div className="font-custom bg-[#2d2d2d] p-4 space-y-4 rounded-xl text-white">
                <h2 className="text-2xl font-bold">{issue.title}</h2>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: issue.description }}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}; 
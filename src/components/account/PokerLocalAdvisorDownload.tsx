import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POKER_LOCAL_ADVISOR_ZIP_HREF } from '@/constants/pokerLocalAdvisorDownload';

type Props = {
  /** compact = single row for poker panel */
  variant?: 'default' | 'compact';
};

export const PokerLocalAdvisorDownload: React.FC<Props> = ({ variant = 'default' }) => {
  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
          <a href={POKER_LOCAL_ADVISOR_ZIP_HREF} download="poker-local-advisor.zip">
            <Download className="h-3 w-3 mr-1.5" />
            Download server
          </a>
        </Button>
        <span className="text-muted-foreground">
          Unzip, run <code className="text-[10px]">node server.mjs</code>, then set URL in Account.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Local advisor server bundle</span>
        <Button variant="secondary" size="sm" asChild>
          <a href={POKER_LOCAL_ADVISOR_ZIP_HREF} download="poker-local-advisor.zip">
            <Download className="h-4 w-4 mr-2" />
            Download poker-local-advisor.zip
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Includes Node.js server, optional Claude/Gemini handlers, and <strong>INSTALL.md</strong> (no Retroscope
        source code required). You need{' '}
        <a
          href="https://nodejs.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium text-primary"
        >
          Node.js 18+
        </a>{' '}
        installed. Unzip, run <code className="text-[11px]">node server.mjs</code>, then enter the same URL in the
        field below (default port <code className="text-[11px]">17300</code>).
      </p>
    </div>
  );
};

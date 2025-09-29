import React, { useEffect, useState } from 'react';
import { getAppConfigValue, upsertAppConfig } from '@/lib/dataClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const GH_REPO_KEY = 'GITHUB_REPO';
const GH_TOKEN_KEY = 'GITHUB_TOKEN';

export const GithubIssueSettings: React.FC = () => {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const repoVal = await getAppConfigValue(GH_REPO_KEY);
      const tokenVal = await getAppConfigValue(GH_TOKEN_KEY);
      setRepo(repoVal || '');
      setToken(tokenVal || '');
      setIsLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      await upsertAppConfig([
        { key: GH_REPO_KEY, value: repo },
        { key: GH_TOKEN_KEY, value: token }
      ]);
      toast({ title: 'Saved GitHub settings' });
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Issue Settings</CardTitle>
        <CardDescription>Configure repo and token for automatic issue creation.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="font-medium text-sm">Repository (owner/repo)</label>
              <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" />
            </div>
            <div>
              <label className="font-medium text-sm">Personal Access Token</label>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isSaving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};



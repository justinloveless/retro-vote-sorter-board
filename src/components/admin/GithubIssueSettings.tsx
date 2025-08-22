import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data: repoRow } = await supabase.from('app_config').select('value').eq('key', GH_REPO_KEY).single();
      const { data: tokenRow } = await supabase.from('app_config').select('value').eq('key', GH_TOKEN_KEY).single();
      setRepo(repoRow?.value || '');
      setToken(tokenRow?.value || '');
      setIsLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      const upserts = [
        { key: GH_REPO_KEY, value: repo },
        { key: GH_TOKEN_KEY, value: token }
      ];
      const { error } = await supabase.from('app_config').upsert(upserts, { onConflict: 'key' });
      if (error) throw error;
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



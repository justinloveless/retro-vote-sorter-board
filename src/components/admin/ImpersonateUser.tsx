import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  email: string | null;
  teams: Array<{ id: string; name: string }>;
};

export const ImpersonateUser: React.FC = () => {
  const { profile, isImpersonating, stopImpersonating, startImpersonating } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const run = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('admin-search-users', { body: { q: query } });
      if (error) {
        toast({ title: 'Search failed', description: error.message, variant: 'destructive' });
      } else {
        setResults((data as any)?.results || []);
      }
      setLoading(false);
    };
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [query, toast]);

  const handleImpersonate = async (userId: string) => {
    try {
      await startImpersonating(userId);
      toast({ title: 'Impersonation enabled' });
    } catch (e: any) {
      toast({ title: 'Failed to impersonate', description: e.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impersonate User</CardTitle>
        <CardDescription>Admins can view the app as another user. Writes still use your admin identity.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isImpersonating && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={(profile as any)?.avatar_url || ''} />
                  <AvatarFallback>{((profile as any)?.full_name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">Currently impersonating</div>
                  <div className="text-xs text-muted-foreground">{(profile as any)?.full_name || (profile as any)?.id}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={stopImpersonating}>
                <X className="h-4 w-4 mr-2" /> Stop
              </Button>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-300">Search by name, email, or user id</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Jane Doe, jane@company.com, or UUID" />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {results.map((r) => (
                <div key={r.id} className="rounded border p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={r.avatar_url || ''} />
                        <AvatarFallback>{(r.full_name || r.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{r.full_name || '(no name)'} {r.role ? <span className="text-xs text-muted-foreground">({r.role})</span> : null}</div>
                        <div className="text-xs text-muted-foreground">{r.email || 'no email'}</div>
                        <div className="text-[10px] text-muted-foreground">{r.id}</div>
                        {r.teams?.length ? (
                          <div className="mt-1 text-xs">
                            <span className="text-muted-foreground">Teams: </span>
                            {r.teams.map(t => t.name).join(', ')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <Button size="sm" onClick={() => handleImpersonate(r.id)}>Impersonate</Button>
                    </div>
                  </div>
                </div>
              ))}
              {!results.length && query && (
                <div className="text-sm text-muted-foreground">No results</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};



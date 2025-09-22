import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { apiAdminSendNotification } from '@/lib/apiClient';

export const AdminSendNotification: React.FC = () => {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState(''); // comma-separated emails or userIds
  const [type, setType] = useState('custom');
  const [title, setTitle] = useState('Test notification');
  const [message, setMessage] = useState('This is a test');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const parseRecipients = () => {
    return recipients
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(r => (/^[0-9a-fA-F-]{36}$/.test(r) ? { userId: r } : { email: r }));
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      const payload = {
        recipients: parseRecipients(),
        type: type || 'custom',
        title,
        message: message || undefined,
        url: url || undefined,
      };

      if (shouldUseCSharpApi()) {
        console.log('Using C# API for admin send notification');
        const result = await apiAdminSendNotification(payload);
        toast({ 
          title: 'Sent', 
          description: result.info || `Notifications sent to ${result.count || 0} recipients.` 
        });
      } else {
        console.log('Using direct Supabase for admin send notification');
        const { error } = await supabase.functions.invoke('admin-send-notification', { body: payload });
        if (error) throw error;
        toast({ title: 'Sent', description: 'Notifications queued.' });
      }
      
      setRecipients('');
    } catch (e: any) {
      toast({ title: 'Failed to send', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Test Notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipients">Recipients (comma-separated emails or user IDs)</Label>
          <Input id="recipients" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="alice@example.com, 00000000-0000-0000-0000-000000000000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Input id="type" value={type} onChange={(e) => setType(e.target.value)} placeholder="custom | team_invite | retro_session | poker_session" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message (optional)</Label>
          <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL (optional)</Label>
          <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/retro/ROOMID or https://..." />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={loading || !title || !recipients.trim()}>{loading ? 'Sending...' : 'Send'}</Button>
        </div>
      </CardContent>
    </Card>
  );
};



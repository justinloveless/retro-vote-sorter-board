import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const badge = useMemo(() => {
    if (unreadCount <= 0) return null;
    const display = unreadCount > 9 ? '9+' : String(unreadCount);
    return (
      <span className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
        {display}
      </span>
    );
  }, [unreadCount]);

  const handleClickItem = async (id: string, url: string | null) => {
    await markAsRead(id);
    if (url) {
      if (url.startsWith('/')) {
        navigate(url);
      } else {
        window.location.href = url;
      }
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {badge}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">Notifications</div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {unreadCount} unread
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
              >
                View all
              </Button>
            </div>
          </div>
        </div>
        <Separator />
        <ScrollArea className="max-h-96">
          <ul className="divide-y">
            {notifications.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">You're all caught up.</li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className={`group p-3 hover:bg-muted/50 ${n.is_read ? 'opacity-70' : ''}`}>
                  <div className="flex items-start gap-2">
                    <div
                      className="flex-1 cursor-pointer text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleClickItem(n.id, n.url)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleClickItem(n.id, n.url);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {n.is_read ? (
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{n.title}</div>
                          {n.message && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                          )}
                          {n.url && (
                            <div className="flex items-center gap-1 text-xs text-primary mt-1">
                              <ExternalLink className="h-3 w-3" /> Open
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      {!n.is_read && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Mark notification as read"
                          onClick={() => void markAsRead(n.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Delete notification"
                        onClick={() => void deleteNotification(n.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};



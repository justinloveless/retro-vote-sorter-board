import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { AuthForm } from '@/components/AuthForm';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const {
    notifications,
    loading,
    error,
    markAsRead,
    deleteNotification,
    totalCount,
    totalPages,
    fetchNotifications,
  } = useNotifications({ page, pageSize: PAGE_SIZE });

  const handleClickItem = async (id: string, url: string | null) => {
    await markAsRead(id);
    if (!url) return;

    if (url.startsWith('/')) {
      navigate(url);
    } else {
      window.location.href = url;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm
        redirectTo="/notifications"
        onAuthSuccess={() => window.location.reload()}
      />
    );
  }

  useEffect(() => {
    if (typeof totalPages !== 'number') return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const canGoPrev = page > 1;
  const canGoNext = typeof totalPages === 'number' ? page < totalPages : notifications.length === PAGE_SIZE;

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const selectedCount = selectedIds.size;

  const allSelectedOnPage = useMemo(() => {
    if (notifications.length === 0) return false;
    return notifications.every((n) => selectedIds.has(n.id));
  }, [notifications, selectedIds]);

  const toggleSelected = (id: string, nextChecked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const onPageIds = notifications.map((n) => n.id);
      if (onPageIds.length === 0) return next;

      const everythingSelected = onPageIds.every((id) => next.has(id));
      if (everythingSelected) {
        onPageIds.forEach((id) => next.delete(id));
      } else {
        onPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBatchMarkAsRead = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (batchLoading || loading) return;

    setBatchLoading(true);
    try {
      await Promise.all(ids.map((id) => markAsRead(id)));
      setSelectedIds(new Set());
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (batchLoading || loading) return;

    setBatchLoading(true);
    try {
      await Promise.all(ids.map((id) => deleteNotification(id)));
      await fetchNotifications();
      setSelectedIds(new Set());
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 md:pt-0">
      <AppHeader variant="home" />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
        </div>

        {error ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Failed to load notifications</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  {loading
                    ? 'Loading…'
                    : typeof totalCount === 'number' && typeof totalPages === 'number'
                      ? `${totalCount} total notifications · Page ${page} of ${totalPages}`
                      : `Page ${page}`}
                </p>
                <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!canGoPrev || loading}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!canGoNext || loading}
                >
                  Next
                </Button>
                </div>
              </div>

              {notifications.length > 0 && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={() => toggleSelectAllOnPage()}
                      aria-label="Select all notifications on this page"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {selectedCount > 0 ? `${selectedCount} selected` : 'Select notifications'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBatchMarkAsRead()}
                      disabled={selectedCount === 0 || batchLoading || loading}
                    >
                      Mark read
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleBatchDelete()}
                      disabled={selectedCount === 0 || batchLoading || loading}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>

            <Separator />

            {loading ? (
              <CardContent className="py-10">
                <div className="flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading notifications…
                </div>
              </CardContent>
            ) : notifications.length === 0 ? (
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">You&apos;re all caught up.</div>
                </div>
              </CardContent>
            ) : (
              <CardContent className="p-0">
                <ul className="divide-y">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`group p-4 hover:bg-muted/50 ${n.is_read ? 'opacity-70' : ''} ${
                        selectedIds.has(n.id) ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Checkbox
                            checked={selectedIds.has(n.id)}
                            onCheckedChange={(checked) => toggleSelected(n.id, Boolean(checked))}
                            aria-label={`Select notification: ${n.title}`}
                          />
                        </div>

                        <div className="mt-1">
                          {n.is_read ? (
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                            onClick={() => void handleClickItem(n.id, n.url)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">
                                  {n.title}
                                </div>
                                {n.message && (
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {n.message}
                                  </div>
                                )}
                                {n.url && (
                                  <div className="flex items-center gap-1 text-xs text-primary mt-1">
                                    <ExternalLink className="h-3 w-3" />
                                    <span className="truncate">Open</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {new Date(n.created_at).toLocaleString()}
                              </div>
                            </div>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          {!n.is_read && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
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
                            className="h-8 w-8"
                            aria-label="Delete notification"
                            onClick={() => {
                              void (async () => {
                                await deleteNotification(n.id);
                                await fetchNotifications();
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(n.id);
                                  return next;
                                });
                              })();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;


import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Search, Users, CreditCard, Tag, Loader2, Trash2, X, Check } from 'lucide-react';

const PRICE_TO_PLAN: Record<string, string> = {
  [SUBSCRIPTION_TIERS.pro.monthlyPriceId]: 'Pro (Monthly)',
  [SUBSCRIPTION_TIERS.pro.yearlyPriceId]: 'Pro (Yearly)',
  [SUBSCRIPTION_TIERS.business.monthlyPriceId]: 'Business (Monthly)',
  [SUBSCRIPTION_TIERS.business.yearlyPriceId]: 'Business (Yearly)',
};

const ALL_PRICES = [
  { id: SUBSCRIPTION_TIERS.pro.monthlyPriceId, label: 'Pro Monthly ($10/mo)' },
  { id: SUBSCRIPTION_TIERS.pro.yearlyPriceId, label: 'Pro Yearly ($96/yr)' },
  { id: SUBSCRIPTION_TIERS.business.monthlyPriceId, label: 'Business Monthly ($25/mo)' },
  { id: SUBSCRIPTION_TIERS.business.yearlyPriceId, label: 'Business Yearly ($240/yr)' },
];

interface Subscriber {
  subscription_id: string;
  customer_id: string;
  email: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  price_id: string;
  product_id: string;
}

interface Coupon {
  id: string;
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  valid: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
}

interface PromoCode {
  id: string;
  code: string;
  coupon: { id: string; name: string };
  active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
}

const invoke = async (body: any) => {
  const { data, error } = await supabase.functions.invoke('admin-manage-subscription', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const AdminSubscriptionManager: React.FC = () => {
  const [tab, setTab] = useState('users');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription Management
        </CardTitle>
        <CardDescription>Search users, manage plans, and create promotions</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users"><Search className="h-4 w-4 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="subscribers"><Users className="h-4 w-4 mr-1" />Subscribers</TabsTrigger>
            <TabsTrigger value="promos"><Tag className="h-4 w-4 mr-1" />Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4"><UserSearchTab /></TabsContent>
          <TabsContent value="subscribers" className="mt-4"><SubscribersTab /></TabsContent>
          <TabsContent value="promos" className="mt-4"><PromosTab /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// ─── User Search Tab ───
const UserSearchTab: React.FC = () => {
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<{ id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string } | null>(null);

  const searchUsers = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const data = await invoke({ action: 'search_users', email });
      setResults(data.users || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
        />
        <Button onClick={searchUsers} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setSelectedUser(u)}
            >
              {u.email}
            </button>
          ))}
        </div>
      )}

      {selectedUser && (
        <UserSubscriptionPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

// ─── User Subscription Panel ───
const UserSubscriptionPanel: React.FC<{ user: { id: string; email: string }; onClose: () => void }> = ({ user, onClose }) => {
  const [sub, setSub] = useState<any>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [applyCouponOpen, setApplyCouponOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSub = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: 'get_user_subscription', user_email: user.email });
      setSub(data.subscription);
      setCustomerId(data.customer_id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => { fetchSub(); }, [fetchSub]);

  const handleChangePlan = async (newPriceId: string) => {
    if (!sub) return;
    setActionLoading(true);
    try {
      await invoke({ action: 'change_plan', subscription_id: sub.id, item_id: sub.item_id, new_price_id: newPriceId });
      toast.success('Plan changed successfully');
      setChangePlanOpen(false);
      fetchSub();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (immediate: boolean) => {
    if (!sub) return;
    setActionLoading(true);
    try {
      await invoke({ action: 'cancel_subscription', subscription_id: sub.id, immediate });
      toast.success(immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end');
      setCancelOpen(false);
      fetchSub();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyCoupon = async (couponId: string) => {
    if (!customerId) return;
    setActionLoading(true);
    try {
      await invoke({ action: 'apply_coupon', customer_id: customerId, coupon_id: couponId });
      toast.success('Coupon applied');
      setApplyCouponOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{user.email}</h4>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {sub ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Plan:</span>{' '}
              <Badge variant="secondary">{PRICE_TO_PLAN[sub.price_id] || sub.price_id}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <Badge variant={sub.cancel_at_period_end ? 'destructive' : 'default'}>
                {sub.cancel_at_period_end ? 'Canceling' : sub.status}
              </Badge>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Period ends:</span>{' '}
              {new Date(sub.current_period_end * 1000).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setChangePlanOpen(true)}>Change Plan</Button>
            <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>Cancel</Button>
            {customerId && <Button size="sm" variant="outline" onClick={() => setApplyCouponOpen(true)}>Apply Coupon</Button>}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">
          No active subscription.
          {customerId && (
            <Button size="sm" variant="outline" className="ml-2" onClick={() => setApplyCouponOpen(true)}>Apply Coupon</Button>
          )}
        </div>
      )}

      {/* Change Plan Dialog */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan for {user.email}</DialogTitle>
            <DialogDescription>Select the new plan. Changes will be prorated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {ALL_PRICES.filter(p => p.id !== sub?.price_id).map(p => (
              <Button key={p.id} variant="outline" className="w-full justify-start" disabled={actionLoading} onClick={() => handleChangePlan(p.id)}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {p.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>Choose how to cancel for {user.email}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={actionLoading} onClick={() => handleCancel(false)}>
              Cancel at Period End
            </Button>
            <Button variant="destructive" className="flex-1" disabled={actionLoading} onClick={() => handleCancel(true)}>
              Cancel Immediately
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Coupon Dialog */}
      <ApplyCouponDialog open={applyCouponOpen} onOpenChange={setApplyCouponOpen} onApply={handleApplyCoupon} loading={actionLoading} />
    </div>
  );
};

// ─── Apply Coupon Dialog ───
const ApplyCouponDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void; onApply: (couponId: string) => void; loading: boolean }> = ({ open, onOpenChange, onApply, loading }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    invoke({ action: 'list_coupons' })
      .then(data => setCoupons(data.coupons?.filter((c: Coupon) => c.valid) || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Coupon</DialogTitle>
          <DialogDescription>Select a coupon to apply to this customer</DialogDescription>
        </DialogHeader>
        {fetching ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active coupons. Create one in the Promos tab.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {coupons.map(c => (
              <Button key={c.id} variant="outline" className="w-full justify-between" disabled={loading} onClick={() => onApply(c.id)}>
                <span>{c.name || c.id}</span>
                <Badge variant="secondary">
                  {c.percent_off ? `${c.percent_off}% off` : c.amount_off ? `$${(c.amount_off / 100).toFixed(0)} off` : ''}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Subscribers Tab ───
const SubscribersTab: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: 'list_subscribers' });
      setSubscribers(data.subscribers || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{subscribers.length} active subscriber{subscribers.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
      </div>
      {subscribers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No active subscribers</p>
      ) : (
        <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
          {subscribers.map(s => (
            <div key={s.subscription_id} className="px-3 py-2 text-sm flex items-center justify-between">
              <div>
                <span className="font-medium">{s.email}</span>
                <span className="ml-2">
                  <Badge variant="secondary" className="text-xs">{PRICE_TO_PLAN[s.price_id] || 'Unknown'}</Badge>
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                {s.cancel_at_period_end ? 'Canceling' : `Renews ${new Date(s.current_period_end * 1000).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Promos Tab ───
const PromosTab: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: 'list_coupons' });
      setCoupons(data.coupons || []);
      setPromoCodes(data.promo_codes || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deleteCoupon = async (couponId: string) => {
    try {
      await invoke({ action: 'delete_coupon', coupon_id: couponId });
      toast.success('Coupon deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>Create Coupon</Button>
      </div>

      {coupons.length > 0 && (
        <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
          {coupons.map(c => {
            const promoCode = promoCodes.find(p => p.coupon.id === c.id);
            return (
              <div key={c.id} className="px-3 py-2 text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium">{c.name || c.id}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {c.percent_off ? `${c.percent_off}% off` : c.amount_off ? `$${(c.amount_off / 100).toFixed(0)} off` : ''}
                  </Badge>
                  <span className="text-muted-foreground ml-2 text-xs">{c.duration}{c.duration_in_months ? ` (${c.duration_in_months}mo)` : ''}</span>
                  {promoCode && (
                    <Badge variant="outline" className="ml-2 text-xs font-mono">{promoCode.code}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{c.times_redeemed} used</span>
                  <Button size="icon" variant="ghost" onClick={() => deleteCoupon(c.id)} className="h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateCouponDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  );
};

// ─── Create Coupon Dialog ───
const CreateCouponDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }> = ({ open, onOpenChange, onCreated }) => {
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [percentOff, setPercentOff] = useState('');
  const [amountOff, setAmountOff] = useState('');
  const [duration, setDuration] = useState('once');
  const [durationMonths, setDurationMonths] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setLoading(true);
    try {
      const body: any = { action: 'create_coupon', name, duration };
      if (discountType === 'percent') body.percent_off = Number(percentOff);
      else body.amount_off = Number(amountOff) * 100; // Convert to cents
      if (duration === 'repeating') body.duration_in_months = Number(durationMonths);
      if (maxRedemptions) body.max_redemptions = Number(maxRedemptions);

      const data = await invoke(body);
      toast.success(`Coupon created! Promo code: ${data.promo_code?.code}`);
      onOpenChange(false);
      onCreated();
      // Reset
      setName(''); setPercentOff(''); setAmountOff(''); setDuration('once'); setDurationMonths(''); setMaxRedemptions('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Coupon</DialogTitle>
          <DialogDescription>Create a coupon with an auto-generated promo code</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Sale" />
          </div>

          <div>
            <Label>Discount Type</Label>
            <RadioGroup value={discountType} onValueChange={(v: any) => setDiscountType(v)} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="percent" id="pct" />
                <Label htmlFor="pct">Percentage</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="amount" id="amt" />
                <Label htmlFor="amt">Fixed Amount</Label>
              </div>
            </RadioGroup>
          </div>

          {discountType === 'percent' ? (
            <div>
              <Label>Percent Off</Label>
              <Input type="number" value={percentOff} onChange={(e) => setPercentOff(e.target.value)} placeholder="e.g. 20" min="1" max="100" />
            </div>
          ) : (
            <div>
              <Label>Amount Off (USD)</Label>
              <Input type="number" value={amountOff} onChange={(e) => setAmountOff(e.target.value)} placeholder="e.g. 5" min="1" />
            </div>
          )}

          <div>
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="repeating">Repeating</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {duration === 'repeating' && (
            <div>
              <Label>Duration (months)</Label>
              <Input type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} placeholder="e.g. 3" min="1" />
            </div>
          )}

          <div>
            <Label>Max Redemptions (optional)</Label>
            <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="Leave empty for unlimited" min="1" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-MANAGE-SUB] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const caller = userData.user;
    if (!caller) throw new Error("Not authenticated");

    // Verify caller is admin
    const { data: callerProfile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (callerProfile?.role !== "admin") {
      throw new Error("Forbidden: admin access required");
    }

    const body = await req.json();
    const { action } = body;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    logStep("Action requested", { action });

    // ─── SEARCH USERS ───
    if (action === "search_users") {
      const { email } = body;
      if (!email) throw new Error("Email is required");
      
      const { data: users } = await supabaseClient.auth.admin.listUsers({ perPage: 50 });
      const matched = users.users
        .filter((u: any) => u.email?.toLowerCase().includes(email.toLowerCase()))
        .slice(0, 20)
        .map((u: any) => ({ id: u.id, email: u.email }));

      return new Response(JSON.stringify({ users: matched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── LIST SUBSCRIBERS ───
    if (action === "list_subscribers") {
      const subscriptions = await stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.customer"] });
      const subscribers = subscriptions.data.map((sub: any) => {
        const customer = sub.customer as Stripe.Customer;
        const priceId = sub.items.data[0]?.price?.id;
        const productId = sub.items.data[0]?.price?.product;
        return {
          subscription_id: sub.id,
          customer_id: customer.id,
          email: customer.email,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: sub.current_period_end,
          price_id: priceId,
          product_id: productId,
        };
      });

      return new Response(JSON.stringify({ subscribers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET USER SUBSCRIPTION ───
    if (action === "get_user_subscription") {
      const { user_email } = body;
      if (!user_email) throw new Error("user_email is required");

      const customers = await stripe.customers.list({ email: user_email, limit: 1 });
      if (customers.data.length === 0) {
        return new Response(JSON.stringify({ subscription: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerId = customers.data[0].id;
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 5 });
      const activeSub = subs.data.find((s: any) => s.status === "active" || s.status === "trialing");

      if (!activeSub) {
        return new Response(JSON.stringify({ subscription: null, customer_id: customerId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        subscription: {
          id: activeSub.id,
          status: activeSub.status,
          cancel_at_period_end: activeSub.cancel_at_period_end,
          current_period_end: activeSub.current_period_end,
          price_id: activeSub.items.data[0]?.price?.id,
          product_id: activeSub.items.data[0]?.price?.product,
          item_id: activeSub.items.data[0]?.id,
        },
        customer_id: customerId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CHANGE PLAN ───
    if (action === "change_plan") {
      const { subscription_id, item_id, new_price_id } = body;
      if (!subscription_id || !item_id || !new_price_id) throw new Error("subscription_id, item_id, and new_price_id required");

      const updated = await stripe.subscriptions.update(subscription_id, {
        items: [{ id: item_id, price: new_price_id }],
        proration_behavior: "always_invoice",
      });

      logStep("Plan changed", { subscription_id, new_price_id });
      return new Response(JSON.stringify({ success: true, subscription: updated.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CANCEL SUBSCRIPTION ───
    if (action === "cancel_subscription") {
      const { subscription_id, immediate } = body;
      if (!subscription_id) throw new Error("subscription_id required");

      if (immediate) {
        await stripe.subscriptions.cancel(subscription_id);
        logStep("Subscription canceled immediately", { subscription_id });
      } else {
        await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: true });
        logStep("Subscription set to cancel at period end", { subscription_id });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CREATE COUPON ───
    if (action === "create_coupon") {
      const { name, percent_off, amount_off, currency, duration, duration_in_months, max_redemptions } = body;

      const couponParams: any = { name, duration: duration || "once" };
      if (percent_off) couponParams.percent_off = percent_off;
      if (amount_off) { couponParams.amount_off = amount_off; couponParams.currency = currency || "usd"; }
      if (duration === "repeating" && duration_in_months) couponParams.duration_in_months = duration_in_months;
      if (max_redemptions) couponParams.max_redemptions = max_redemptions;

      const coupon = await stripe.coupons.create(couponParams);

      // Create a promotion code for this coupon
      const promoCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        max_redemptions: max_redemptions || undefined,
      });

      logStep("Coupon + promo code created", { couponId: coupon.id, promoCode: promoCode.code });
      return new Response(JSON.stringify({ coupon, promo_code: promoCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── LIST COUPONS ───
    if (action === "list_coupons") {
      const coupons = await stripe.coupons.list({ limit: 50 });
      const promoCodes = await stripe.promotionCodes.list({ limit: 100, active: true });

      return new Response(JSON.stringify({ 
        coupons: coupons.data,
        promo_codes: promoCodes.data,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── APPLY COUPON TO USER ───
    if (action === "apply_coupon") {
      const { customer_id, coupon_id } = body;
      if (!customer_id || !coupon_id) throw new Error("customer_id and coupon_id required");

      // Find an active/trialing subscription for this customer to apply the discount
      const subs = await stripe.subscriptions.list({ customer: customer_id, status: "all", limit: 10 });
      const targetSub = subs.data.find((sub) => sub.status === "active" || sub.status === "trialing");

      if (!targetSub) {
        throw new Error("No active subscription found for this customer");
      }

      // Stripe API (2025) uses `discounts`, not `coupon`
      await stripe.subscriptions.update(targetSub.id, {
        discounts: [{ coupon: coupon_id }],
      });

      logStep("Coupon applied to subscription", { customer_id, coupon_id, subscription_id: targetSub.id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DELETE COUPON ───
    if (action === "delete_coupon") {
      const { coupon_id } = body;
      if (!coupon_id) throw new Error("coupon_id required");

      await stripe.coupons.del(coupon_id);
      logStep("Coupon deleted", { coupon_id });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

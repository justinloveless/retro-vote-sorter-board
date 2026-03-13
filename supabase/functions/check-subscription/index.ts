import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const callerUser = userData.user;
    if (!callerUser?.email) throw new Error("User not authenticated or email not available");
    logStep("Caller authenticated", { userId: callerUser.id, email: callerUser.email });

    // Check if a target_user_id was provided (for admin impersonation)
    let emailToCheck = callerUser.email;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON — that's fine
    }

    if (body?.target_user_id && body.target_user_id !== callerUser.id) {
      // Verify the caller is an admin
      const { data: callerProfile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", callerUser.id)
        .single();

      if (callerProfile?.role !== "admin") {
        throw new Error("Only admins can check subscription for other users");
      }

      // Look up the target user's email
      const { data: targetUser, error: targetError } = await supabaseClient.auth.admin.getUserById(body.target_user_id);
      if (targetError || !targetUser?.user?.email) {
        throw new Error("Target user not found or has no email");
      }
      emailToCheck = targetUser.user.email;
      logStep("Admin impersonation: checking subscription for target user", { targetUserId: body.target_user_id, targetEmail: emailToCheck });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: emailToCheck, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let tier = "free";
    let subscriptionEnd = null;
    let productId = null;
    let cancelAtPeriodEnd = false;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
      
      const firstItem = subscription.items.data[0];
      productId = firstItem?.price?.product;
      
      const periodEnd = (firstItem as any).current_period_end;
      logStep("Raw period end from item", { periodEnd, type: typeof periodEnd });
      
      if (periodEnd) {
        subscriptionEnd = new Date(Number(periodEnd) * 1000).toISOString();
      }
      
      const proProducts = ["prod_U8bHBCeWeliSGZ", "prod_U8bHzSN1wed3Ss"];
      const businessProducts = ["prod_U8bHNNAcQOswB3", "prod_U8bIEG4qNUUCUG"];
      
      if (proProducts.includes(productId as string)) {
        tier = "pro";
      } else if (businessProducts.includes(productId as string)) {
        tier = "business";
      }
      
      logStep("Active subscription found", { tier, subscriptionEnd, productId, cancelAtPeriodEnd });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

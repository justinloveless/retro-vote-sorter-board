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
    let userIdToCheck = callerUser.id;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON — that's fine
    }

    if (body?.target_user_id && body.target_user_id !== callerUser.id) {
      const { data: callerProfile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", callerUser.id)
        .single();

      if (callerProfile?.role !== "admin") {
        throw new Error("Only admins can check subscription for other users");
      }

      const { data: targetUser, error: targetError } = await supabaseClient.auth.admin.getUserById(body.target_user_id);
      if (targetError || !targetUser?.user?.email) {
        throw new Error("Target user not found or has no email");
      }
      emailToCheck = targetUser.user.email;
      userIdToCheck = body.target_user_id;
      logStep("Admin impersonation: checking subscription for target user", { targetUserId: body.target_user_id, targetEmail: emailToCheck });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: emailToCheck, limit: 1 });

    let tier = "free";
    let hasActiveSub = false;
    let subscriptionEnd = null;
    let productId = null;
    let cancelAtPeriodEnd = false;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 10,
      });

      hasActiveSub = subscriptions.data.length > 0;

      if (hasActiveSub) {
        const subscription = subscriptions.data[0];
        cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
        
        const firstItem = subscription.items.data[0];
        productId = firstItem?.price?.product;
        
        const periodEnd = (firstItem as any).current_period_end;
        if (periodEnd) {
          subscriptionEnd = new Date(Number(periodEnd) * 1000).toISOString();
        }
        
        const proProducts = ["prod_U8bHBCeWeliSGZ", "prod_U8bHzSN1wed3Ss"];
        const businessProducts = ["prod_U8bHNNAcQOswB3", "prod_U8bIEG4qNUUCUG"];
        const enterpriseProducts = ["prod_U8dn6YKgJqEmRh"];
        
        if (proProducts.includes(productId as string)) {
          tier = "pro";
        } else if (businessProducts.includes(productId as string)) {
          tier = "business";
        } else if (enterpriseProducts.includes(productId as string)) {
          tier = "enterprise";
        }
        
        logStep("Active subscription found", { tier, subscriptionEnd, productId, cancelAtPeriodEnd });
      }
    }

    // If no direct subscription, check if user belongs to an Enterprise org
    if (tier === "free") {
      const { data: orgMemberships } = await supabaseClient
        .from("organization_members")
        .select("organization_id, organizations!inner(owner_id)")
        .eq("user_id", userIdToCheck);

      if (orgMemberships && orgMemberships.length > 0) {
        // Check if any org owner has an enterprise subscription
        for (const membership of orgMemberships) {
          const orgOwner = (membership as any).organizations?.owner_id;
          if (!orgOwner) continue;

          const { data: ownerUser } = await supabaseClient.auth.admin.getUserById(orgOwner);
          if (!ownerUser?.user?.email) continue;

          const ownerCustomers = await stripe.customers.list({ email: ownerUser.user.email, limit: 1 });
          if (ownerCustomers.data.length === 0) continue;

          const ownerSubs = await stripe.subscriptions.list({
            customer: ownerCustomers.data[0].id,
            status: "active",
            limit: 10,
          });

          for (const sub of ownerSubs.data) {
            const subProductId = sub.items.data[0]?.price?.product;
            if (["prod_U8dn6YKgJqEmRh"].includes(subProductId as string)) {
              tier = "enterprise";
              hasActiveSub = true;
              logStep("User inherits enterprise tier from org membership", { orgId: membership.organization_id });
              break;
            }
          }
          if (tier === "enterprise") break;
        }
      }
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

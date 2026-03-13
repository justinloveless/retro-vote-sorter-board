import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("Price ID is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;

      // Check for existing active subscriptions
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
      });

      // If there's an active subscription, update it with proration instead of canceling
      if (existingSubs.data.length > 0) {
        const currentSub = existingSubs.data[0];
        const currentPriceId = currentSub.items.data[0].price.id;

        // If already on this price, no change needed
        if (currentPriceId === priceId) {
          return new Response(JSON.stringify({ error: "You are already on this plan." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        // Update the subscription with proration and invoice immediately
        const updatedSub = await stripe.subscriptions.update(currentSub.id, {
          items: [{
            id: currentSub.items.data[0].id,
            price: priceId,
          }],
          proration_behavior: "always_invoice",
        });

        return new Response(JSON.stringify({ updated: true, subscription_id: updatedSub.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Only create a new checkout session if there's no active subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      // Don't collect payment method if customer already has one
      ...(customerId ? { payment_method_collection: "if_required" } : {}),
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

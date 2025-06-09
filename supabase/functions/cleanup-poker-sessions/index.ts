import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Cleanup poker sessions function running");

serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                },
            }
        );

        // Delete sessions that are not associated with a team (anonymous sessions)
        // and have no active users.
        const { data, error } = await supabase
            .from("poker_sessions")
            .delete()
            .is("team_id", null)
            .eq("active_user_count", 0);

        if (error) {
            throw error;
        }

        const message = `Successfully deleted stale anonymous poker sessions. Count: ${data ? data.length : 0}`;
        console.log(message);

        return new Response(JSON.stringify({ message }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error in cleanup function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}); 
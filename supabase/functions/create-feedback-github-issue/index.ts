import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { feedbackId } = await req.json();
    if (!feedbackId || typeof feedbackId !== "string") {
      return new Response(JSON.stringify({ error: "feedbackId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load the feedback report server-side (never trust client-provided content)
    const { data: report, error: reportError } = await admin
      .from("feedback_reports")
      .select("id, type, title, description, page_url, email, github_issue_url")
      .eq("id", feedbackId)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) {
      return new Response(JSON.stringify({ error: "Feedback not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (report.github_issue_url) {
      return new Response(JSON.stringify({ url: report.github_issue_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Secrets stay server-side: read config with the service role
    const { data: configRows } = await admin
      .from("app_config")
      .select("key, value")
      .in("key", ["GITHUB_REPO", "GITHUB_TOKEN"]);

    const config = Object.fromEntries(
      (configRows ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value]),
    );
    const ghRepo = config.GITHUB_REPO;
    const ghToken = config.GITHUB_TOKEN;

    if (!ghRepo || !ghToken) {
      return new Response(JSON.stringify({ skipped: "GitHub not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghHeaders = {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };

    // Skip if a similar open issue already exists
    const searchQ = encodeURIComponent(`${report.title} repo:${ghRepo} in:title state:open`);
    const searchRes = await fetch(`https://api.github.com/search/issues?q=${searchQ}`, {
      headers: ghHeaders,
    });
    if (searchRes.ok) {
      const searchJson = await searchRes.json();
      const similar = Array.isArray(searchJson.items)
        ? searchJson.items.find(
            (i: { title: string }) => i.title.toLowerCase() === String(report.title).toLowerCase(),
          )
        : null;
      if (similar) {
        return new Response(JSON.stringify({ duplicate: true, url: similar.html_url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const issueRes = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({
        title: `[${report.type}] ${report.title}`,
        body: `${report.description}\n\nSubmitted by: ${report.email || "anonymous"}\nPage: ${report.page_url || "n/a"}`,
        labels: [report.type, "in-app-feedback"],
      }),
    });

    if (!issueRes.ok) {
      const details = await issueRes.text();
      console.error(`GitHub issue creation failed [${issueRes.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: "GitHub request failed", status: issueRes.status, details }),
        { status: issueRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const issue = await issueRes.json();
    await admin
      .from("feedback_reports")
      .update({ github_issue_url: issue.html_url })
      .eq("id", report.id);

    return new Response(JSON.stringify({ url: issue.html_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-feedback-github-issue error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

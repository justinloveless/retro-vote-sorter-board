

## Problem

Jira blocks iframe embedding via `X-Frame-Options` / CSP headers. This is a Jira security policy that cannot be bypassed from the client side.

## Options

### Option A: Render Jira data natively in a side panel / modal (Recommended)

You already have an edge function (`get-jira-issue`) that fetches issue data via the Jira REST API server-side — this works and bypasses CORS/iframe restrictions. The API path (`shouldUseIframe: false`) already returns the issue's `summary` and `description`.

The plan would be to **enhance the existing modal to render richer Jira data** fetched from the API, rather than trying to embed the Jira page. This means:

1. **Expand the fields fetched from Jira** — the edge function already returns the full issue JSON. Extract and display: summary, description, status, priority, assignee, reporter, story points, labels, and comments.
2. **Build a proper issue detail view in the modal** — styled card with sections for each field, rendered as native React components instead of an iframe.
3. **For teams without API credentials** — fall back to an "Open in Jira" button (new tab) instead of a broken iframe, since the iframe approach will never work with Jira Cloud.
4. **Keep the "Open in Jira" external link** for users who want the full Jira experience.

This is the best option because the infrastructure is already in place. The edge function works; the frontend just needs a better renderer.

### Option B: Slide-out drawer instead of modal

Same as Option A but uses a `Sheet` (side drawer) instead of a `Dialog`, so users can still see the poker table and chat while viewing ticket details. This is arguably better UX for the "still able to chat and decide points" requirement.

### Option C: Inline collapsible panel

Instead of a modal/drawer, expand the Jira details inline on the poker page (e.g., below the ticket number). No overlay at all — everything stays visible.

---

## Recommendation

**Option B (side drawer with native rendering)** best matches your goal of letting users view ticket details while continuing to chat and vote. The data is already available via the API; we just need to render it nicely in a `Sheet` component and remove the iframe fallback entirely.

### Changes required

1. **`get-jira-issue/index.ts`** — No changes needed. It already returns the full Jira issue JSON including all fields.
2. **`JiraIssueDrawer.tsx`** — Replace `Dialog` with `Sheet` (side drawer). Remove iframe logic entirely. Parse and render key fields (summary, description, status, priority, assignee, story points, labels) from the API response. For teams without API credentials, show a message prompting them to configure Jira API credentials in team settings, with a fallback "Open in Jira" button.


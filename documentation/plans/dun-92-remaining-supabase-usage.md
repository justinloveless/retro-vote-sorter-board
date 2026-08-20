# DUN-92: Remaining Supabase usage under self-hosted backend

**Date:** 2026-08-20  
**Environment verified:** `https://retroscope.lovelesslabs.net`  
**API:** `https://retroscope-api.lovelesslabs.net`  
**Provider advertisement:** `GET /api/backend-provider` → `{ "mode": "selfhosted", "selfHostedApiBaseUrl": "https://retroscope-api.lovelesslabs.net", "source": "database" }`  
**QA user:** `justin.n.loveless@gmail.com`  
**Method:** Live app walkthrough + Chrome DevTools Network filter on `supabase` / `lovelesslabs`, plus automated request capture across login → teams → team → poker → retro → billing → account → notifications → dashboard.

---

## Verdict

With `backend_provider.mode = selfhosted`, the SPA is **hybrid**. Auth and many `getDb()` CRUD paths hit the Node/PostgREST stack, but **hosted Supabase (`nwfwbjmzbwuyxehindpv.supabase.co`) still receives a large share of traffic** on every navigation.

Captured session totals (full document loads per route):

| Destination | Requests |
|-------------|----------|
| Hosted Supabase | **268** |
| Self-hosted API | **124** |

---

## Runtime catalog (network-verified)

### A. Always-on / global (every page)

| Hosted call | Why it still hits Supabase | Code |
|-------------|----------------------------|------|
| `GET /rest/v1/app_config` (esp. `backend_provider`, also other keys via race) | `fetchBackendProviderConfig()` **always** queries hosted `app_config` first; only then falls back to `GET /api/backend-provider` | `src/lib/backend/config.ts` |
| `POST /functions/v1/check-subscription` | Direct `supabase.functions.invoke` — never routed through `getDb()` / self-hosted functions client. Observed **500** from hosted edge in DevTools while app still works on Free tier. | `src/hooks/useSubscription.ts`, also `useSubscriptionLimits.ts`; pulled in globally via `FeatureFlagProvider` |
| `GET /rest/v1/feature_flags` (+ user/team overrides) | Uses `getDb()`, but fires **before** `resolveDataBackendMode()` finishes; sync `getDb()` defaults to hosted until cache is warm. Full page loads re-race on every navigation. | `src/contexts/FeatureFlagContext.tsx` + `getDataClient.ts` default |
| `GET …/storage/v1/object/public/avatars/…` | Profile `avatar_url` values still store **absolute Supabase Storage URLs** (DB content), so `<img>` loads bypass the self-hosted storage proxy | e.g. profile row for QA user |

### B. Direct hosted client imports (never dual-pathed)

These import `@/integrations/supabase/client` and call hosted APIs regardless of backend mode. Confirmed or strongly implicated by network + code:

| Area | Hosted resources seen / expected | Files |
|------|----------------------------------|-------|
| Billing / limits | `check-subscription`, `create-checkout`, `customer-portal`; `app_config` tier_limits | `useSubscription.ts`, `useSubscriptionLimits.ts`, `Billing.tsx` |
| Favorites | `user_favorite_teams` | `Teams.tsx` |
| Recent activity | `user_recent_activity` (GET + POST/upsert) | `useRecentActivity.ts`, `recentActivity.ts` |
| Team settings | `teams` select/update/delete | `TeamSettings.tsx` |
| Endorsements received / leaderboard | `endorsements` (+ joins) | `EndorsementsReceived.tsx`, `EndorsementLeaderboard.tsx` |
| Mentions | multi-table selects | `MentionsReceived.tsx` |
| Feedback | `feedback_reports` + `create-feedback-github-issue` | `FeedbackButton.tsx` |
| Jira cluster | many `functions/v1/*jira*` | `JiraIssueDrawer.tsx`, queues, points, links, advisor, etc. |
| Slack | `send-slack-notification`, `send-poker-round-to-slack`, team slack fields | `useSlackNotification.ts`, `usePokerSlackNotification.ts`, `useSlackIntegration.ts` |
| Poker table rounds | many `poker_session_rounds` updates | `PokerTableComponent/context.tsx` |
| Retro room privacy | `retro_boards` updates | `RetroRoom.tsx`, `Retro.tsx` |
| Admin config UIs | `app_config` / subscription admin edge | `TtsUrlManager`, `TierLimitsManager`, `GithubIssueSettings`, `AdminSubscriptionManager`, `BackfillActionItems` |
| TTS / audio summary | raw `fetch(…supabase.co/functions/v1/text-to-speech\|generate-audio-summary)` | `AudioPlayerContext.tsx`, `SummaryButton.tsx` |

Static inventory: **~39 active FE files** still import the hosted client (excluding facades `getDataClient.ts`, `config.ts`, `auth/client.ts`). Full path list lives in `self-host-coverage-tracker.md` (Not started rows) and was re-counted for this issue.

### C. Dual traffic on tables already migrated to `getDb()`

Same path observed on **both** hosts in one session (bootstrap race):

| Path | Supabase | Self-host API |
|------|----------|---------------|
| `/rest/v1/notifications` | 14 | 26 |
| `/rest/v1/organizations` | 12 | 12 |
| `/rest/v1/teams` | 6 | 4 |
| `/rest/v1/profiles` | 3 | 12 |

**Root cause:** `getDb()` returns the hosted client until `resolveDataBackendMode()` completes (`cachedMode ?? 'supabase'`). Early `useEffect` callers (FeatureFlag, notifications, org selector, etc.) bind queries to hosted; after resolve, later calls go to Node. Full document navigations repeat the race.

### D. Self-hosted traffic that *is* working

Observed healthy self-hosted calls while mode=`selfhosted`:

- `POST /auth/v1/token` (password login)
- `GET /api/backend-provider`
- `GET/HEAD /rest/v1/profiles`, `organizations`, `teams`, `notifications` (after mode resolve)

---

## Walkthrough notes

| Step | Result |
|------|--------|
| Login on self-hosted site | OK (auth against `retroscope-api`) |
| `/teams` | OK; network still shows hosted `check-subscription` + `app_config` |
| Team detail | Mixed; some team IDs returned “not found” in browser (possible RLS / data skew) while others load |
| Poker session URL | Stuck on “Loading Session…” in automated capture (likely still-direct poker round/session paths + settle time) |
| `/retro/SZSUYO` | Password gate; board loads after `demo123` |
| `/billing`, `/account` | OK; billing continues to invoke hosted subscription edge |

---

## Priority fixes (suggested follow-ups — out of scope for this investigate ticket)

1. **P0 – Stop bootstrap race:** block data fetches until `resolveDataBackendMode()` resolves, or default unknown mode to “pending” instead of hosted Supabase when `VITE_API_BASE_URL` is set.
2. **P0 – Provider config:** prefer `GET /api/backend-provider` (or read hosted only when API base is empty) so mode discovery does not depend on hosted `app_config`.
3. **P0 – `useSubscription` / FeatureFlag:** route `check-subscription` through self-hosted functions (or stub locally); this alone accounts for dozens of hosted calls per session and was failing with HTTP 500 in DevTools.
4. **P1 – Migrate remaining direct `supabase` imports** listed in section B (favorites, activity, team settings, poker context, Jira/Slack edges, admin config).
5. **P1 – Rewrite stored public URLs** for avatars (and other buckets) to self-hosted storage URLs after migrate.

---

## How to re-verify

1. Open `https://retroscope.lovelesslabs.net` → DevTools → Network → filter `supabase.co`.
2. Confirm `GET https://retroscope-api.lovelesslabs.net/api/backend-provider` returns `mode: "selfhosted"`.
3. Sign in and browse Teams / Billing / a Retro room.
4. Expect hosted hits until the follow-ups above land; after fixes, filter should be empty (aside from any intentional dual-path mirror writes).

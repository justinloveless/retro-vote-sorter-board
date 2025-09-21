## C# Passthrough API Plan (Front End → C# → Supabase)

Author: Principal Engineer

Audience: Junior developer (follow every step exactly as written)

### Objective

Build a new HTTP API (C#, .NET 8) that sits between the React front end and Supabase. In Phase 1 it will be a strict passthrough: it receives requests from the front end, forwards them to Supabase (PostgREST and/or Edge Functions) with the user's token, and relays the response back. This indirection lets us later replace Supabase with another data source without changing the front end.

We will implement this with test-driven development (TDD), strict contracts, and a safe, gradual front-end migration.

### Non-Goals (for Phase 1)

- No business logic beyond authentication, request translation, and error normalization.
- No data caching.
- No schema changes in Supabase.

### Deliverables (Phase 1)

- New repository folder: `api/` (C# .NET 8 web API) inside this monorepo.
- Working endpoints for three initial capabilities used by the app today:
  1) Notifications: list current user's notifications.
  2) Team members: list members of a team.
  3) Admin send notification: send a notification (admin function passthrough).
- Type-safe DTOs and clear request/response contracts.
- Automated tests: unit + integration (with HTTP stubs) run in CI.
- Front end migrated to call the C# API via a thin TypeScript client behind a feature flag.

---

## Architecture

### High-Level Flow

Front End → C# API → Supabase (PostgREST and Edge Functions)

- The front end includes the user's Supabase access token in the `Authorization` header when calling the C# API.
- The C# API validates the token signature (via Supabase JWKS) and extracts the user ID.
- The C# API forwards requests to Supabase, passing through the same bearer token whenever we want RLS to apply.
- The C# API normalizes errors and returns consistent JSON responses to the front end.

### Why Pass The User Token Through?

- Passing the user's bearer token to Supabase ensures RLS rules remain enforced server-side. We do not use the service role token in Phase 1 except for explicit admin passthroughs that already require it (in those cases we validate the caller has admin role first).

### Technology Choices

- .NET 8 Web API with Controllers (not Minimal API) for clearer structure for juniors.
- `Microsoft.IdentityModel.Tokens` for JWT validation against Supabase JWKS.
- `HttpClientFactory` and typed clients for Supabase PostgREST and Edge Functions.
- `FluentAssertions`, `xUnit` for unit tests; `WireMock.Net` for HTTP stubbing in integration tests.
- `Serilog` for structured logging and correlation IDs.

---

## Solution Structure

Create the following directory tree at repo root:

```
api/
  src/
    Retroscope.Api/                    # ASP.NET Core Web API (controllers + startup)
    Retroscope.Application/            # Use cases, DTOs, service interfaces
    Retroscope.Infrastructure/         # Supabase gateway, HTTP clients, JWT auth
  tests/
    Retroscope.Api.UnitTests/
    Retroscope.Api.IntegrationTests/
  Dockerfile
  docker-compose.override.yml          # Local dev wiring (optional)
  README.md
```

Project references:

- `Retroscope.Api` -> references `Retroscope.Application` and `Retroscope.Infrastructure`.
- `Retroscope.Application` -> no infra deps (interfaces only).
- `Retroscope.Infrastructure` -> references `Retroscope.Application`.

---

## Environment Configuration

Define these variables for the API (in `api/README.md`, `appsettings.json`, and CI secrets):

- `SUPABASE_URL` (example: `https://your-project.supabase.co`)
- `SUPABASE_JWKS_URL` (example: `${SUPABASE_URL}/auth/v1/keys`)
- `SUPABASE_POSTGREST_URL` (example: `${SUPABASE_URL}/rest/v1`)
- `SUPABASE_FUNCTIONS_URL` (example: `${SUPABASE_URL}/functions/v1`)
- `ALLOW_ORIGINS` (front end origins for CORS)
- `LOG_LEVEL` (e.g., Information)

Optional for admin passthroughs (Phase 1 limit usage):

- `SUPABASE_SERVICE_ROLE_KEY` (only used when absolutely necessary)

---

## Security & Auth

1) The API requires `Authorization: Bearer <supabase_user_token>` from the front end.
2) Validate the JWT signature against `SUPABASE_JWKS_URL` using standard JWT middleware in ASP.NET.
3) Extract `sub` claim as the authenticated user ID.
4) For passthrough operations that rely on RLS, forward the same bearer token to Supabase.
5) For admin operations that currently rely on Supabase Edge Functions protected by service role, verify the caller's role (via custom claim such as `"role":"admin"` or a roles table via a quick PostgREST lookup) before using `SUPABASE_SERVICE_ROLE_KEY` to call the downstream function.

If you cannot validate JWTs locally during early development, you must still parse and require the header. Do not skip auth in any controller.

---

## Contracts (Phase 1)

We will stabilize these contracts and make the front end depend on them, not on Supabase details.

### 1) Notifications

- GET `/api/notifications`
  - Headers: `Authorization: Bearer <user_token>` (required)
  - Query: `limit` (optional, default 50)
  - Response 200:
    ```json
    {
      "items": [
        {
          "id": "string",
          "createdAt": "2025-01-01T12:34:56Z",
          "type": "string",
          "title": "string",
          "body": "string",
          "read": false
        }
      ]
    }
    ```
  - Errors: 401 (missing/invalid token), 502 (downstream error), 500 (unexpected)

Downstream mapping (Supabase PostgREST):

- GET `${SUPABASE_POSTGREST_URL}/notifications?select=*&order=created_at.desc&limit=<limit>` with `Authorization: Bearer <user_token>`.

### 2) Team Members

- GET `/api/teams/{teamId}/members`
  - Headers: `Authorization: Bearer <user_token>` (required)
  - Response 200:
    ```json
    {
      "items": [
        {
          "teamId": "string",
          "userId": "string",
          "displayName": "string",
          "email": "string",
          "role": "member|admin"
        }
      ]
    }
    ```
  - Errors: same as above

Downstream mapping (Supabase PostgREST):

- GET `${SUPABASE_POSTGREST_URL}/team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.<teamId>` with `Authorization: Bearer <user_token>`.

### 3) Admin Send Notification

- POST `/api/admin/notifications`
  - Headers: `Authorization: Bearer <user_token>` (required)
  - Body:
    ```json
    {
      "title": "string",
      "body": "string",
      "targetUserIds": ["uuid1", "uuid2"]
    }
    ```
  - Response 202:
    ```json
    { "status": "queued" }
    ```
  - Errors: 401/403 if not admin, 502, 500

Downstream mapping (Supabase Edge Function):

- POST `${SUPABASE_FUNCTIONS_URL}/admin-send-notification` with `Authorization: Bearer <service_role_key>` once we verify the caller is admin. If the Edge Function accepts user tokens and performs its own auth, forward the user token instead.

Note: Verify the existing Supabase function's expectations by opening `supabase/functions/admin-send-notification/index.ts` and mirroring its shape exactly.

---

## Implementation Plan (TDD)

Follow these steps in order. Do not skip tests.

### Step 0: Initialize Solution

1) From repo root, create the API solution:
```
mkdir -p api && cd api
dotnet new sln -n Retroscope
dotnet new webapi -n Retroscope.Api -o src/Retroscope.Api --use-controllers
dotnet new classlib -n Retroscope.Application -o src/Retroscope.Application
dotnet new classlib -n Retroscope.Infrastructure -o src/Retroscope.Infrastructure
dotnet new xunit -n Retroscope.Api.UnitTests -o tests/Retroscope.Api.UnitTests
dotnet new xunit -n Retroscope.Api.IntegrationTests -o tests/Retroscope.Api.IntegrationTests
dotnet sln add src/Retroscope.Api/ src/Retroscope.Application/ src/Retroscope.Infrastructure/ tests/Retroscope.Api.UnitTests/ tests/Retroscope.Api.IntegrationTests/
dotnet add src/Retroscope.Api reference src/Retroscope.Application src/Retroscope.Infrastructure
dotnet add src/Retroscope.Infrastructure reference src/Retroscope.Application
```

2) Add packages:
```
dotnet add src/Retroscope.Api package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add src/Retroscope.Api package Serilog.AspNetCore
dotnet add src/Retroscope.Infrastructure package Microsoft.Extensions.Http.Polly
dotnet add src/Retroscope.Infrastructure package System.IdentityModel.Tokens.Jwt
dotnet add tests/Retroscope.Api.UnitTests package FluentAssertions
dotnet add tests/Retroscope.Api.UnitTests package Moq
dotnet add tests/Retroscope.Api.IntegrationTests package WireMock.Net
```

3) Configure CORS for front end origins in `Program.cs` using `ALLOW_ORIGINS`.

4) Configure JWT bearer auth to validate via `SUPABASE_JWKS_URL` (audience, issuer from Supabase docs).

### Step 1: Define Application Layer Contracts (Red → Green → Refactor)

1) In `Retroscope.Application`, create DTOs and interfaces:
   - `Notifications` DTOs: `NotificationItem`, `NotificationsResponse`.
   - `TeamMembers` DTOs: `TeamMemberItem`, `TeamMembersResponse`.
   - `AdminSendNotificationRequest`, `AdminSendNotificationResponse`.
   - Interface `ISupabaseGateway` with methods needed:
     - `Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, CancellationToken ct)`
     - `Task<TeamMembersResponse> GetTeamMembersAsync(string bearerToken, string teamId, CancellationToken ct)`
     - `Task<AdminSendNotificationResponse> AdminSendNotificationAsync(string authHeader, AdminSendNotificationRequest req, CancellationToken ct)`

2) Write unit tests in `Retroscope.Api.UnitTests` against controller behaviors using a mocked `ISupabaseGateway`:
   - When GET `/api/notifications` is called with `Authorization`, the controller extracts token and calls `GetNotificationsAsync` with correct params; returns 200 with body.
   - When no `Authorization`, returns 401.
   - Error from gateway → controller maps to 502.
   - Repeat for team members and admin send notification.

3) Run tests (they should fail because controllers don’t exist yet).

### Step 2: Implement Controllers (Green)

1) In `Retroscope.Api`, add controllers:
   - `NotificationsController` with `GET /api/notifications`.
   - `TeamMembersController` with `GET /api/teams/{teamId}/members`.
   - `AdminNotificationsController` with `POST /api/admin/notifications`.

2) Inject `ISupabaseGateway` from DI and call it. Map exceptions to 4xx/5xx. Always require `[Authorize]` attribute.

3) Make unit tests pass.

### Step 3: Implement Infrastructure Gateway (Green)

1) In `Retroscope.Infrastructure`, implement `SupabaseGateway` using `HttpClientFactory`:
   - Typed client `PostgrestClient` configured with base `${SUPABASE_POSTGREST_URL}`.
   - Typed client `FunctionsClient` configured with base `${SUPABASE_FUNCTIONS_URL}`.
   - Methods build downstream requests, set `Authorization` header exactly as received from the front end (unless using service role for admin), and deserialize JSON into the DTOs.

2) Add simple retry policy (Polly) for transient 5xx.

3) Add structured logging with correlation ID `X-Correlation-Id`. If inbound header missing, generate a GUID and include it in downstream requests.

### Step 4: Integration Tests with WireMock.Net

1) Start an in-memory stub server representing PostgREST and Edge Functions.

2) Configure the API under test to point its `SUPABASE_POSTGREST_URL` and `SUPABASE_FUNCTIONS_URL` to the stub URLs.

3) Tests:
   - Notifications: stub a 200 response with a few items; assert API returns normalized payload.
   - Team members: stub 200 with joined profile fields; assert mapping.
   - Admin send notification: stub 202; assert API returns `{ "status": "queued" }`.
   - Error mapping: PostgREST 500 → API 502; missing auth → 401.

### Step 5: Observability & Hardening

1) Ensure all responses include `Request-Id` header.
2) Log key events: request start/end, downstream call duration, non-2xx responses.
3) Define a standard error envelope:
```
{
  "error": {
    "code": "string",         // e.g., DOWNSTREAM_ERROR
    "message": "string",
    "correlationId": "guid"
  }
}
```

4) Add health endpoints: `/healthz` (liveness), `/readyz` (readiness including attempt to fetch JWKS once).

---

## Front-End Migration Plan (Very Explicit)

We will introduce a new TypeScript API client and switch hooks one-by-one behind a feature flag. Do exactly the following.

### Step A: Add Feature Flag and Base URL

1) Add `VITE_USE_CSHARP_API=true` in `.env.local`.
2) Add `VITE_API_BASE_URL=http://localhost:5099` (or whatever the API exposes).

### Step B: Create API Client Wrapper

Create a new file `src/lib/apiClient.ts` with these functions (exact names):

```ts
export async function apiGetNotifications(limit = 50): Promise<{ items: Array<any> }>{
  const base = import.meta.env.VITE_API_BASE_URL;
  const token = await getSupabaseAccessToken(); // reuse existing auth util
  const res = await fetch(`${base}/api/notifications?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGetTeamMembers(teamId: string): Promise<{ items: Array<any> }>{
  const base = import.meta.env.VITE_API_BASE_URL;
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/teams/${teamId}/members`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiAdminSendNotification(payload: { title: string; body: string; targetUserIds: string[] }): Promise<{ status: string }>{
  const base = import.meta.env.VITE_API_BASE_URL;
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/admin/notifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
```

Note: Implement `getSupabaseAccessToken()` by reusing your existing auth context/hook that already holds the Supabase session.

### Step C: Switch Hooks One-by-One (Guarded by Flag)

Modify these files exactly, wrapping existing Supabase calls with a flag:

1) `src/hooks/useNotifications.ts`
   - If `VITE_USE_CSHARP_API === 'true'`, call `apiGetNotifications(limit)`.
   - Else, keep the current Supabase logic.

2) `src/components/team/TeamMembersList.tsx` (or its underlying `useTeamMembers` hook if present)
   - If `VITE_USE_CSHARP_API === 'true'`, call `apiGetTeamMembers(teamId)`.
   - Else, keep the current Supabase logic.

3) `src/components/admin/AdminSendNotification.tsx`
   - If `VITE_USE_CSHARP_API === 'true'`, call `apiAdminSendNotification(payload)`.
   - Else, keep the current Supabase function call.

Remove the flag and old branches only after we reach parity and all tests pass.

### Step D: Front-End Tests (Vitest)

1) Add unit tests for `apiClient.ts` by mocking `fetch`.
2) For each switched hook, add a test that when the flag is true, the hook calls `apiClient` and returns the expected shape.

---

## Progressive Coverage Roadmap (Phase 2+)

We will expand coverage from the initial 3 endpoints to the full surface of front-end Supabase usage using a repeatable, test-first recipe. Follow this exactly every time you add coverage.

### A) Inventory All Current Supabase Usage (One-Time, Then Ongoing)

1) Search for Supabase client usage in the front end:
   - Find `.from(`, `.rpc(`, `.storage.`, `.functions.`, `.channel(`, `.auth.` in `src/**/*.ts{,x}`.
   - Record each usage in a tracker file: `documentation/plans/csharp-api-coverage-tracker.md` with columns: `Feature`, `File`, `Call Type`, `Supabase Resource`, `New API Endpoint`, `Status`.

2) Seed the tracker with these feature groups (read code under `src/hooks` and `src/components` to fill in rows):
   - Auth & Profiles (login, session, profile CRUD)
   - Teams (teams list/create/update/delete)
   - Team Members (add/remove/update roles)
   - Boards: Retro (board CRUD, columns, items, votes, comments, grouping, sentiment)
   - Poker (session CRUD, join/leave, voting, reveal, chat, history)
   - Notifications (list, mark read, send)
   - Invitations (create, accept)
   - Slack integration (create retro from Slack, send notifications, poke)
   - Storage (avatars, backgrounds)
   - Realtime (channels/Presence)

3) Keep the tracker updated on every PR that changes Supabase usage or adds API coverage.

### B) Repeatable Per-Endpoint Expansion Procedure (TDD)

For each Supabase call you migrate, do this in order:

1) Define contract in `Retroscope.Application` (request/response DTOs, interface method on `ISupabaseGateway`).
2) Write a failing unit test in `Retroscope.Api.UnitTests` for the controller route and auth requirements.
3) Implement the controller action in `Retroscope.Api` to make the test green.
4) Implement the gateway method in `Retroscope.Infrastructure` to call the matching PostgREST/Function/RPC. Map fields exactly and normalize errors.
5) Write an integration test in `Retroscope.Api.IntegrationTests` using WireMock:
   - Stub downstream endpoint and assert response shape and headers (including `Authorization` and `X-Correlation-Id`).
6) Update the front end: behind the flag, call the new API route from the relevant hook/component.
7) Add/adjust front-end tests to cover the new path.
8) Update the coverage tracker row: mark `Status=Covered` and link to the API route.

### C) Module-by-Module Phasing

Execute phases in this order to reduce risk and maximize value. Do not start a new phase until the previous phase meets its Definition of Done.

- Phase 2: Notifications parity
  - Add: mark-as-read, mark-all-read, delete (if exists).
  - Endpoints: `PATCH /api/notifications/{id}`, `POST /api/notifications/mark-all-read`.

- Phase 3: Teams and Team Members
  - Teams: list/create/update/delete.
  - Members: list/add/remove/update-role.
  - Endpoints: `GET/POST/PATCH/DELETE /api/teams`, `POST/DELETE /api/teams/{teamId}/members`, `PATCH /api/teams/{teamId}/members/{userId}`.

- Phase 4: Retro Boards
  - Board CRUD, columns, items, comments, votes, merge/group, export.
  - Edge Functions passthroughs: sentiment analysis, audio summary (if used).
  - Endpoints: under `/api/retro/...` mirroring current features.

- Phase 5: Poker
  - Session CRUD, join/leave, vote, reveal, chat, history.
  - Endpoints: `/api/poker/sessions`, `/api/poker/sessions/{id}/votes`, `/api/poker/sessions/{id}/reveal`, `/api/poker/sessions/{id}/chat`, `/api/poker/history`.

- Phase 6: Invitations & Links
  - Create invite links, accept invites, revoke.
  - Endpoints: `/api/invitations/...`.

- Phase 7: Slack Integration & Admin
  - Passthrough to relevant Supabase functions (admin-search-users, team-members, send-notification, slack-create-retro, slack-poke).
  - Ensure admin role checks before using service role.

- Phase 8: Storage
  - Avatars/backgrounds upload/download; signed URLs.
  - Endpoints: `/api/storage/...` with upload tokens or direct proxy.

- Phase 9: Realtime Strategy
  - Short term: keep Supabase Realtime directly from front end.
  - Long term: move to server-mediated realtime (e.g., SignalR) or a gateway proxy, abstracted behind the same client. Plan a separate design doc before starting Phase 9.

For every phase, apply the TDD procedure (Section B) to each endpoint in scope.

### D) Versioning, Backward Compatibility, and Deprecation

1) Version the API from the start: `/api/v1/...`.
2) Do not change response shapes without bumping a minor version and keeping the old route until the front end migrates.
3) Mark old direct Supabase code paths in the front end with `@deprecated` comments including the replacement API route.
4) After a module reaches 100% coverage and has baked in prod for 2 weeks, remove the old Supabase path and delete dead code.

### E) Exit Criteria to Remove Supabase from Front End

We will fully remove Supabase JS from the front end only when all are true:

- The coverage tracker shows 100% of calls mapped to C# API routes (excluding realtime if intentionally deferred).
- `rg` (ripgrep) for `from\(|rpc\(|functions\.|storage\.|channel\(|supabase\.auth` in `src/` returns 0 results.
- All integration and E2E tests pass with the feature flag forced ON.
- Observability shows no 4xx/5xx regressions relative to baseline.

### F) Metrics and Quality Gates

- Coverage KPI: `# of direct Supabase call sites remaining` (target goes to 0).
- Error Budget: downstream 5xx mapped to 502 should not exceed baseline by >10% during migration.
- Performance: added latency per call < 40 ms P50 in local tests, < 80 ms P95 in prod.
- Security: 100% of routes require JWT auth; admin routes verified with role checks.

### G) Working Agreement for New Features

- New features must be implemented against the C# API only. Do not add new direct Supabase usage in the front end. If something is missing in the API, add it first using the TDD procedure.

## Local Development

1) Run the C# API:
```
cd api
dotnet build
dotnet run --project src/Retroscope.Api
```

2) Set environment variables in `api/src/Retroscope.Api/appsettings.Development.json` or user secrets.

3) Run front end with `VITE_USE_CSHARP_API=true` and `VITE_API_BASE_URL` pointing at the API URL.

4) Verify the three flows manually:
   - Notification bell shows items.
   - Team members list renders correctly.
   - Admin send notification completes (or returns a mocked 202 if you’re not wired to the real function yet).

---

## CI/CD (Phase 1)

1) Extend existing GitHub Actions (or add a new workflow under `api/.github/workflows/build.yml`) to run:
   - `dotnet restore`
   - `dotnet build --configuration Release`
   - `dotnet test --configuration Release`

2) Build a Docker image for the API with multi-stage `api/Dockerfile`.

3) Update `docker-compose.yml` (at repo root or under `api/`) to include the API for local orchestration with front end and (optionally) a WireMock container for integration tests.

4) Deploy alongside the existing site behind NGINX. Add a location block for `/api/` that points to the API service, keeping CORS in the API.

---

## Error Handling & Mapping Rules

- 401 Unauthorized: Missing or invalid token at the API boundary.
- 403 Forbidden: Caller lacks necessary role for admin passthroughs.
- 422 UnprocessableEntity: Bad request payload (validation).
- 502 BadGateway: Downstream Supabase errors (4xx/5xx that aren’t caller’s fault).
- 500 InternalServerError: Unhandled exceptions in the API (also logged).

Always include `correlationId` in error responses and logs.

---

## Risks and Mitigations

- Risk: JWT validation drift with Supabase configuration. Mitigation: integration test that fetches JWKS and validates a known token structure (use a test token or disable signature check only in test environment).
- Risk: RLS behavior changes when proxying. Mitigation: forward exact user token; write integration tests asserting 403 from Supabase flows through as 403 to client when appropriate.
- Risk: Contract mismatch with front end. Mitigation: define DTOs in one place and write front-end tests that assert expected shapes.

---

## Definition of Done (Phase 1)

- All three endpoints implemented and tested (unit + integration).
- API runs locally; front end works with flag enabled.
- CI pipeline builds and runs tests on PR.
- Logs contain correlation IDs; health endpoints respond correctly.
- Documentation (this file and `api/README.md`) is updated.

---

## Exact Next Tasks (Do These In Order)

1) Create the .NET solution and projects as shown (Step 0). Commit.
2) Implement application contracts and write red unit tests for controllers (Step 1). Commit.
3) Implement controllers to make tests green (Step 2). Commit.
4) Implement `SupabaseGateway` and add integration tests with WireMock (Step 3–4). Commit.
5) Wire logging, CORS, health endpoints (Step 5). Commit.
6) Add `src/lib/apiClient.ts` and flip `useNotifications` behind the flag. Verify manually. Commit.
7) Flip team members and admin send notification behind the flag. Commit.
8) Add front-end tests for the three flows. Commit.
9) Add CI workflow for API. Commit.
10) Open PR. Request review.



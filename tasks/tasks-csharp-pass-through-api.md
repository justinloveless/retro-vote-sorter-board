## Tasks: C# Passthrough API (Front End → C# → Supabase)

Source plan: `documentation/plans/csharp-pass-through-api-plan.md`

Process guide: `documentation/plans/development-process.md`

Status values: Not started | In progress | Blocked | In review | Done

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 1 | Create .NET solution and projects | From repo root, create `api/` folder and run the exact commands in the plan Step 0 to generate `Retroscope.Api`, `Retroscope.Application`, `Retroscope.Infrastructure`, and the two test projects. Ensure solution references are added as shown. | Done | - | You must run the commands exactly. After creation, open the solution and confirm each project builds. If you get a build error, re-check project references and target .NET 8. |
| 2 | Add NuGet packages | Add all packages listed in Step 0 (JWT bearer, Serilog, Polly, Jwt, FluentAssertions, Moq, WireMock.Net). | Done | 1 | Use `dotnet add <project> package <name>`. Verify `dotnet restore` passes and no version conflicts. |
| 3 | Configure CORS & JWT auth | In `Retroscope.Api` `Program.cs`, add CORS for `ALLOW_ORIGINS` and JWT bearer auth pointing to `SUPABASE_JWKS_URL`. | Done | 1,2 | The API must require `Authorization: Bearer <supabase_user_token>`. Do not allow anonymous access to protected controllers. |
| 4 | Define Application DTOs & Interfaces | In `Retroscope.Application`, create DTOs: `NotificationItem`, `NotificationsResponse`, `TeamMemberItem`, `TeamMembersResponse`, `AdminSendNotificationRequest`, `AdminSendNotificationResponse`. Add `ISupabaseGateway` interface with required methods. | Done | 1 | DTO fields must match the contracts in the plan. Keep this project free of infra dependencies. |
| 5 | Write red unit tests for controllers | In `Retroscope.Api.UnitTests`, write tests for 3 endpoints asserting auth requirement and successful responses via mocked `ISupabaseGateway`. | Done | 4 | Tests should fail now because controllers aren't implemented yet. Use Moq and FluentAssertions. |
| 6 | Implement controllers to pass tests | Add `NotificationsController`, `TeamMembersController`, `AdminNotificationsController` with `[Authorize]` and correct routes. | Done | 5 | Extract bearer token, call gateway, map exceptions to 401/403/502. Make all tests from Task 5 pass. |
| 7 | Implement SupabaseGateway | In `Retroscope.Infrastructure`, implement `SupabaseGateway` using `HttpClientFactory` with PostgREST and Functions clients. | Not started | 4 | Forward `Authorization` header exactly as received (unless admin service role). Deserialize JSON to DTOs. Add Polly retry for transient 5xx. |
| 8 | Add structured logging & correlation IDs | Configure Serilog in API. Ensure each request has a `Request-Id` and propagate `X-Correlation-Id` to downstream calls. | Not started | - | If inbound `X-Correlation-Id` missing, generate a GUID. Log start/end, status codes, and durations. |
| 9 | Add health endpoints | Implement `/healthz` and `/readyz`. | Not started | 1 | `/readyz` should validate JWKS can be fetched once or confirm last fetch succeeded. |
| 10 | Integration tests with WireMock | In `Retroscope.Api.IntegrationTests`, spin up WireMock to stub PostgREST/Functions and test the 3 endpoints, including error mapping. | Not started | 6,7 | Verify headers, response shapes, and that PostgREST 500 maps to API 502; missing auth → 401. |
| 11 | Front-end API client wrapper | Create `src/lib/apiClient.ts` with `apiGetNotifications`, `apiGetTeamMembers`, and `apiAdminSendNotification` functions that call the C# API with the Supabase user token. | Not started | - | Follow the exact function shapes in the plan. Implement `getSupabaseAccessToken()` using existing auth/session utilities. |
| 12 | Feature flag and base URL | Add `.env.local` values: `VITE_USE_CSHARP_API=true`, `VITE_API_BASE_URL=http://localhost:5099`. | Not started | - | Ensure Vite picks these up. Restart dev server if required. |
| 13 | Migrate useNotifications behind flag | Update `src/hooks/useNotifications.ts` to call `apiGetNotifications` when the flag is true; keep old path otherwise. | Not started | 6,11,12 | Add unit tests in FE to mock `fetch` and verify. |
| 14 | Migrate TeamMembers behind flag | Update `src/components/team/TeamMembersList.tsx` (or `useTeamMembers`) to call `apiGetTeamMembers` when the flag is true. | Not started | 6,11,12 | Keep existing Supabase logic for flag=false. |
| 15 | Migrate AdminSendNotification behind flag | Update `src/components/admin/AdminSendNotification.tsx` to call `apiAdminSendNotification` when the flag is true. | Not started | 6,7,11,12 | Ensure admin-only UI paths remain protected as today. |
| 16 | Front-end tests for migrated hooks | Add Vitest tests verifying each migrated path calls the API when flag=true and preserves old behavior when flag=false. | Not started | 11,12,13,14,15 | Mock `fetch` responses and assert shapes match plan DTOs. |
| 17 | CI for API | Add GitHub Actions workflow to build and test the API on PR. | Not started | 1,2 | Steps: restore, build Release, test Release. Fail PR on test failure. |
| 18 | Dockerize API | Create multi-stage `api/Dockerfile` for .NET publish and runtime layers. | Not started | 1 | Ensure environment variables map correctly at runtime. |
| 19 | Compose local stack | Update repo `docker-compose.yml` (or add in `api/`) to include the API service and optionally a WireMock container. | Not started | 18 | Expose API at `http://localhost:5099`. Confirm CORS allows the front end origin. |
| 20 | NGINX routing to API | Update NGINX config to route `/api/` to the API container/service. | Not started | 18,19 | Preserve static asset routes. Verify via browser devtools network. |
| 21 | Progressive coverage tracker setup | Create and maintain `documentation/plans/csharp-api-coverage-tracker.md`. Add rows for each Supabase usage. | In progress | - | Update on each PR. Use phases in plan to prioritize. |
| 22 | Phase 2: Notifications parity | Implement mark-as-read and mark-all-read endpoints with tests and FE migration behind flag. | Not started | 6,7,10 | Follow TDD recipe: contract → tests → controller → gateway → integration tests → FE switch. |
| 23 | Phase 3: Teams & Members | Add teams CRUD and member add/remove/role endpoints, tests, and FE migration. | Not started | 22 | Ensure RLS via user token; admin checks where required. |
| 24 | Phase 4: Retro boards | Add retro endpoints (CRUD, columns, items, comments, votes, grouping, exports), tests, and FE migration. | Not started | 23 | Mirror existing shapes from hooks; add function passthroughs for sentiment/audio if used. |
| 25 | Phase 5: Poker | Add poker session endpoints (CRUD, join/leave, vote, reveal, chat, history), tests, and FE migration. | Not started | 24 | Verify chat/history pagination and ordering match current UI. |
| 26 | Phase 6: Invitations & links | Implement invite endpoints and FE migration. | Not started | 25 | Preserve security checks that invites belong to the right team/user. |
| 27 | Phase 7: Slack/Admin passthroughs | Add Slack/admin passthrough endpoints with strict admin role validation. | Not started | 23 | Use service role key only if downstream requires it; otherwise pass user token. |
| 28 | Phase 8: Storage | Add avatar/background upload/signed-URL endpoints and FE migration. | Not started | 23 | Consider proxy vs signed URL approach; document in README. |
| 29 | Phase 9: Realtime strategy | Draft separate design doc; implement gateway or SignalR if approved. | Not started | - | Keep FE on Supabase Realtime until replaced; do not block other phases. |
| 30 | Remove direct Supabase from FE | After 100% coverage and burn-in, delete old Supabase code paths. | Not started | 22-29 | Confirm exit criteria in plan: coverage 100%, ripgrep finds 0 call sites, tests green. |



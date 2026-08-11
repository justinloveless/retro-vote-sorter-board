# Self-Host Coverage Tracker (FE → Node / Postgres)

Companion to `documentation/plans/self-host-node-postgres-migration-plan.md` (DUN-74).

Legend for Status: Not started | In progress | Covered | Switched | Deprecated

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Auth session | src/hooks/useAuth.tsx | Auth | supabase.auth | Node `/auth/v1/*` | Not started | Password + Google |
| Auth form | src/components/AuthForm.tsx | Auth | OAuth + password | Node auth facade | Not started | |
| Password reset | src/pages/ResetPassword.tsx | Auth | recovery tokens | Node recover/confirm | Not started | |
| Profiles | src/hooks/useAuth.tsx | PostgREST | profiles | PostgREST/Node | Not started | Includes role=admin |
| Notifications | src/hooks/useNotifications.ts | PostgREST + Realtime | notifications | REST + WS | Not started | |
| Teams CRUD | src/hooks/useTeams.ts | PostgREST | teams | REST | Not started | |
| Team members | src/hooks/useTeamMembers.ts | PostgREST | team_members | REST | Not started | |
| Retro board | src/hooks/useRetroBoard.ts | PostgREST + Realtime | retro_* | REST + WS | Not started | Presence critical |
| Poker session | src/hooks/usePokerSession.ts | PostgREST + Realtime | poker_* | REST + WS | Not started | Presence critical |
| Poker chat | src/hooks/usePokerSessionChat.ts | PostgREST + Storage + Realtime | chat + images | REST + storage + WS | Not started | |
| Feature flags | src/contexts/FeatureFlagContext.tsx | PostgREST + Realtime | feature_flags | REST + WS | Not started | |
| Organizations | src/hooks/useOrganizations.ts | PostgREST + RPC | orgs / invites | REST + RPC ports | Not started | |
| Admin notifications | src/components/admin/AdminSendNotification.tsx | Edge Function | admin-send-notification | Node admin route | Not started | |
| Admin user search | src/components/admin/* | Edge Function | admin-search-users | Node admin route | Not started | |
| Jira integrations | various hooks | Edge Functions | get/update-jira-* | Node `/api/jira/*` | Not started | Defer if unused |
| Slack integrations | various | Edge Functions | slack-* | Node `/api/slack/*` | Not started | Defer if unused |
| Stripe billing | subscription hooks | Edge Functions | check-subscription, checkout | Decision pending | Not started | |
| Storage avatars | account components | Storage | avatars | MinIO/disk | Not started | |
| Backend toggle | (new) Admin Backend page | Config | app_config.backend_provider | Node + FE facade | Not started | Admin-only |
| PostgREST data path | selfhosted restClient | PostgREST | local tables + RLS | Coolify-internal PostgREST | Not started | Sidecar approved; no public domain |
| Coolify deploy | docker-compose.selfhost.yml | Ops | web/api/postgres/postgrest | Coolify resource | Not started | Shared VPS; expose + limits |

Update this table whenever a call site is migrated.

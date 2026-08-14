# Self-Host Coverage Tracker (FE → Node / Postgres)

Companion to `documentation/plans/self-host-node-postgres-migration-plan.md` (DUN-74).

**Phase 0 inventory date:** 2026-08-11 (from `main` / current branch FE sources under `src/`).

Legend for Status: Not started | In progress | Covered | Switched | Deprecated

Update this table whenever a call site is migrated.

---

## Inventory summary

| Call type | Count (approx) | Notes |
|-----------|----------------|-------|
| `.from('<table>')` call sites | ~280 | Dominant path; PostgREST sidecar |
| Distinct tables / views | 37 | Includes `poker_session_chat_with_details` view |
| `functions.invoke` call sites | ~59 | 29 distinct edge functions referenced from FE |
| `.rpc(...)` call sites | 6 | 5 distinct RPCs |
| `.channel(...)` sites | 15 | Realtime / presence / broadcast |
| Storage buckets used in FE | 3 | `avatars`, `poker-session-chat-images`, `retro-audio` (`tts-audio-cache` is edge-only today) |

### Tables / views by FE `.from` frequency

| Resource | ~calls | Domain |
|----------|--------|--------|
| poker_session_rounds | 33 | Poker |
| teams | 26 | Teams / integrations settings on row |
| retro_boards | 24 | Retro |
| profiles | 20 | Auth / identity |
| team_action_items | 18 | Teams |
| poker_sessions | 16 | Poker |
| team_members | 15 | Teams |
| team_invitations | 11 | Invites |
| app_config | 10 | Admin / config / toggle target |
| retro_columns | 9 | Retro |
| retro_items | 7 | Retro |
| retro_board_config | 7 | Retro |
| board_templates | 7 | Templates |
| retro_comments | 6 | Retro |
| poker_session_chat | 6 | Poker chat |
| organizations | 5 | Orgs |
| endorsement_types / endorsements | 5 each | Endorsements |
| template_columns | 4 | Templates |
| organization_members / organization_invitations | 4 / 3 | Orgs |
| notifications | 4 | Notifications |
| feature_flags (+ user/team overrides) | 4 each | Flags |
| user_favorite_teams | 3 | Teams |
| retro_votes | 3 | Retro |
| org_team_invite_codes | 3 | Orgs |
| user_recent_activity | 2 | Activity |
| retro_user_readiness | 2 | Retro |
| poker_session_chat_message_reactions | 2 | Poker chat |
| endorsement_settings | 2 | Endorsements |
| team_default_settings | 1 | Teams |
| retro_board_sessions | 1 | Slack / retro |
| poker_session_chat_with_details | 1 | Poker chat view |
| jira_integration_settings | 1 | Jira |
| feedback_reports | 1 | Feedback |

Storage bucket string hits via `.from` (not PostgREST tables): `avatars` (4), `retro-audio` (4). Chat images use `poker-session-chat-images` via `storage.from`.

### Edge functions referenced from FE

| Function | ~calls | Priority |
|----------|--------|----------|
| update-jira-issue | 5 | P2 |
| get-jira-board-issues | 5 | P2 |
| admin-team-members | 5 | P0 |
| get-jira-issue | 4 | P2 |
| create-jira-issue | 4 | P2 |
| send-invitation-email | 3 | P0 |
| admin-send-notification | 3 | P0 |
| admin-search-users | 3 | P0 |
| update-jira-issue-points | 2 | P2 |
| notify-team-invite | 2 | P0 |
| get-jira-issue-v3 | 2 | P2 |
| get-jira-issue-field-options | 2 | P2 |
| check-subscription | 2 | P3 |
| update-jira-issue-v2, update-jira-issue-sprint, send-slack-notification, send-poker-round-to-slack, search-jira-assignable-users, notify-retro-start, notify-org-invite, manage-jira-issue-link, get-jira-sprint-options, delete-session-data, customer-portal, create-feedback-github-issue, create-checkout, analyze-board-sentiment, admin-manage-subscription, add-jira-issue-comment | 1 each | P1–P3 |

### RPCs

| RPC | Files |
|-----|-------|
| get_user_email_if_admin | `src/hooks/useAuth.tsx` path via Account/AppHeader |
| accept_team_invitation | `src/hooks/useInvitationAccept.ts` |
| accept_org_invitation | `src/pages/OrgInviteAccept.tsx` |
| get_org_team_invite | `src/pages/JoinOrg.tsx` |
| seed_default_endorsement_types | `src/hooks/useEndorsementTypes.ts` |

---

## Coverage rows (by feature)

### Auth

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Auth state / session | src/hooks/useAuth.tsx | Auth | onAuthStateChange, signOut, getSession | Node `/auth/v1/*` | Not started | |
| Google OAuth | src/components/AuthForm.tsx | Auth | signInWithOAuth(google) | Node authorize/callback | Not started | Preserve identity UUID |
| Password signup/signin | src/components/AuthForm.tsx | Auth | signUp, signInWithPassword | Node token endpoints | Not started | Import bcrypt hashes |
| Password reset request | src/components/AuthForm.tsx | Auth | resetPasswordForEmail | Node recover | Not started | |
| Password reset confirm | src/pages/ResetPassword.tsx | Auth | setSession, updateUser | Node confirm-reset | Not started | |
| Change password | src/pages/Account.tsx | Auth | signInWithPassword, updateUser | Node | Not started | |
| getUser helpers | many hooks | Auth | auth.getUser / getSession | Node | Not started | Scattered |

### Profiles & config

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Profile load/update | src/hooks/useAuth.tsx | PostgREST | profiles | PostgREST | Covered | getDb(); selfhosted → /rest/v1 |
| Theme profile fields | src/contexts/ThemeContext.tsx | PostgREST | profiles | PostgREST | Covered | getDb() |
| Background profile fields | src/contexts/BackgroundContext.tsx | PostgREST | profiles | PostgREST | Covered | getDb() |
| App config reads/writes | src/contexts/FeatureFlagContext.tsx, admin/*, Billing | PostgREST | app_config | PostgREST | Not started | Includes future backend_provider |
| Feature flags | src/contexts/FeatureFlagContext.tsx | PostgREST + Realtime | feature_flags, overrides | PostgREST + WS | Not started | channel feature-flags-realtime |
| Admin feature flag UI | src/components/admin/FeatureFlagManager.tsx | PostgREST + Edge | flags + admin-search-users / admin-team-members | PostgREST + Node | Not started | |
| Tier limits | src/components/admin/TierLimitsManager.tsx | PostgREST | app_config, feature_flags | PostgREST | Not started | |
| TTS URL config | src/components/admin/TtsUrlManager.tsx | PostgREST | app_config | PostgREST | Not started | |
| GitHub issue settings | src/components/admin/GithubIssueSettings.tsx | PostgREST | app_config | PostgREST | Not started | |

### Teams & members

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Teams CRUD | src/hooks/useTeams.ts | PostgREST | teams | PostgREST | Covered | getDb() |
| Team settings page | src/pages/TeamSettings.tsx | PostgREST | teams | PostgREST | Not started | |
| Team members | src/hooks/useTeamMembers.ts | PostgREST | team_members, profiles, invitations | PostgREST | Covered | getDb() |
| Team data context | src/contexts/TeamDataContext.tsx | PostgREST | members, boards, action items, comments | PostgREST | Covered | getDb() |
| Invite links | src/hooks/useInviteLinks.ts | PostgREST | team_invitations | PostgREST | Covered | getDb() |
| Accept team invite | src/hooks/useInvitationAccept.ts | RPC | accept_team_invitation | Postgres RPC / Node | Covered | rpc via /rest/v1/rpc |
| Send team invite email/notify | useTeamMembers / TeamMembersList | Edge | send-invitation-email, notify-team-invite | Node P0 | Not started | |
| Favorite teams | src/pages/Teams.tsx | PostgREST | user_favorite_teams | PostgREST | Not started | |
| Subscription limits | src/hooks/useSubscriptionLimits.ts | PostgREST + Edge | app_config, members, boards, check-subscription | Mixed | Not started | |
| Admin manage members | src/components/admin/AdminManageTeamMembers.tsx | Edge | admin-team-members | Node P0 | Not started | |

### Organizations

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Orgs CRUD / members | src/hooks/useOrganizations.ts | PostgREST + Edge | organizations*, invitations, notify/email | PostgREST + Node | Covered | CRUD via getDb(); edge still hosted |
| Org selector | src/contexts/OrgSelectorContext.tsx | PostgREST | organization_members | PostgREST | Covered | getDb() |
| Org admin codes | src/pages/OrgAdmin.tsx | PostgREST | teams, org_team_invite_codes | PostgREST | Covered | getDb() |
| Join org | src/pages/JoinOrg.tsx | RPC + PostgREST | get_org_team_invite, teams | RPC + PostgREST | Covered | getDb().rpc + from |
| Accept org invite | src/pages/OrgInviteAccept.tsx | RPC | accept_org_invitation | RPC | Covered | getDb().rpc |
| Org dashboard | src/pages/OrgDashboard.tsx | PostgREST | teams | PostgREST | Covered | getDb() |

### Retro boards

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Retro board core | src/hooks/useRetroBoard.ts | PostgREST + Realtime + Edge | retro_*, team_action_items, notify-retro-start | PostgREST + WS + Node | Covered | CRUD via getDb(); realtime/edge still hosted |
| Team boards | src/hooks/useTeamBoards.ts | PostgREST | retro_boards, config, templates, team_default_settings | PostgREST | Covered | getDb() |
| Room access | src/hooks/useRoomAccess.ts | PostgREST | retro_boards, config | PostgREST | Covered | getDb() |
| User readiness | src/hooks/useUserReadiness.ts | PostgREST | retro_user_readiness | PostgREST | Covered | getDb() |
| Retro page/room | src/pages/Retro.tsx, RetroRoom.tsx | PostgREST | retro_boards | PostgREST | Not started | |
| Board templates | src/hooks/useBoardTemplates.ts | PostgREST | board_templates, template_columns | PostgREST | Covered | getDb() |
| Action items UI | TeamSidebar / TeamActionItems* | PostgREST + Realtime | team_action_items | PostgREST + WS | Not started | |
| Backfill action items | src/components/admin/BackfillActionItems.tsx | PostgREST | boards/columns/items/action_items | PostgREST | Not started | Admin |
| Sentiment | src/components/retro/SentimentDisplay.tsx | Edge | analyze-board-sentiment | Node P3 | Not started | Optional |
| Retro timer audio | src/components/retro/RetroTimer.tsx | Storage | retro-audio | Docker volume | Not started | upload + public URL |
| Mentions received | src/components/account/MentionsReceived.tsx | PostgREST | members, boards, items, columns, teams | PostgREST | Not started | |

### Poker

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Poker session | src/hooks/usePokerSession.ts | PostgREST + Realtime + Edge | sessions, rounds, members, delete-session-data, admin-send-notification | PostgREST + WS + Node | Covered | CRUD via getDb(); realtime/edge still hosted |
| Poker history / rounds | src/hooks/usePokerSessionHistory.ts | PostgREST + Realtime | poker_session_rounds, sessions | PostgREST + WS | Covered | getDb(); realtime still hosted |
| Poker table context | src/components/Neotro/PokerTableComponent/context.tsx | PostgREST + Edge | rounds, admin-send-notification | PostgREST + Node | Not started | Many round updates |
| Poker chat | src/hooks/usePokerSessionChat.ts | PostgREST + Storage + Realtime | chat, reactions, poker-session-chat-images | PostgREST + volume + WS | Covered | CRUD via getDb(); storage/realtime still hosted |
| Poker helpers | src/lib/supabase/poker.ts, pokerSessionCloneSettings.ts | PostgREST | chat, sessions | PostgREST | Covered | getDb() |
| Team poker list | src/components/team/TeamPokerSessions.tsx | PostgREST + Realtime | poker_sessions / rounds | PostgREST + WS | Not started | |
| Poker config | src/components/Neotro/PokerConfig.tsx | PostgREST | team_members, profiles | PostgREST | Not started | |
| Local advisor payload | src/hooks/_pokerLocalAdvisorPayload.ts | PostgREST + Edge | chat, teams, get-jira-issue | Mixed | Not started | |
| Story points broadcast | src/lib/pokerJiraStoryPointsBroadcast.ts | Realtime | channel poker_session:* | WS | Not started | |

### Jira / Slack / billing / misc edge

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Jira drawer / queue / points | JiraIssueDrawer, TicketQueue*, SubmitPoints*, EmbeddedTicketQueue, PokerAdvisorPanel, DesktopView | Edge | many get/update/create-jira-* | Node `/api/jira/*` P2 | Not started | Largest edge cluster |
| Jira settings row | src/components/Neotro/PointDetails.tsx | PostgREST | jira_integration_settings | PostgREST | Not started | |
| Team Jira/Slack flags | useJiraIntegration / useSlackIntegration | PostgREST | teams | PostgREST | Not started | |
| Slack notify retro/poker | useSlackNotification / usePokerSlackNotification | Edge | send-slack-notification, send-poker-round-to-slack | Node P2 | Not started | |
| Subscriptions | src/hooks/useSubscription.ts | Edge | check-subscription, create-checkout, customer-portal | Decision pending | Not started | P3 |
| Admin subscriptions | src/components/admin/AdminSubscriptionManager.tsx | Edge | admin-manage-subscription | Node / defer | Not started | |
| Feedback → GitHub | src/components/FeedbackButton.tsx | PostgREST + Edge | feedback_reports, create-feedback-github-issue | PostgREST + Node | Not started | |
| Admin search users | ImpersonateUser / FeatureFlagManager | Edge | admin-search-users | Node P0 | Not started | |
| Admin send notification | AdminSendNotification / poker paths | Edge | admin-send-notification | Node P0 | Not started | |
| Admin email RPC | Account / AppHeader | RPC | get_user_email_if_admin | RPC | Covered | getDb().rpc |

### Endorsements & activity

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Endorsements | src/hooks/useEndorsements.ts | PostgREST + Realtime | endorsements | PostgREST + WS | Not started | |
| Endorsement types | src/hooks/useEndorsementTypes.ts | PostgREST + RPC | types, settings, seed_default_* | PostgREST + RPC | Covered | getDb() + rpc |
| Endorsements received UI | src/components/account/EndorsementsReceived.tsx | PostgREST | endorsements + joins | PostgREST | Not started | |
| Recent activity | src/hooks/useRecentActivity.ts, src/lib/recentActivity.ts | PostgREST | user_recent_activity (+ joins) | PostgREST | Not started | |

### Notifications

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Notifications list/mark | src/hooks/useNotifications.ts | PostgREST + Realtime | notifications | PostgREST + WS | Covered | CRUD via getDb(); realtime still hosted |

### Storage (Docker volumes — locked)

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Avatars | Account.tsx, AccountDetails.tsx | Storage | avatars | Docker volume via Node | Not started | upload + public URL |
| Poker chat images | src/hooks/usePokerSessionChat.ts | Storage | poker-session-chat-images | Docker volume via Node | Not started | |
| Retro timer audio | src/components/retro/RetroTimer.tsx | Storage | retro-audio | Docker volume via Node | Not started | |
| TTS cache | edge functions (not FE-direct) | Storage | tts-audio-cache | Docker volume if/when ported | Not started | Edge-only today |

### Realtime channels (15 sites)

| Area | Files | Channel pattern |
|------|-------|-----------------|
| Retro board | useRetroBoard.ts | `retro-board-{id}` (+ presence/broadcast) |
| Poker session | usePokerSession.ts, use-jira-ticket-metadata.ts, pokerJiraStoryPointsBroadcast.ts | `poker_session:{id}` |
| Poker rounds history | usePokerSessionHistory.ts | `poker_session_rounds-changes-for-{id}` |
| Poker chat / reactions | usePokerSessionChat.ts | `poker_chat:{id}`, `poker_chat_reactions:{id}` |
| Team poker lists | TeamPokerSessions.tsx | `team-poker-sessions-*`, `team-poker-rounds-*` |
| Action items | TeamSidebar, TeamActionItems, TeamActionItemsComments | `team-action-items-*`, `tai-comments-*` |
| Notifications | useNotifications.ts | `realtime:notifications` |
| Feature flags | FeatureFlagContext.tsx | `feature-flags-realtime` |
| Endorsements | useEndorsements.ts | `endorsements-{boardId}` |

### Platform / dual-path (new work)

| Feature | File (path) | Call Type | Resource | Self-host target | Status | Notes |
|---|---|---|---|---|---|---|
| Backend toggle | (new) Admin Backend page | Config | app_config.backend_provider | Node + FE facade | Not started | Admin-only |
| Data client facade | (new) src/lib/backend/* | Facade | all of the above | getDataClient() | Covered | Phase 3: getDb() + selfhosted restClient |
| PostgREST data path | selfhosted restClient | PostgREST | local tables + RLS | Coolify-internal PostgREST | Covered | Node `/rest/v1` proxy; PostgREST internal |
| Object storage volumes | Coolify compose | Ops | named Docker volumes | retroscope_uploads (+ buckets) | Not started | Locked storage choice |
| Coolify deploy | docker-compose.selfhost.yml | Ops | web/api/postgres/postgrest | Coolify resource | Covered | Phase 1–3 compose + db-init RLS helpers |

---

## Re-inventory command

```bash
# Tables
rg -oN "\.from\(['\"][^'\"]+['\"]" src --glob '*.{ts,tsx}' \
  | sed -E "s/.*\.from\(['\"]([^'\"]+)['\"].*/\1/" | sort | uniq -c | sort -rn

# Edge functions
rg -oN "functions\.invoke\(['\"][^'\"]+['\"]" src --glob '*.{ts,tsx}' \
  | sed -E "s/.*invoke\(['\"]([^'\"]+)['\"].*/\1/" | sort | uniq -c | sort -rn

# RPCs / channels
rg -oN "\.rpc\(['\"][^'\"]+['\"]" src --glob '*.{ts,tsx}'
rg -n "\.channel\(" src --glob '*.{ts,tsx}'
```

## C# API Coverage Tracker (Front End → C# → Supabase)

This tracker lists every direct Supabase usage in the front end and the plan/mapping to a C# API endpoint. Update this file on every PR that adds coverage or changes Supabase usage.

Legend for Status:
- Not started
- In progress
- Covered (API implemented; front end behind flag)
- Switched (front end now uses API path)
- Deprecated (direct Supabase call removed)

### How to Update

1) When you find a direct Supabase call in `src/**/*.ts{,x}`, add a row.
2) When you add a new C# endpoint, update the `New API Endpoint` and `Status`.
3) When a front-end hook/component is migrated behind the flag, set `Status=Covered` and link the PR in Notes.
4) When the flag is permanently on and direct usage is removed, set `Status=Deprecated`.

### Tracker Table

| Feature | File (path) | Call Type | Supabase Resource | New API Endpoint | Status | Notes |
|---|---|---|---|---|---|---|
| Notifications | src/hooks/useNotifications.ts | PostgREST select | notifications | GET /api/notifications | Covered | ✅ Implemented in Tasks 1-20; API ready, FE behind flag |
| Team Members | src/components/team/TeamMembersList.tsx | PostgREST select | team_members, profiles | GET /api/teams/{teamId}/members | Covered | ✅ Implemented in Tasks 1-20; API ready, FE behind flag |
| Admin Send Notification | src/components/admin/AdminSendNotification.tsx | Edge Function | functions: admin-send-notification | POST /api/admin/notifications | Covered | ✅ Implemented in Tasks 1-20; API ready, FE behind flag |
| Notifications: mark read | src/hooks/useNotifications.ts | PostgREST update | notifications | PATCH /api/notifications/{id} | Covered | ✅ Implemented in Task 22; API ready, FE behind flag |
| Notifications: mark all read | src/hooks/useNotifications.ts | RPC/Function | notifications | POST /api/notifications/mark-all-read | Covered | ✅ Implemented in Task 22; API ready, FE behind flag |
| Teams CRUD | src/hooks/useTeams.ts | PostgREST CRUD | teams | /api/teams (GET/POST/PATCH/DELETE) | Not started | Phase 3 |
| Team Member Add/Remove/Role | src/hooks/useTeamMembers.ts | PostgREST | team_members | /api/teams/{teamId}/members (+ PATCH/DELETE) | Not started | Phase 3 |
| Retro Boards CRUD | src/hooks/useRetroBoard.ts | PostgREST CRUD | retro_boards, retro_columns, retro_items | /api/retro/... | Not started | Phase 4 |
| Retro Sentiment | supabase/functions/analyze-board-sentiment | Edge Function | functions: analyze-board-sentiment | POST /api/retro/sentiment | Not started | Phase 4 |
| Poker Sessions CRUD | src/hooks/usePokerSession.ts | PostgREST/RPC | poker_sessions | /api/poker/sessions | Not started | Phase 5 |
| Poker Votes/Reveal | src/hooks/usePokerSession.ts | RPC/Function | votes, reveal | /api/poker/sessions/{id}/votes + /reveal | Not started | Phase 5 |
| Poker Chat | src/hooks/usePokerSessionChat.ts | PostgREST | poker_chat | /api/poker/sessions/{id}/chat | Not started | Phase 5 |
| Poker History | src/hooks/usePokerSessionHistory.ts | PostgREST | poker_history | /api/poker/history | Not started | Phase 5 |
| Invitations | src/hooks/useInvitationAccept.ts | PostgREST/Function | invitations | /api/invitations/... | Not started | Phase 6 |
| Slack Create Retro | supabase/functions/slack-create-retro | Edge Function | functions: slack-create-retro | POST /api/slack/create-retro | Not started | Phase 7 |
| Slack Poke | supabase/functions/slack-poke | Edge Function | functions: slack-poke | POST /api/slack/poke | Not started | Phase 7 |
| Storage: Avatars | src/components/account/AvatarUploader.tsx | Storage | storage: avatars | /api/storage/avatars (upload/signed-url) | Not started | Phase 8 |
| Storage: Backgrounds | src/components/account/BackgroundSettings.tsx | Storage | storage: backgrounds | /api/storage/backgrounds | Not started | Phase 8 |
| Realtime Presence/Channels | various | Realtime | channel/presence | TBD (Phase 9 plan) | Not started | Keep direct Supabase short-term |



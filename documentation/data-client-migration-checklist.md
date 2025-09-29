## Data Client Migration Checklist

This document tracks all places where the frontend calls Supabase directly or the C# API, and the migration status to the centralized `src/lib/dataClient.ts`.

Legend: [ ] pending, [x] done, [-] not applicable

### Feature Flags
- [x] Fetch flags: `src/components/admin/FeatureFlagManager.tsx` → `fetchFeatureFlags()`
- [x] Update flag: `src/components/admin/FeatureFlagManager.tsx` → `updateFeatureFlag()`
- [x] Fetch flags (context): `src/contexts/FeatureFlagContext.tsx` → `fetchFeatureFlags()`

### Notifications
- [x] Fetch notifications: `src/hooks/useNotifications.ts`
- [x] Mark read: `src/hooks/useNotifications.ts`
- [x] Mark all read: `src/hooks/useNotifications.ts`

### Admin: Send Notification
- [x] AdminSendNotification: `src/components/admin/AdminSendNotification.tsx`
- [ ] Tests import path updates: `src/components/admin/__tests__/AdminSendNotification.test.tsx`

### Teams
- [x] useTeams: `src/hooks/useTeams.ts`
- [x] useTeamMembers: `src/hooks/useTeamMembers.ts`
- [x] TeamMembersList: `src/components/team/TeamMembersList.tsx`
- [x] AdminManageTeamMembers: `src/components/admin/AdminManageTeamMembers.tsx`

### Retro Board
- [x] Replace direct Supabase joins/queries: `src/hooks/useRetroBoard.ts` (load, votes, comments)
- [x] useRoomAccess initial fetch: `src/hooks/useRoomAccess.ts`

### Account/Profile
- [x] Account page: `src/pages/Account.tsx` (avatar upload, admin email lookup)
- [x] AccountDetails: `src/components/account/AccountDetails.tsx` (avatar upload)

### Poker Session
- [x] usePokerSession: inserts/updates/functions routed via dataClient (realtime remains direct)
- [x] usePokerSessionHistory: fetching routed via dataClient (realtime remains direct)
- [x] usePokerSessionChat: actions routed via dataClient (realtime remains direct)

### Auth
- [-] useAuth.tsx: keep Supabase auth direct usage (auth library)
- [ ] pages/ResetPassword.tsx: setSession/updateUser

### Action Items / Team UI
- [x] TeamSidebar: non-realtime actions via dataClient (realtime remains direct)
- [x] TeamActionItems: non-realtime actions via dataClient
- [x] TeamActionItemsComments: non-realtime actions via dataClient

### Misc
- [x] App config: `app_config` reads/writes centralized
- [x] Feedback reports: `feedback_reports` create/update centralized
- [ ] ActiveUsers/others if using supabase directly
- [ ] Any remaining usages: grep for `supabase.` and `shouldUseCSharpApi(`

Notes:
- Realtime will remain direct Supabase until equivalent is exposed via the API. The data client should no-op or document direct usage when necessary.
- For auth/session, continue using Supabase client directly.



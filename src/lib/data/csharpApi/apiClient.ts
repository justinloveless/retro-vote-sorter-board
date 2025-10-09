// Centralized API client that re-exports all functions from individual domain modules
// This file maintains backward compatibility while providing a clean, organized structure

// Export all types from individual modules
export type * from './profiles';
export type * from './retroBoards';
export type * from './retroBoardConfig';
export type * from './retroColumns';
export type * from './retroItems';
export type * from './retroComments';
export type * from './teamInvitations';

// Feature Flags
export { apiGetFeatureFlags, apiUpdateFeatureFlag } from './featureFlags';

// Notifications
export {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiAdminSendNotification
} from './notifications';

// Profiles
export {
  apiGetProfile,
  apiGetProfilesByIds,
  apiUpdateProfile,
  apiUpsertProfile
} from './profiles';

// Teams
export {
  apiGetTeams,
  apiCreateTeam,
  apiUpdateTeam,
  apiDeleteTeam,
  apiGetTeamMembers,
  apiAddMember,
  apiUpdateMemberRole,
  apiRemoveMember,
  apiGetTeamName
} from './teams';

// Team Invitations
export {
  apiGetTeamInvitations,
  apiCreateTeamInvitation,
  apiUpdateTeamInvitation,
  apiDeleteTeamInvitation
} from './teamInvitations';

// Retro Boards
export {
  apiGetRetroBoards,
  apiGetRetroBoardSummary,
  apiGetRetroBoardTitlesByIds,
  apiCreateRetroBoard,
  apiUpdateRetroBoard,
  apiDeleteRetroBoard
} from './retroBoards';

// Retro Board Config
export {
  apiGetRetroBoardConfig,
  apiCreateRetroBoardConfig,
  apiUpdateRetroBoardConfig
} from './retroBoardConfig';

// Retro Columns
export {
  apiGetRetroColumns,
  apiCreateRetroColumn,
  apiUpdateRetroColumn,
  apiDeleteRetroColumn,
  apiUpdateRetroColumnsBatch
} from './retroColumns';

// Retro Items
export {
  apiGetRetroItems,
  apiCreateRetroItem,
  apiUpdateRetroItem,
  apiDeleteRetroItem
} from './retroItems';

// Retro Comments
export {
  apiGetCommentsByItemIds,
  apiGetCommentsByItemId,
  apiCreateComment,
  apiDeleteComment
} from './retroComments';

// Supabase Proxy Client
export {
  SupabaseProxyClient,
  createSupabaseProxyClient
} from './supabaseProxyClient';

export {
  getAuthenticatedProxyClient,
  createAuthenticatedProxyClient
} from './supabaseProxyInstance';
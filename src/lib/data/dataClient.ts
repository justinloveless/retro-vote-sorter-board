// Centralized data client that abstracts choosing between Supabase vs C# API.
// This file re-exports all functions from individual domain modules to maintain
// backward compatibility while providing a clean, organized structure.

import { shouldUseCSharpApi } from '../../config/environment.ts';
import { supabase } from '../../integrations/supabase/client.ts';
import { getAuthenticatedProxyClient } from './csharpApi/supabaseProxyInstance.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

// Export all types from the types module
export * from './types';

// Feature Flags
export { fetchFeatureFlags, updateFeatureFlag } from './featureFlags';

// Notifications
export {
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    adminSendNotification
} from './notifications';

// Profiles
export {
    fetchProfile,
    fetchProfilesByIds,
    updateProfile,
    upsertProfile
} from './profiles';

// Teams
export {
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    fetchTeamMembers,
    removeTeamMember,
    updateTeamMemberRole,
    invalidateTeamsCache,
    isTeamsCacheValid,
    getTeamName
} from './teams';

// Team Invitations
export {
    fetchTeamInvitations,
    createTeamInvitation,
    updateTeamInvitation,
    deleteTeamInvitation,
    cancelTeamInvitation,
    inviteMemberByEmail
} from './teamInvitations';

// Retro Boards
export {
    fetchRetroBoardSummary,
    createRetroBoardWithDefaults,
    updateRetroBoardPrivacyByRoom,
    fetchRetroBoards,
    fetchRetroBoardTitles,
    createRetroBoard,
    updateRetroBoard,
    deleteRetroBoard
} from './retroBoards';

// Retro Board Config
export {
    fetchRetroBoardConfig,
    createRetroBoardConfig,
    updateRetroBoardConfig
} from './retroBoardConfig';

// Retro Columns
export {
    fetchRetroColumns,
    createRetroColumn,
    updateRetroColumn,
    deleteRetroColumn,
    updateRetroColumnsBatch
} from './retroColumns';

// Retro Items
export {
    fetchRetroItems,
    createRetroItem,
    updateRetroItem,
    deleteRetroItem,
    getUserVotes,
    addVote,
    removeVote
} from './retroItems';

// Retro Comments
export {
    fetchCommentsForItems,
    fetchCommentsForItem,
    addRetroComment,
    deleteRetroComment
} from './retroComments';

// Auth
export {
    getAuthSession,
    getAuthUser,
    onAuthStateChange,
    signInWithOAuth,
    resetPasswordForEmail,
    signUpWithEmail,
    signInWithPassword,
    setAuthSession,
    updateAuthUser,
    signOut
} from './auth';

// Poker
export {
    getPokerSessionByRoom,
    createPokerSession,
    getPokerRound,
    createPokerRound,
    updatePokerRoundById,
    updatePokerSessionById,
    deletePokerSessionData,
    fetchPokerRounds,
    fetchPokerChatMessages,
    sendPokerChatMessage,
    addPokerChatReaction,
    removePokerChatReaction,
    uploadPokerChatImage,
    fetchChatMessagesForRound
} from './poker';

// Storage
export {
    getImpersonatedEmailIfAdmin,
    adminSetAvatar,
    uploadAvatarForUser,
    getRetroAudioPublicUrl,
    uploadRetroAudio,
    deleteRetroAudio
} from './storage';

// Admin
export {
    adminListTeams,
    adminListTeamMembers,
    adminAddMember,
    adminRemoveMember
} from './admin';

// Other utilities
export {
    fetchOpenTeamActionItems,
    markTeamActionItemDoneById,
    getAppConfigValue,
    upsertAppConfig,
    insertFeedbackReport,
    updateFeedbackReport,
    assignTeamActionItemById
} from './other';

async function getClient() {
    if (shouldUseCSharpApi()) {
        return await getAuthenticatedProxyClient() as unknown as SupabaseClient;
    }
    return supabase;
}

const client = (await getClient()) as SupabaseClient;

export { client, getClient };
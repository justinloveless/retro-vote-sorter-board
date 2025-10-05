// Shared types used across data client modules
export type FeatureFlagRecord = {
    flag_name: string;
    description: string | null;
    is_enabled: boolean;
};

export type AppNotification = {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string | null;
    url: string | null;
    is_read: boolean;
    created_at: string;
};

export type ProfileRecord = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin' | null;
    theme_preference: string | null;
    background_preference: any | null;
};

export type TeamRecord = {
    id: string;
    name: string;
    description: string | null;
    creator_id: string | null;
    created_at: string;
    updated_at: string;
    role: 'owner' | 'admin' | 'member' | null;
};

export type TeamMemberRecord = {
    id: string;
    team_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
    profiles?: { full_name: string | null } | null;
};

export type TeamInvitationRecord = {
    id: string;
    team_id: string;
    email: string;
    invited_by: string;
    token: string;
    status: 'pending' | 'accepted' | 'declined';
    invite_type: 'email' | 'link';
    is_active: boolean;
    expires_at: string;
    created_at: string;
};

export type RetroBoardRecord = {
    id: string;
    room_id: string;
    title: string;
    is_private: boolean;
    password_hash?: string | null;
    archived: boolean;
    archived_at?: string | null;
    archived_by?: string | null;
    deleted: boolean;
    team_id?: string | null;
    retro_stage?: string | null;
    creator_id?: string | null;
    created_at: string;
    updated_at: string;
};

export type RetroBoardConfigRecord = {
    id: string;
    board_id: string;
    allow_anonymous?: boolean;
    voting_enabled?: boolean;
    max_votes_per_user?: number;
    show_author_names?: boolean;
    retro_stages_enabled?: boolean;
    enforce_stage_readiness?: boolean;
    allow_self_votes?: boolean;
    vote_emoji?: string;
    created_at: string;
    updated_at: string;
};

export type RetroColumnRecord = {
    id: string;
    board_id?: string;
    title: string;
    color: string;
    position: number;
    sort_order?: number;
    is_action_items?: boolean;
    created_at?: string;
};

export type RetroItemRecord = {
    id: string;
    board_id?: string;
    column_id?: string;
    text: string;
    author: string;
    author_id?: string;
    votes?: number;
    session_id?: string;
    created_at?: string;
    updated_at?: string;
    profiles?: { avatar_url: string; full_name: string } | null;
};

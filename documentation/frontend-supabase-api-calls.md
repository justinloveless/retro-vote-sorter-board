# Frontend Supabase API Calls Documentation

This document catalogs all the Supabase API calls made by the frontend application, including REST API calls, Supabase Functions, and Storage operations.

## Table of Contents
- [Authentication API Calls](#authentication-api-calls)
- [Database Table Operations](#database-table-operations)
- [Supabase Functions](#supabase-functions)
- [Storage Operations](#storage-operations)
- [Bruno API Collection](#bruno-api-collection)
- [Data Models](#data-models)
- [Headers](#headers)
- [Error Handling](#error-handling)

## Authentication API Calls

### 1. Get Current User
- **Client Method**: `supabase.auth.getUser()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/auth/v1/user`
- **Headers**: `Authorization: Bearer <access_token>`
- **Description**: Gets the current authenticated user
- **Response Model**: `{ data: { user: User | null }, error: AuthError | null }`

### 2. Get Session
- **Client Method**: `supabase.auth.getSession()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/auth/v1/session`
- **Headers**: `Authorization: Bearer <access_token>`
- **Description**: Gets the current session
- **Response Model**: `{ data: { session: Session | null }, error: AuthError | null }`

### 3. Sign In with OAuth
- **Client Method**: `supabase.auth.signInWithOAuth({ provider: string, options?: AuthOptions })`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/auth/v1/authorize?provider={provider}&redirect_to={redirectTo}`
- **Query Params**: `provider: string, redirect_to?: string`
- **Description**: Sign in using OAuth provider
- **Body**: `{ provider: 'google' | 'github' | etc., options?: { redirectTo?: string } }`

### 4. Sign In with Password
- **Client Method**: `supabase.auth.signInWithPassword({ email: string, password: string })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/auth/v1/token?grant_type=password`
- **Headers**: `Content-Type: application/json`
- **Description**: Sign in with email and password
- **Body**: `{ email: string, password: string }`

### 5. Sign Up
- **Client Method**: `supabase.auth.signUp({ email: string, password: string })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/auth/v1/signup`
- **Headers**: `Content-Type: application/json`
- **Description**: Create new user account
- **Body**: `{ email: string, password: string }`

### 6. Sign Out
- **Client Method**: `supabase.auth.signOut()`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/auth/v1/logout`
- **Headers**: `Authorization: Bearer <access_token>`
- **Description**: Sign out current user

### 7. Reset Password
- **Client Method**: `supabase.auth.resetPasswordForEmail(email: string, options?: AuthOptions)`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/auth/v1/recover`
- **Headers**: `Content-Type: application/json`
- **Description**: Send password reset email
- **Body**: `{ email: string, redirect_to?: string }`

### 8. Update User
- **Client Method**: `supabase.auth.updateUser({ data: UserAttributes })`
- **HTTP Method**: PUT
- **REST URL**: `{{supabaseUrl}}/auth/v1/user`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Description**: Update user profile
- **Body**: `{ email?: string, password?: string, data?: any }`

### 9. Set Session
- **Client Method**: `supabase.auth.setSession({ access_token: string, refresh_token: string })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/auth/v1/token?grant_type=refresh_token`
- **Headers**: `Content-Type: application/json`
- **Description**: Set session with tokens
- **Body**: `{ refresh_token: string }`

### 10. Auth State Change Listener
- **Client Method**: `supabase.auth.onAuthStateChange(callback)`
- **HTTP Method**: WebSocket/SSE
- **REST URL**: `{{supabaseUrl}}/realtime/v1/websocket`
- **Description**: Listen for authentication state changes via realtime connection
- **Callback**: `(event: AuthChangeEvent, session: Session | null) => void`

## Database Table Operations

### Profiles Table

#### 11. Get Profile by ID
- **Client Method**: `supabase.from('profiles').select('*').eq('id', userId).single()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/profiles?id=eq.{{userId}}&select=id,full_name,avatar_url,role,theme_preference,background_preference`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `id: eq.{{userId}}, select: 'id,full_name,avatar_url,role,theme_preference,background_preference'`
- **Response Model**: `Profile` (see types/supabase.ts)

#### 12. Update Profile
- **Client Method**: `supabase.from('profiles').update(updates).eq('id', userId).select().single()`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/profiles?id=eq.{{userId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=representation`
- **Body**: `{ full_name?: string, avatar_url?: string, role?: string, theme_preference?: string, background_preference?: any }`

#### 13. Upsert Profile
- **Client Method**: `supabase.from('profiles').upsert(profileData)`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/profiles`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: resolution=merge-duplicates`
- **Body**: `{ id: string, full_name?: string, avatar_url?: string, role?: string, theme_preference?: string, background_preference?: any }`

### Teams Table

#### 14. Get Teams for User
- **Client Method**: `supabase.from('teams').select('*, team_members!inner(role, user_id)').eq('team_members.user_id', userId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/teams?select=*,team_members!inner(role,user_id)&team_members.user_id=eq.{{userId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `select: '*,team_members!inner(role,user_id)', team_members.user_id: 'eq.{{userId}}'`
- **Response Model**: Array of `Team` objects with `team_members` relation

#### 15. Create Team
- **Client Method**: `supabase.from('teams').insert([{ name, description, creator_id }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/teams`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ name: string, description?: string, creator_id: string }`

#### 16. Update Team
- **Client Method**: `supabase.from('teams').update(updates).eq('id', teamId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/teams?id=eq.{{teamId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ name?: string, description?: string }`

#### 17. Delete Team
- **Client Method**: `supabase.from('teams').delete().eq('id', teamId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/teams?id=eq.{{teamId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Team Members Table

#### 18. Get Team Members
- **Client Method**: `supabase.from('team_members').select('*').eq('team_id', teamId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_members?team_id=eq.{{teamId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `team_id: 'eq.{{teamId}}'`
- **Response Model**: Array of `TeamMember` objects

#### 19. Add Team Member
- **Client Method**: `supabase.from('team_members').insert([{ team_id, user_id, role }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_members`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ team_id: string, user_id: string, role?: string }`

#### 20. Update Team Member Role
- **Client Method**: `supabase.from('team_members').update({ role: newRole }).eq('id', memberId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_members?id=eq.{{memberId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ role: string }`

#### 21. Remove Team Member
- **Client Method**: `supabase.from('team_members').delete().eq('id', memberId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_members?id=eq.{{memberId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Retro Boards Table

#### 22. Get Board by Room ID
- **Client Method**: `supabase.from('retro_boards').select('*').eq('room_id', roomId).single()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_boards?room_id=eq.{{roomId}}&select=*`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `room_id: 'eq.{{roomId}}', select: '*'`
- **Response Model**: `RetroBoard`

#### 23. Create Board
- **Client Method**: `supabase.from('retro_boards').insert([{ room_id, title, team_id, creator_id }]).select()`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_boards`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=representation`
- **Body**: `{ room_id: string, title: string, team_id?: string, creator_id?: string }`

#### 24. Update Board
- **Client Method**: `supabase.from('retro_boards').update(updates).eq('id', boardId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_boards?id=eq.{{boardId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ title?: string, retro_stage?: string, archived?: boolean, archived_by?: string }`

#### 25. Archive Board
- **Client Method**: `supabase.from('retro_boards').update({ archived: true, archived_at: timestamp, archived_by: userId }).eq('id', boardId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_boards?id=eq.{{boardId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ archived: true, archived_at: timestamp, archived_by: userId }`

#### 26. Delete Board
- **Client Method**: `supabase.from('retro_boards').update({ deleted: true }).eq('id', boardId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_boards?id=eq.{{boardId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ deleted: true }`

### Retro Columns Table

#### 27. Get Columns for Board
- **Client Method**: `supabase.from('retro_columns').select('*').eq('board_id', boardId).order('position')`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_columns?board_id=eq.{{boardId}}&order=position`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `board_id: 'eq.{{boardId}}', order: 'position'`
- **Response Model**: Array of `RetroColumn` objects

#### 28. Create Column
- **Client Method**: `supabase.from('retro_columns').insert([{ board_id, title, color, position, is_action_items }]).select()`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_columns`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=representation`
- **Body**: `{ board_id: string, title: string, color: string, position: number, is_action_items?: boolean }`

#### 29. Update Column
- **Client Method**: `supabase.from('retro_columns').update(updates).eq('id', columnId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_columns?id=eq.{{columnId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ title?: string, color?: string, position?: number, is_action_items?: boolean }`

#### 30. Delete Column
- **Client Method**: `supabase.from('retro_columns').delete().eq('id', columnId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_columns?id=eq.{{columnId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Retro Items Table

#### 31. Get Items for Board
- **Client Method**: `supabase.from('retro_items').select('*, profiles(avatar_url, full_name)').eq('board_id', boardId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_items?board_id=eq.{{boardId}}&select=*,profiles(avatar_url,full_name)`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `board_id: 'eq.{{boardId}}', select: '*,profiles(avatar_url,full_name)'`
- **Response Model**: Array of `RetroItem` objects with `profiles` relation

#### 32. Create Item
- **Client Method**: `supabase.from('retro_items').insert([{ board_id, column_id, text, author, author_id, session_id }]).select()`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_items`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=representation`
- **Body**: `{ board_id: string, column_id: string, text: string, author: string, author_id?: string, session_id?: string }`

#### 33. Update Item
- **Client Method**: `supabase.from('retro_items').update(updates).eq('id', itemId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_items?id=eq.{{itemId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ text?: string, column_id?: string }`

#### 34. Delete Item
- **Client Method**: `supabase.from('retro_items').delete().eq('id', itemId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_items?id=eq.{{itemId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Retro Votes Table

#### 35. Get Votes for Board
- **Client Method**: `supabase.from('retro_votes').select('item_id').eq('board_id', boardId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_votes?board_id=eq.{{boardId}}&select=item_id`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `board_id: 'eq.{{boardId}}', select: 'item_id'`
- **Response Model**: Array of vote objects

#### 36. Create Vote
- **Client Method**: `supabase.from('retro_votes').insert([{ board_id, item_id, user_id, session_id }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_votes`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ board_id: string, item_id: string, user_id?: string, session_id?: string }`

#### 37. Delete Vote
- **Client Method**: `supabase.from('retro_votes').delete().eq('id', voteId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_votes?id=eq.{{voteId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Retro Comments Table

#### 38. Get Comments for Item
- **Client Method**: `supabase.from('retro_comments').select('*, profiles(avatar_url, full_name)').eq('item_id', itemId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_comments?item_id=eq.{{itemId}}&select=*,profiles(avatar_url,full_name)`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `item_id: 'eq.{{itemId}}', select: '*,profiles(avatar_url,full_name)'`
- **Response Model**: Array of `RetroComment` objects with `profiles` relation

#### 39. Create Comment
- **Client Method**: `supabase.from('retro_comments').insert([{ item_id, text, author, author_id, session_id }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_comments`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ item_id: string, text: string, author: string, author_id?: string, session_id?: string }`

#### 40. Delete Comment
- **Client Method**: `supabase.from('retro_comments').delete().eq('id', commentId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_comments?id=eq.{{commentId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Team Action Items Table

#### 41. Get Action Items for Team
- **Client Method**: `supabase.from('team_action_items').select('*').eq('team_id', teamId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_action_items?team_id=eq.{{teamId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `team_id: 'eq.{{teamId}}'`
- **Response Model**: Array of `TeamActionItem` objects

#### 42. Create Action Item
- **Client Method**: `supabase.from('team_action_items').insert([{ team_id, text, source_board_id, source_item_id, created_by, assigned_to }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_action_items`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ team_id: string, text: string, source_board_id?: string, source_item_id?: string, created_by?: string, assigned_to?: string }`

#### 43. Update Action Item
- **Client Method**: `supabase.from('team_action_items').update(updates).eq('id', itemId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_action_items?id=eq.{{itemId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ done?: boolean, done_at?: string, done_by?: string, assigned_to?: string }`

### Poker Sessions Table

#### 44. Get Poker Session
- **Client Method**: `supabase.from('poker_sessions').select('*').eq('room_id', roomId).single()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_sessions?room_id=eq.{{roomId}}&select=*`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `room_id: 'eq.{{roomId}}', select: '*'`
- **Response Model**: `PokerSession`

#### 45. Create Poker Session
- **Client Method**: `supabase.from('poker_sessions').insert({ room_id, current_round_number: 1 }).select()`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_sessions`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=representation`
- **Body**: `{ room_id: string, current_round_number?: number }`

#### 46. Update Poker Session
- **Client Method**: `supabase.from('poker_sessions').update(updates).eq('id', sessionId).select()`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_sessions?id=eq.{{sessionId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=representation`
- **Body**: `{ current_round_number?: number, selections?: any, presence_enabled?: boolean, send_to_slack?: boolean }`

### Poker Session Rounds Table

#### 47. Create Round
- **Client Method**: `supabase.from('poker_session_rounds').insert({ session_id, round_number, selections, game_state })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_session_rounds`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ session_id: string, round_number: number, selections: any, game_state?: string }`

#### 48. Update Round
- **Client Method**: `supabase.from('poker_session_rounds').update(updates).eq('id', roundId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_session_rounds?id=eq.{{roundId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ selections?: any, game_state?: string, average_points?: number, completed_at?: string }`

### Poker Session Chat Table

#### 49. Get Chat Messages
- **Client Method**: `supabase.from('poker_session_chat').select('*').eq('session_id', sessionId).order('created_at')`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_session_chat?session_id=eq.{{sessionId}}&order=created_at`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `session_id: 'eq.{{sessionId}}', order: 'created_at'`
- **Response Model**: Array of `PokerSessionChat` objects

#### 50. Create Chat Message
- **Client Method**: `supabase.from('poker_session_chat').insert({ session_id, message, user_name, user_id, round_number, reply_to_message_id })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_session_chat`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ session_id: string, message: string, user_name: string, user_id?: string, round_number: number, reply_to_message_id?: string }`

### Poker Session Chat Message Reactions Table

#### 51. Create Reaction
- **Client Method**: `supabase.from('poker_session_chat_message_reactions').insert({ message_id, session_id, emoji, user_id, user_name })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_session_chat_message_reactions`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ message_id: string, session_id: string, emoji: string, user_id: string, user_name: string }`

#### 52. Delete Reaction
- **Client Method**: `supabase.from('poker_session_chat_message_reactions').delete().eq('id', reactionId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/poker_session_chat_message_reactions?id=eq.{{reactionId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Board Templates Table

#### 53. Get Templates
- **Client Method**: `supabase.from('board_templates').select('*').eq('team_id', teamId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/board_templates?team_id=eq.{{teamId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `team_id: 'eq.{{teamId}}'`
- **Response Model**: Array of `BoardTemplate` objects

#### 54. Create Template
- **Client Method**: `supabase.from('board_templates').insert([{ name, team_id, is_default, voting_enabled, allow_anonymous, show_author_names, max_votes_per_user, retro_stages_enabled, enforce_stage_readiness, allow_self_votes, vote_emoji }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/board_templates`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ name: string, team_id?: string, is_default?: boolean, voting_enabled?: boolean, allow_anonymous?: boolean, show_author_names?: boolean, max_votes_per_user?: number, retro_stages_enabled?: boolean, enforce_stage_readiness?: boolean, allow_self_votes?: boolean, vote_emoji?: string }`

#### 55. Update Template
- **Client Method**: `supabase.from('board_templates').update(updates).eq('id', templateId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/board_templates?id=eq.{{templateId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ name?: string, is_default?: boolean, voting_enabled?: boolean, allow_anonymous?: boolean, show_author_names?: boolean, max_votes_per_user?: number, retro_stages_enabled?: boolean, enforce_stage_readiness?: boolean, allow_self_votes?: boolean, vote_emoji?: string }`

#### 56. Delete Template
- **Client Method**: `supabase.from('board_templates').delete().eq('id', templateId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/board_templates?id=eq.{{templateId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Template Columns Table

#### 57. Get Template Columns
- **Client Method**: `supabase.from('template_columns').select('*').eq('template_id', templateId).order('position')`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/template_columns?template_id=eq.{{templateId}}&order=position`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `template_id: 'eq.{{templateId}}', order: 'position'`
- **Response Model**: Array of `TemplateColumn` objects

#### 58. Create Template Column
- **Client Method**: `supabase.from('template_columns').insert([{ template_id, title, color, position, is_action_items }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/template_columns`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ template_id: string, title: string, color: string, position: number, is_action_items?: boolean }`

#### 59. Update Template Column
- **Client Method**: `supabase.from('template_columns').update(updates).eq('id', columnId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/template_columns?id=eq.{{columnId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ title?: string, color?: string, position?: number, is_action_items?: boolean }`

#### 60. Delete Template Column
- **Client Method**: `supabase.from('template_columns').delete().eq('id', columnId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/template_columns?id=eq.{{columnId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### Retro Board Config Table

#### 61. Get Board Config
- **Client Method**: `supabase.from('retro_board_config').select('*').eq('board_id', boardId).single()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_board_config?board_id=eq.{{boardId}}&select=*`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `board_id: 'eq.{{boardId}}', select: '*'`
- **Response Model**: `RetroBoardConfig`

#### 62. Create Board Config
- **Client Method**: `supabase.from('retro_board_config').insert([{ board_id, voting_enabled, allow_anonymous, show_author_names, max_votes_per_user, retro_stages_enabled, enforce_stage_readiness, allow_self_votes, vote_emoji }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_board_config`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ board_id: string, voting_enabled?: boolean, allow_anonymous?: boolean, show_author_names?: boolean, max_votes_per_user?: number, retro_stages_enabled?: boolean, enforce_stage_readiness?: boolean, allow_self_votes?: boolean, vote_emoji?: string }`

#### 63. Update Board Config
- **Client Method**: `supabase.from('retro_board_config').update(updates).eq('board_id', boardId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_board_config?board_id=eq.{{boardId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ voting_enabled?: boolean, allow_anonymous?: boolean, show_author_names?: boolean, max_votes_per_user?: number, retro_stages_enabled?: boolean, enforce_stage_readiness?: boolean, allow_self_votes?: boolean, vote_emoji?: string }`

### Retro User Readiness Table

#### 64. Get User Readiness
- **Client Method**: `supabase.from('retro_user_readiness').select('*').eq('board_id', boardId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_user_readiness?board_id=eq.{{boardId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `board_id: 'eq.{{boardId}}'`
- **Response Model**: Array of `RetroUserReadiness` objects

#### 65. Upsert User Readiness
- **Client Method**: `supabase.from('retro_user_readiness').upsert(upsertData, { onConflict: 'board_id,user_id' })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/retro_user_readiness`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: resolution=merge-duplicates`
- **Body**: `{ board_id: string, user_id?: string, current_stage: string, is_ready?: boolean, session_id?: string }`

### Team Invitations Table

#### 66. Get Invitations
- **Client Method**: `supabase.from('team_invitations').select('*').eq('team_id', teamId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_invitations?team_id=eq.{{teamId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `team_id: 'eq.{{teamId}}'`
- **Response Model**: Array of `TeamInvitation` objects

#### 67. Create Invitation
- **Client Method**: `supabase.from('team_invitations').insert([{ team_id, email, invited_by, token, expires_at, invite_type, status }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_invitations`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ team_id: string, email: string, invited_by: string, token: string, expires_at: string, invite_type?: string, status?: string }`

#### 68. Update Invitation
- **Client Method**: `supabase.from('team_invitations').update(updates).eq('id', invitationId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_invitations?id=eq.{{invitationId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ status?: string, is_active?: boolean }`

#### 69. Delete Invitation
- **Client Method**: `supabase.from('team_invitations').delete().eq('id', invitationId)`
- **HTTP Method**: DELETE
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_invitations?id=eq.{{invitationId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Prefer: return=minimal`

### App Config Table

#### 70. Get Config Value
- **Client Method**: `supabase.from('app_config').select('value').eq('key', key).single()`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/app_config?key=eq.{{key}}&select=value`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `key: 'eq.{{key}}', select: 'value'`
- **Response Model**: `{ value: string | null }`

#### 71. Upsert Config
- **Client Method**: `supabase.from('app_config').upsert(upserts, { onConflict: 'key' })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/app_config`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: resolution=merge-duplicates`
- **Body**: `[{ key: string, value: string }]`

### Feature Flags Table

#### 72. Get Feature Flags
- **Client Method**: `supabase.from('feature_flags').select('flag_name, is_enabled')`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/feature_flags?select=flag_name,is_enabled`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `select: 'flag_name,is_enabled'`
- **Response Model**: Array of `{ flag_name: string, is_enabled: boolean }`

#### 73. Update Feature Flag
- **Client Method**: `supabase.from('feature_flags').update({ is_enabled }).eq('flag_name', flagName)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/feature_flags?flag_name=eq.{{flagName}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ is_enabled: boolean }`

### Feedback Reports Table

#### 74. Create Feedback Report
- **Client Method**: `supabase.from('feedback_reports').insert([{ title, description, type, user_id, email, page_url, status }])`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/feedback_reports`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ title: string, description: string, type: string, user_id?: string, email?: string, page_url?: string, status?: string }`

#### 75. Update Feedback Report
- **Client Method**: `supabase.from('feedback_reports').update({ github_issue_url }).eq('id', reportId)`
- **HTTP Method**: PATCH
- **REST URL**: `{{supabaseUrl}}/rest/v1/feedback_reports?id=eq.{{reportId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: return=minimal`
- **Body**: `{ github_issue_url: string }`

### Board Presence Table

#### 76. Get Board Presence
- **Client Method**: `supabase.from('board_presence').select('*').eq('board_id', boardId)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/board_presence?board_id=eq.{{boardId}}`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>`
- **Query Params**: `board_id: 'eq.{{boardId}}'`
- **Response Model**: Array of `BoardPresence` objects

#### 77. Upsert Board Presence
- **Client Method**: `supabase.from('board_presence').upsert({ board_id, user_id, user_name, last_seen })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/rest/v1/board_presence`
- **Headers**: `Authorization: Bearer <access_token>, apikey: <anon_key>, Content-Type: application/json, Prefer: resolution=merge-duplicates`
- **Body**: `{ board_id: string, user_id?: string, user_name: string, last_seen?: string }`

## Supabase Functions

### 78. Send Invitation Email
- **Client Method**: `supabase.functions.invoke('send-invitation-email', { body: { invitationId, email } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/send-invitation-email`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ invitationId: string, email: string }`

### 79. Notify Team Invite
- **Client Method**: `supabase.functions.invoke('notify-team-invite', { body: { invitationId } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/notify-team-invite`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ invitationId: string }`

### 80. Admin Send Notification
- **Client Method**: `supabase.functions.invoke('admin-send-notification', { body: payload })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/admin-send-notification`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ recipients: Array<{ userId: string }>, type: string, title: string, body: string }`

### 81. Admin Team Members
- **Client Method**: `supabase.functions.invoke('admin-team-members', { body: { action, ...params } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/admin-team-members`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: 
  - `{ action: 'list_teams', query: string }`
  - `{ action: 'list_team_members', team_id: string }`
  - `{ action: 'add_member', team_id: string, user_id: string, role: string }`
  - `{ action: 'remove_member', member_id: string }`

### 82. Admin Search Users
- **Client Method**: `supabase.functions.invoke('admin-search-users', { body: { q: query } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/admin-search-users`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ q: string }`

### 83. Notify Retro Start
- **Client Method**: `supabase.functions.invoke('notify-retro-start', { body: { roomId, title, teamId } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/notify-retro-start`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ roomId: string, title: string, teamId?: string }`

### 84. Send Poker Round to Slack
- **Client Method**: `supabase.functions.invoke('send-poker-round-to-slack', { body: { teamId, ticketNumber, ticketTitle, averagePoints, roundNumber } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/send-poker-round-to-slack`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ teamId: string, ticketNumber: string, ticketTitle: string, averagePoints: number, roundNumber: number }`

### 85. Send Slack Notification
- **Client Method**: `supabase.functions.invoke('send-slack-notification', { body: { boardId, teamId, title, message } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/send-slack-notification`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ boardId: string, teamId: string, title: string, message: string }`

### 86. Analyze Board Sentiment
- **Client Method**: `supabase.functions.invoke('analyze-board-sentiment', { body: { boardItems } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/analyze-board-sentiment`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ boardItems: Array<{ text: string, column_id: string }> }`

### 87. Get Jira Issue
- **Client Method**: `supabase.functions.invoke('get-jira-issue', { body: { issueIdOrKey, teamId } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/get-jira-issue`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ issueIdOrKey: string, teamId: string }`

### 88. Delete Session Data
- **Client Method**: `supabase.functions.invoke('delete-session-data', { body: { session_id } })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/functions/v1/delete-session-data`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: application/json`
- **Body**: `{ session_id: string }`

## Storage Operations

### 89. Upload Avatar
- **Client Method**: `supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/png' })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/storage/v1/object/avatars/{{fileName}}`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: image/png, x-upsert: true`
- **Body**: `Blob data`
- **Query Params**: `fileName: string, upsert: true, contentType: 'image/png'`

### 90. Get Public URL
- **Client Method**: `supabase.storage.from('avatars').getPublicUrl(fileName)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/storage/v1/object/public/avatars/{{fileName}}`
- **Headers**: `Authorization: Bearer <access_token>`
- **Parameters**: `fileName: string`
- **Response Model**: `{ data: { publicUrl: string } }`

### 91. Upload Audio File
- **Client Method**: `supabase.storage.from('retro-audio').upload(fileName, file, { upsert: true, contentType: 'audio/mpeg' })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/storage/v1/object/retro-audio/{{fileName}}`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: audio/mpeg, x-upsert: true`
- **Body**: `File data`
- **Query Params**: `fileName: string, upsert: true, contentType: 'audio/mpeg'`

### 92. Get Audio Public URL
- **Client Method**: `supabase.storage.from('retro-audio').getPublicUrl(fileName)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/storage/v1/object/public/retro-audio/{{fileName}}`
- **Headers**: `Authorization: Bearer <access_token>`
- **Parameters**: `fileName: string`

### 93. Upload Chat File
- **Client Method**: `supabase.storage.from(bucketName).upload(filePath, file, { upsert: true, contentType: file.type })`
- **HTTP Method**: POST
- **REST URL**: `{{supabaseUrl}}/storage/v1/object/{{bucketName}}/{{filePath}}`
- **Headers**: `Authorization: Bearer <access_token>, Content-Type: <file.type>, x-upsert: true`
- **Body**: `File data`
- **Query Params**: `bucketName: string, filePath: string, upsert: true, contentType: <file.type>`

### 94. Get Chat File Public URL
- **Client Method**: `supabase.storage.from(bucketName).getPublicUrl(filePath)`
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/storage/v1/object/public/{{bucketName}}/{{filePath}}`
- **Headers**: `Authorization: Bearer <access_token>`
- **Parameters**: `bucketName: string, filePath: string`

## Bruno API Collection

### 95. GET /rest/v1/teams (all)
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/teams?select=*&order=created_at.desc`
- **Headers**: `apikey: <anon_key>`
- **Query Params**: `select: '*', order: 'created_at.desc'`

### 96. GET /rest/v1/teams (for user id)
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/profiles?select=user_id:id,full_name,memberships:team_members(team:teams(name))&id=eq.{{userId}}`
- **Headers**: `apikey: <anon_key>`
- **Query Params**: `select: 'user_id:id,full_name,memberships:team_members(team:teams(name))', id: 'eq.{{userId}}'`

### 97. GET /rest/v1/teams (by id)
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/teams?select=name,team_members(user_id,role,profiles(full_name))&id=eq.{{teamId}}`
- **Headers**: `apikey: <anon_key>`
- **Query Params**: `select: 'name,team_members(user_id,role,profiles(full_name))', id: 'eq.{{teamId}}'`

### 98. GET /rest/v1/team_members
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/team_members?select=user_id,team_id,role,profiles(full_name)&team_id=eq.{{teamId}}`
- **Headers**: `apikey: <anon_key>`
- **Query Params**: `select: 'user_id,team_id,role,profiles(full_name)', team_id: 'eq.{{teamId}}'`

### 99. GET /rest/v1/profiles (by ids)
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/profiles?select=id,full_name&id=in.({{profileIds}})`
- **Headers**: `apikey: <anon_key>`
- **Query Params**: `select: 'id,full_name', id: 'in.({{profileIds}})'`
- **Settings**: `encodeUrl: true`

### 100. GET /rest/v1 - health
- **HTTP Method**: GET
- **REST URL**: `{{supabaseUrl}}/rest/v1/`
- **Headers**: `apikey: <anon_key>`

## Data Models

### Profile
```typescript
interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | null;
  theme_preference: string | null;
  background_preference: any | null;
  created_at: string | null;
  updated_at: string | null;
  tenant_id: string | null;
}
```

### Team
```typescript
interface Team {
  id: string;
  name: string;
  description: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
  slack_bot_token: string | null;
  slack_channel_id: string | null;
  slack_webhook_url: string | null;
  jira_domain: string | null;
  jira_email: string | null;
  jira_api_key: string | null;
  jira_ticket_prefix: string | null;
}
```

### RetroBoard
```typescript
interface RetroBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean | null;
  password_hash: string | null;
  created_at: string | null;
  archived: boolean | null;
  archived_at: string | null;
  archived_by: string | null;
  deleted: boolean | null;
  team_id: string | null;
  tenant_id: string | null;
  retro_stage: string | null;
  creator_id: string | null;
  updated_at: string | null;
}
```

### RetroItem
```typescript
interface RetroItem {
  id: string;
  board_id: string | null;
  column_id: string | null;
  text: string;
  author: string;
  author_id: string | null;
  votes: number | null;
  created_at: string | null;
  updated_at: string | null;
  session_id: string | null;
}
```

### PokerSession
```typescript
interface PokerSession {
  id: string;
  room_id: string | null;
  team_id: string | null;
  current_round_number: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  presence_enabled: boolean | null;
  send_to_slack: boolean | null;
}
```

## Headers

All Supabase API calls include the following headers:
- `apikey`: Supabase anon key
- `Authorization`: `Bearer <access_token>` (for authenticated requests)
- `Content-Type`: `application/json` (for requests with body)
- `Prefer`: `return=minimal` (for insert/update operations)

## Error Handling

All Supabase operations return a response in the format:
```typescript
{
  data: T | null;
  error: PostgrestError | null;
}
```

Common error types:
- `AuthError`: Authentication/authorization errors
- `PostgrestError`: Database operation errors
- `StorageError`: Storage operation errors

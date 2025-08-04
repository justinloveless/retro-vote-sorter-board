export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          value: string | null
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      board_presence: {
        Row: {
          board_id: string | null
          id: string
          last_seen: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          board_id?: string | null
          id?: string
          last_seen?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          board_id?: string | null
          id?: string
          last_seen?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_presence_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_templates: {
        Row: {
          allow_anonymous: boolean | null
          created_at: string
          id: string
          is_default: boolean | null
          max_votes_per_user: number | null
          name: string
          retro_stages_enabled: boolean | null
          show_author_names: boolean | null
          team_id: string | null
          updated_at: string
          voting_enabled: boolean | null
        }
        Insert: {
          allow_anonymous?: boolean | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          max_votes_per_user?: number | null
          name: string
          retro_stages_enabled?: boolean | null
          show_author_names?: boolean | null
          team_id?: string | null
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Update: {
          allow_anonymous?: boolean | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          max_votes_per_user?: number | null
          name?: string
          retro_stages_enabled?: boolean | null
          show_author_names?: boolean | null
          team_id?: string | null
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "board_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          flag_name: string
          is_enabled: boolean
        }
        Insert: {
          description?: string | null
          flag_name: string
          is_enabled?: boolean
        }
        Update: {
          description?: string | null
          flag_name?: string
          is_enabled?: boolean
        }
        Relationships: []
      }
      poker_session_chat: {
        Row: {
          created_at: string
          id: string
          message: string
          reply_to_message_id: string | null
          round_number: number
          session_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          reply_to_message_id?: string | null
          round_number: number
          session_id: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reply_to_message_id?: string | null
          round_number?: number
          session_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "poker_session_chat_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "poker_session_chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "poker_session_chat_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poker_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_session_chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          session_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          session_id: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          session_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poker_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "poker_session_chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "poker_session_chat_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_message_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poker_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_session_rounds: {
        Row: {
          average_points: number
          completed_at: string
          created_at: string
          game_state: string
          id: string
          round_number: number
          selections: Json
          session_id: string
          slack_channel_id: string | null
          slack_message_ts: string | null
          ticket_number: string | null
          ticket_title: string | null
        }
        Insert: {
          average_points?: number
          completed_at?: string
          created_at?: string
          game_state?: string
          id?: string
          round_number: number
          selections?: Json
          session_id: string
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          ticket_number?: string | null
          ticket_title?: string | null
        }
        Update: {
          average_points?: number
          completed_at?: string
          created_at?: string
          game_state?: string
          id?: string
          round_number?: number
          selections?: Json
          session_id?: string
          slack_channel_id?: string | null
          slack_message_ts?: string | null
          ticket_number?: string | null
          ticket_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poker_session_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poker_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_sessions: {
        Row: {
          created_at: string
          current_round_number: number
          id: string
          last_activity_at: string
          presence_enabled: boolean | null
          room_id: string | null
          send_to_slack: boolean | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_round_number?: number
          id?: string
          last_activity_at?: string
          presence_enabled?: boolean | null
          room_id?: string | null
          send_to_slack?: boolean | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_round_number?: number
          id?: string
          last_activity_at?: string
          presence_enabled?: boolean | null
          room_id?: string | null
          send_to_slack?: boolean | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poker_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          background_preference: Json | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string
          theme_preference: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          background_preference?: Json | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string
          theme_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          background_preference?: Json | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string
          theme_preference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      retro_board_config: {
        Row: {
          allow_anonymous: boolean | null
          board_id: string
          created_at: string
          enforce_stage_readiness: boolean | null
          id: string
          max_votes_per_user: number | null
          retro_stages_enabled: boolean | null
          show_author_names: boolean | null
          updated_at: string
          voting_enabled: boolean | null
        }
        Insert: {
          allow_anonymous?: boolean | null
          board_id: string
          created_at?: string
          enforce_stage_readiness?: boolean | null
          id?: string
          max_votes_per_user?: number | null
          retro_stages_enabled?: boolean | null
          show_author_names?: boolean | null
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Update: {
          allow_anonymous?: boolean | null
          board_id?: string
          created_at?: string
          enforce_stage_readiness?: boolean | null
          id?: string
          max_votes_per_user?: number | null
          retro_stages_enabled?: boolean | null
          show_author_names?: boolean | null
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_board_config_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: true
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_board_sessions: {
        Row: {
          board_id: string
          created_at: string
          id: string
          started_at: string
          started_by: string | null
          team_id: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          started_at?: string
          started_by?: string | null
          team_id?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          started_at?: string
          started_by?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_board_sessions_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_board_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_boards: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          creator_id: string | null
          deleted: boolean | null
          id: string
          is_private: boolean | null
          password_hash: string | null
          retro_stage: string | null
          room_id: string
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          creator_id?: string | null
          deleted?: boolean | null
          id?: string
          is_private?: boolean | null
          password_hash?: string | null
          retro_stage?: string | null
          room_id: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          creator_id?: string | null
          deleted?: boolean | null
          id?: string
          is_private?: boolean | null
          password_hash?: string | null
          retro_stage?: string | null
          room_id?: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_columns: {
        Row: {
          board_id: string | null
          color: string
          created_at: string | null
          id: string
          is_action_items: boolean | null
          position: number
          sort_order: number | null
          title: string
        }
        Insert: {
          board_id?: string | null
          color: string
          created_at?: string | null
          id?: string
          is_action_items?: boolean | null
          position: number
          sort_order?: number | null
          title: string
        }
        Update: {
          board_id?: string | null
          color?: string
          created_at?: string | null
          id?: string
          is_action_items?: boolean | null
          position?: number
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_comments: {
        Row: {
          author: string
          author_id: string | null
          created_at: string
          id: string
          item_id: string
          session_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          author?: string
          author_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          session_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          author?: string
          author_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          session_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "retro_items"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_items: {
        Row: {
          author: string
          author_id: string | null
          board_id: string | null
          column_id: string | null
          created_at: string | null
          id: string
          session_id: string | null
          text: string
          updated_at: string | null
          votes: number | null
        }
        Insert: {
          author?: string
          author_id?: string | null
          board_id?: string | null
          column_id?: string | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          text: string
          updated_at?: string | null
          votes?: number | null
        }
        Update: {
          author?: string
          author_id?: string | null
          board_id?: string | null
          column_id?: string | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          text?: string
          updated_at?: string | null
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_items_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "retro_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_user_readiness: {
        Row: {
          board_id: string
          created_at: string | null
          current_stage: string
          id: string
          is_ready: boolean | null
          session_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          board_id: string
          created_at?: string | null
          current_stage: string
          id?: string
          is_ready?: boolean | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string | null
          current_stage?: string
          id?: string
          is_ready?: boolean | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_user_readiness_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      retro_votes: {
        Row: {
          board_id: string | null
          created_at: string | null
          id: string
          item_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          board_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          board_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retro_votes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "retro_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "retro_items"
            referencedColumns: ["id"]
          },
        ]
      }
      team_default_settings: {
        Row: {
          allow_anonymous: boolean | null
          created_at: string
          id: string
          max_votes_per_user: number | null
          show_author_names: boolean | null
          team_id: string
          updated_at: string
          voting_enabled: boolean | null
        }
        Insert: {
          allow_anonymous?: boolean | null
          created_at?: string
          id?: string
          max_votes_per_user?: number | null
          show_author_names?: boolean | null
          team_id: string
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Update: {
          allow_anonymous?: boolean | null
          created_at?: string
          id?: string
          max_votes_per_user?: number | null
          show_author_names?: boolean | null
          team_id?: string
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "team_default_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_type: string | null
          invited_by: string
          is_active: boolean | null
          status: string | null
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_type?: string | null
          invited_by: string
          is_active?: boolean | null
          status?: string | null
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_type?: string | null
          invited_by?: string
          is_active?: boolean | null
          status?: string | null
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          jira_api_key: string | null
          jira_domain: string | null
          jira_email: string | null
          jira_ticket_prefix: string | null
          name: string
          slack_bot_token: string | null
          slack_channel_id: string | null
          slack_webhook_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          jira_api_key?: string | null
          jira_domain?: string | null
          jira_email?: string | null
          jira_ticket_prefix?: string | null
          name: string
          slack_bot_token?: string | null
          slack_channel_id?: string | null
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          jira_api_key?: string | null
          jira_domain?: string | null
          jira_email?: string | null
          jira_ticket_prefix?: string | null
          name?: string
          slack_bot_token?: string | null
          slack_channel_id?: string | null
          slack_webhook_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      template_columns: {
        Row: {
          color: string
          created_at: string
          id: string
          is_action_items: boolean | null
          position: number
          template_id: string
          title: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_action_items?: boolean | null
          position: number
          template_id: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_action_items?: boolean | null
          position?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_columns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "board_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      poker_session_chat_with_details: {
        Row: {
          created_at: string | null
          id: string | null
          message: string | null
          reactions: Json | null
          reply_to_message_content: string | null
          reply_to_message_id: string | null
          reply_to_message_user: string | null
          round_number: number | null
          session_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poker_session_chat_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "poker_session_chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "poker_session_chat_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poker_session_chat_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poker_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_team_invitation: {
        Args: { invitation_token: string }
        Returns: Json
      }
      cleanup_stale_poker_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_columns_from_template: {
        Args: { board_id: string; template_id?: string }
        Returns: undefined
      }
      create_default_columns: {
        Args: { board_id: string }
        Returns: undefined
      }
      get_readiness_summary: {
        Args: { board_id_param: string; stage_param: string }
        Returns: Json
      }
      is_team_admin: {
        Args: { team_id: string; user_id: string }
        Returns: boolean
      }
      is_team_admin_or_owner: {
        Args: { team_id: string; user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { team_id: string; user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

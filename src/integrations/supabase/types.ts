export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      retro_board_config: {
        Row: {
          allow_anonymous: boolean | null
          board_id: string
          created_at: string
          id: string
          max_votes_per_user: number | null
          show_author_names: boolean | null
          updated_at: string
          voting_enabled: boolean | null
        }
        Insert: {
          allow_anonymous?: boolean | null
          board_id: string
          created_at?: string
          id?: string
          max_votes_per_user?: number | null
          show_author_names?: boolean | null
          updated_at?: string
          voting_enabled?: boolean | null
        }
        Update: {
          allow_anonymous?: boolean | null
          board_id?: string
          created_at?: string
          id?: string
          max_votes_per_user?: number | null
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
      retro_boards: {
        Row: {
          created_at: string | null
          creator_id: string | null
          id: string
          is_private: boolean | null
          password_hash: string | null
          room_id: string
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          id?: string
          is_private?: boolean | null
          password_hash?: string | null
          room_id: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          id?: string
          is_private?: boolean | null
          password_hash?: string | null
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
          position: number
          sort_order: number | null
          title: string
        }
        Insert: {
          board_id?: string | null
          color: string
          created_at?: string | null
          id?: string
          position: number
          sort_order?: number | null
          title: string
        }
        Update: {
          board_id?: string | null
          color?: string
          created_at?: string | null
          id?: string
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
          text: string
          updated_at: string
        }
        Insert: {
          author?: string
          author_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          text: string
          updated_at?: string
        }
        Update: {
          author?: string
          author_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
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
          text?: string
          updated_at?: string | null
          votes?: number | null
        }
        Relationships: [
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
      retro_votes: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
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
          invited_by: string
          status: string | null
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string | null
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
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
        ]
      }
      teams: {
        Row: {
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_columns: {
        Args: { board_id: string }
        Returns: undefined
      }
      is_team_admin: {
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

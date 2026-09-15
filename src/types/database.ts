export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_profile_id: string
          challenge_id: string | null
          created_at: string
          event_type: string
          id: string
          match_id: string | null
          metadata: Json
          sport_id: number | null
          target_profile_id: string | null
        }
        Insert: {
          actor_profile_id: string
          challenge_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          match_id?: string | null
          metadata?: Json
          sport_id?: number | null
          target_profile_id?: string | null
        }
        Update: {
          actor_profile_id?: string
          challenge_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string | null
          metadata?: Json
          sport_id?: number | null
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          accepted_at: string | null
          canceled_at: string | null
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          challenger_profile_id: string
          completed_at: string | null
          created_at: string
          declined_at: string | null
          id: string
          is_open: boolean
          location_latitude: number | null
          location_longitude: number | null
          location_name: string
          opponent_profile_id: string | null
          scheduled_at: string
          sport_id: number
          stake_label: string
          stake_note: string | null
          stake_type: string
          status: Database["public"]["Enums"]["challenge_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          canceled_at?: string | null
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          challenger_profile_id: string
          completed_at?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          is_open?: boolean
          location_latitude?: number | null
          location_longitude?: number | null
          location_name: string
          opponent_profile_id?: string | null
          scheduled_at: string
          sport_id: number
          stake_label?: string
          stake_note?: string | null
          stake_type?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          canceled_at?: string | null
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          challenger_profile_id?: string
          completed_at?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          is_open?: boolean
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string
          opponent_profile_id?: string | null
          scheduled_at?: string
          sport_id?: number
          stake_label?: string
          stake_note?: string | null
          stake_type?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_challenger_profile_id_fkey"
            columns: ["challenger_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_opponent_profile_id_fkey"
            columns: ["opponent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          latitude: number | null
          location_name: string
          longitude: number | null
          profile_id: string
          sport: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          latitude?: number | null
          location_name: string
          longitude?: number | null
          profile_id: string
          sport: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          latitude?: number | null
          location_name?: string
          longitude?: number | null
          profile_id?: string
          sport?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rating_ledger: {
        Row: {
          applied_at: string
          k_factor: number
          loser_profile_id: string
          loser_rating_after: number
          loser_rating_before: number
          match_id: string
          sport_id: number
          winner_profile_id: string
          winner_rating_after: number
          winner_rating_before: number
        }
        Insert: {
          applied_at?: string
          k_factor: number
          loser_profile_id: string
          loser_rating_after: number
          loser_rating_before: number
          match_id: string
          sport_id: number
          winner_profile_id: string
          winner_rating_after: number
          winner_rating_before: number
        }
        Update: {
          applied_at?: string
          k_factor?: number
          loser_profile_id?: string
          loser_rating_after?: number
          loser_rating_before?: number
          match_id?: string
          sport_id?: number
          winner_profile_id?: string
          winner_rating_after?: number
          winner_rating_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_rating_ledger_loser_profile_id_fkey"
            columns: ["loser_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rating_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rating_ledger_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rating_ledger_winner_profile_id_fkey"
            columns: ["winner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          challenge_id: string
          challenger_profile_id: string
          confirmed_at: string | null
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_name: string
          loser_profile_id: string | null
          opponent_profile_id: string
          played_at: string | null
          result_confirmation_deadline_at: string | null
          result_confirmation_method: string | null
          result_notes: string | null
          result_outcome:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status: Database["public"]["Enums"]["match_result_status"]
          score_summary: string | null
          sport_id: number
          submitted_at: string | null
          submitted_by_profile_id: string | null
          updated_at: string
          winner_profile_id: string | null
        }
        Insert: {
          challenge_id: string
          challenger_profile_id: string
          confirmed_at?: string | null
          confirmed_by_profile_id?: string | null
          created_at?: string
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          location_name: string
          loser_profile_id?: string | null
          opponent_profile_id: string
          played_at?: string | null
          result_confirmation_deadline_at?: string | null
          result_confirmation_method?: string | null
          result_notes?: string | null
          result_outcome?:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status?: Database["public"]["Enums"]["match_result_status"]
          score_summary?: string | null
          sport_id: number
          submitted_at?: string | null
          submitted_by_profile_id?: string | null
          updated_at?: string
          winner_profile_id?: string | null
        }
        Update: {
          challenge_id?: string
          challenger_profile_id?: string
          confirmed_at?: string | null
          confirmed_by_profile_id?: string | null
          created_at?: string
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          location_name?: string
          loser_profile_id?: string | null
          opponent_profile_id?: string
          played_at?: string | null
          result_confirmation_deadline_at?: string | null
          result_confirmation_method?: string | null
          result_notes?: string | null
          result_outcome?:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status?: Database["public"]["Enums"]["match_result_status"]
          score_summary?: string | null
          sport_id?: number
          submitted_at?: string | null
          submitted_by_profile_id?: string | null
          updated_at?: string
          winner_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: true
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_challenger_profile_id_fkey"
            columns: ["challenger_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_confirmed_by_profile_id_fkey"
            columns: ["confirmed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_loser_profile_id_fkey"
            columns: ["loser_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_opponent_profile_id_fkey"
            columns: ["opponent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_submitted_by_profile_id_fkey"
            columns: ["submitted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_profile_id_fkey"
            columns: ["winner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_locations: {
        Row: {
          area: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          sport: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          sport: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_sport_ratings: {
        Row: {
          created_at: string
          profile_id: string
          rated_matches_count: number
          rating: number
          sport_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          rated_matches_count?: number
          rating?: number
          sport_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          rated_matches_count?: number
          rating?: number
          sport_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_sport_ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_sport_ratings_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_sports: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          profile_id: string
          skill_level: Database["public"]["Enums"]["skill_level"]
          sport_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          profile_id: string
          skill_level: Database["public"]["Enums"]["skill_level"]
          sport_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          profile_id?: string
          skill_level?: Database["public"]["Enums"]["skill_level"]
          sport_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_sports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_stats: {
        Row: {
          created_at: string
          draws: number
          losses: number
          matches_played: number
          profile_id: string
          updated_at: string
          wins: number
          xp: number
        }
        Insert: {
          created_at?: string
          draws?: number
          losses?: number
          matches_played?: number
          profile_id: string
          updated_at?: string
          wins?: number
          xp?: number
        }
        Update: {
          created_at?: string
          draws?: number
          losses?: number
          matches_played?: number
          profile_id?: string
          updated_at?: string
          wins?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_xp_ledger: {
        Row: {
          amount: number
          awarded_at: string
          id: number
          match_id: string
          participant_outcome: string
          profile_id: string
          reason: string
          recorded_at: string
        }
        Insert: {
          amount: number
          awarded_at: string
          id?: never
          match_id: string
          participant_outcome: string
          profile_id: string
          reason?: string
          recorded_at?: string
        }
        Update: {
          amount?: number
          awarded_at?: string
          id?: never
          match_id?: string
          participant_outcome?: string
          profile_id?: string
          reason?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_xp_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_xp_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          availability_status: string | null
          challenge_radius_km: number
          created_at: string
          display_name: string
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          onboarding_completed: boolean
          updated_at: string
          username: string
          vancouver_area: string
        }
        Insert: {
          auth_user_id: string
          availability_status?: string | null
          challenge_radius_km?: number
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          onboarding_completed?: boolean
          updated_at?: string
          username: string
          vancouver_area: string
        }
        Update: {
          auth_user_id?: string
          availability_status?: string | null
          challenge_radius_km?: number
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          onboarding_completed?: boolean
          updated_at?: string
          username?: string
          vancouver_area?: string
        }
        Relationships: []
      }
      sports: {
        Row: {
          created_at: string
          id: number
          is_team_sport: boolean
          name: string
          slug: Database["public"]["Enums"]["sport_slug"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: number
          is_team_sport?: boolean
          name: string
          slug: Database["public"]["Enums"]["sport_slug"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_team_sport?: boolean
          name?: string
          slug?: Database["public"]["Enums"]["sport_slug"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_confirm_overdue_match_results: {
        Args: { p_profile_id?: string }
        Returns: {
          challenge_id: string
          challenger_profile_id: string
          confirmed_at: string | null
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_name: string
          loser_profile_id: string | null
          opponent_profile_id: string
          played_at: string | null
          result_confirmation_deadline_at: string | null
          result_confirmation_method: string | null
          result_notes: string | null
          result_outcome:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status: Database["public"]["Enums"]["match_result_status"]
          score_summary: string | null
          sport_id: number
          submitted_at: string | null
          submitted_by_profile_id: string | null
          updated_at: string
          winner_profile_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      confirm_match_result: {
        Args: { confirmer_profile_id: string; match_id: string }
        Returns: {
          challenge_id: string
          challenger_profile_id: string
          confirmed_at: string | null
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_name: string
          loser_profile_id: string | null
          opponent_profile_id: string
          played_at: string | null
          result_confirmation_deadline_at: string | null
          result_confirmation_method: string | null
          result_notes: string | null
          result_outcome:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status: Database["public"]["Enums"]["match_result_status"]
          score_summary: string | null
          sport_id: number
          submitted_at: string | null
          submitted_by_profile_id: string | null
          updated_at: string
          winner_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_match_result: {
        Args: { rejecting_profile_id: string; target_match_id: string }
        Returns: {
          challenge_id: string
          challenger_profile_id: string
          confirmed_at: string | null
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_name: string
          loser_profile_id: string | null
          opponent_profile_id: string
          played_at: string | null
          result_confirmation_deadline_at: string | null
          result_confirmation_method: string | null
          result_notes: string | null
          result_outcome:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status: Database["public"]["Enums"]["match_result_status"]
          score_summary: string | null
          sport_id: number
          submitted_at: string | null
          submitted_by_profile_id: string | null
          updated_at: string
          winner_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_match_result_v2: {
        Args: {
          result_notes_param?: string
          result_outcome_param: Database["public"]["Enums"]["match_result_outcome"]
          score_summary_param?: string
          submitter_profile_id_param: string
          target_match_id: string
          winner_profile_id_param?: string
        }
        Returns: {
          challenge_id: string
          challenger_profile_id: string
          confirmed_at: string | null
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_name: string
          loser_profile_id: string | null
          opponent_profile_id: string
          played_at: string | null
          result_confirmation_deadline_at: string | null
          result_confirmation_method: string | null
          result_notes: string | null
          result_outcome:
            | Database["public"]["Enums"]["match_result_outcome"]
            | null
          result_status: Database["public"]["Enums"]["match_result_status"]
          score_summary: string | null
          sport_id: number
          submitted_at: string | null
          submitted_by_profile_id: string | null
          updated_at: string
          winner_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      challenge_status:
        | "pending"
        | "accepted"
        | "declined"
        | "completed"
        | "canceled"
      challenge_type: "casual" | "practice" | "ranked"
      match_result_outcome: "win" | "draw"
      match_result_status:
        | "pending_submission"
        | "pending_confirmation"
        | "confirmed"
        | "disputed"
      skill_level: "beginner" | "intermediate" | "advanced" | "competitive"
      sport_slug:
        | "tennis"
        | "basketball"
        | "pickleball"
        | "golf"
        | "volleyball"
        | "running"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      challenge_status: [
        "pending",
        "accepted",
        "declined",
        "completed",
        "canceled",
      ],
      challenge_type: ["casual", "practice", "ranked"],
      match_result_outcome: ["win", "draw"],
      match_result_status: [
        "pending_submission",
        "pending_confirmation",
        "confirmed",
        "disputed",
      ],
      skill_level: ["beginner", "intermediate", "advanced", "competitive"],
      sport_slug: [
        "tennis",
        "basketball",
        "pickleball",
        "golf",
        "volleyball",
        "running",
      ],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_profile_id: string;
          challenge_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          match_id: string | null;
          metadata: Json;
          sport_id: number | null;
          target_profile_id: string | null;
        };
        Insert: {
          actor_profile_id: string;
          challenge_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          match_id?: string | null;
          metadata?: Json;
          sport_id?: number | null;
          target_profile_id?: string | null;
        };
        Update: {
          actor_profile_id?: string;
          challenge_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          match_id?: string | null;
          metadata?: Json;
          sport_id?: number | null;
          target_profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_profile_id_fkey";
            columns: ["actor_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_challenge_id_fkey";
            columns: ["challenge_id"];
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_sport_id_fkey";
            columns: ["sport_id"];
            referencedRelation: "sports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_target_profile_id_fkey";
            columns: ["target_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      challenges: {
        Row: {
          accepted_at: string | null;
          canceled_at: string | null;
          challenge_type: Database["public"]["Enums"]["challenge_type"];
          challenger_profile_id: string;
          completed_at: string | null;
          created_at: string;
          declined_at: string | null;
          id: string;
          is_open: boolean;
          location_latitude: number | null;
          location_longitude: number | null;
          location_name: string;
          opponent_profile_id: string | null;
          scheduled_at: string;
          sport_id: number;
          stake_label: string;
          stake_note: string | null;
          stake_type: string;
          status: Database["public"]["Enums"]["challenge_status"];
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          canceled_at?: string | null;
          challenge_type: Database["public"]["Enums"]["challenge_type"];
          challenger_profile_id: string;
          completed_at?: string | null;
          created_at?: string;
          declined_at?: string | null;
          id?: string;
          is_open?: boolean;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_name: string;
          opponent_profile_id?: string | null;
          scheduled_at: string;
          sport_id: number;
          stake_label?: string;
          stake_note?: string | null;
          stake_type?: string;
          status?: Database["public"]["Enums"]["challenge_status"];
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          canceled_at?: string | null;
          challenge_type?: Database["public"]["Enums"]["challenge_type"];
          challenger_profile_id?: string;
          completed_at?: string | null;
          created_at?: string;
          declined_at?: string | null;
          id?: string;
          is_open?: boolean;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_name?: string;
          opponent_profile_id?: string | null;
          scheduled_at?: string;
          sport_id?: number;
          stake_label?: string;
          stake_note?: string | null;
          stake_type?: string;
          status?: Database["public"]["Enums"]["challenge_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenges_challenger_profile_id_fkey";
            columns: ["challenger_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenges_opponent_profile_id_fkey";
            columns: ["opponent_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenges_sport_id_fkey";
            columns: ["sport_id"];
            referencedRelation: "sports";
            referencedColumns: ["id"];
          }
        ];
      };
      live_sessions: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          latitude: number | null;
          location_id: string | null;
          location_name: string;
          longitude: number | null;
          profile_id: string;
          sport: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          latitude?: number | null;
          location_id?: string | null;
          location_name: string;
          longitude?: number | null;
          profile_id: string;
          sport: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          latitude?: number | null;
          location_id?: string | null;
          location_name?: string;
          longitude?: number | null;
          profile_id?: string;
          sport?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_sessions_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_sessions_location_id_fkey";
            columns: ["location_id"];
            referencedRelation: "play_locations";
            referencedColumns: ["id"];
          }
        ];
      };
      matches: {
        Row: {
          challenge_id: string;
          challenger_profile_id: string;
          confirmed_at: string | null;
          confirmed_by_profile_id: string | null;
          created_at: string;
          id: string;
          location_latitude: number | null;
          location_longitude: number | null;
          location_name: string;
          loser_profile_id: string | null;
          opponent_profile_id: string;
          played_at: string | null;
          rating_applied: boolean;
          result_notes: string | null;
          result_confirmation_deadline_at: string | null;
          result_confirmation_method: string | null;
          result_status: Database["public"]["Enums"]["match_result_status"];
          score_summary: string | null;
          sport_id: number;
          submitted_at: string | null;
          submitted_by_profile_id: string | null;
          updated_at: string;
          winner_profile_id: string | null;
        };
        Insert: {
          challenge_id: string;
          challenger_profile_id: string;
          confirmed_at?: string | null;
          confirmed_by_profile_id?: string | null;
          created_at?: string;
          id?: string;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_name: string;
          loser_profile_id?: string | null;
          opponent_profile_id: string;
          played_at?: string | null;
          rating_applied?: boolean;
          result_notes?: string | null;
          result_confirmation_deadline_at?: string | null;
          result_confirmation_method?: string | null;
          result_status?: Database["public"]["Enums"]["match_result_status"];
          score_summary?: string | null;
          sport_id: number;
          submitted_at?: string | null;
          submitted_by_profile_id?: string | null;
          updated_at?: string;
          winner_profile_id?: string | null;
        };
        Update: {
          challenge_id?: string;
          challenger_profile_id?: string;
          confirmed_at?: string | null;
          confirmed_by_profile_id?: string | null;
          created_at?: string;
          id?: string;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_name?: string;
          loser_profile_id?: string | null;
          opponent_profile_id?: string;
          played_at?: string | null;
          rating_applied?: boolean;
          result_notes?: string | null;
          result_confirmation_deadline_at?: string | null;
          result_confirmation_method?: string | null;
          result_status?: Database["public"]["Enums"]["match_result_status"];
          score_summary?: string | null;
          sport_id?: number;
          submitted_at?: string | null;
          submitted_by_profile_id?: string | null;
          updated_at?: string;
          winner_profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_challenge_id_fkey";
            columns: ["challenge_id"];
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_challenger_profile_id_fkey";
            columns: ["challenger_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_confirmed_by_profile_id_fkey";
            columns: ["confirmed_by_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_loser_profile_id_fkey";
            columns: ["loser_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_opponent_profile_id_fkey";
            columns: ["opponent_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_sport_id_fkey";
            columns: ["sport_id"];
            referencedRelation: "sports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_submitted_by_profile_id_fkey";
            columns: ["submitted_by_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_winner_profile_id_fkey";
            columns: ["winner_profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      play_locations: {
        Row: {
          area: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          sport: string;
          updated_at: string;
        };
        Insert: {
          area?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          sport: string;
          updated_at?: string;
        };
        Update: {
          area?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          sport?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profile_sports: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          profile_id: string;
          skill_level: Database["public"]["Enums"]["skill_level"];
          sport_id: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          profile_id: string;
          skill_level: Database["public"]["Enums"]["skill_level"];
          sport_id: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          profile_id?: string;
          skill_level?: Database["public"]["Enums"]["skill_level"];
          sport_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_sports_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_sports_sport_id_fkey";
            columns: ["sport_id"];
            referencedRelation: "sports";
            referencedColumns: ["id"];
          }
        ];
      };
      profile_stats: {
        Row: {
          created_at: string;
          losses: number;
          matches_played: number;
          profile_id: string;
          updated_at: string;
          wins: number;
        };
        Insert: {
          created_at?: string;
          losses?: number;
          matches_played?: number;
          profile_id: string;
          updated_at?: string;
          wins?: number;
        };
        Update: {
          created_at?: string;
          losses?: number;
          matches_played?: number;
          profile_id?: string;
          updated_at?: string;
          wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profile_stats_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          availability_status: string | null;
          challenge_radius_km: number;
          created_at: string;
          display_name: string;
          email: string | null;
          firebase_uid: string;
          id: string;
          latitude: number | null;
          longitude: number | null;
          onboarding_completed: boolean;
          play_style_tags: string[] | null;
          updated_at: string;
          username: string;
          vancouver_area: string;
        };
        Insert: {
          availability_status?: string | null;
          challenge_radius_km?: number;
          created_at?: string;
          display_name: string;
          email?: string | null;
          firebase_uid: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          onboarding_completed?: boolean;
          play_style_tags?: string[] | null;
          updated_at?: string;
          username: string;
          vancouver_area: string;
        };
        Update: {
          availability_status?: string | null;
          challenge_radius_km?: number;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          firebase_uid?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          onboarding_completed?: boolean;
          play_style_tags?: string[] | null;
          updated_at?: string;
          username?: string;
          vancouver_area?: string;
        };
        Relationships: [];
      };
      sports: {
        Row: {
          created_at: string;
          id: number;
          is_team_sport: boolean;
          name: string;
          slug: Database["public"]["Enums"]["sport_slug"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: number;
          is_team_sport?: boolean;
          name: string;
          slug: Database["public"]["Enums"]["sport_slug"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          is_team_sport?: boolean;
          name?: string;
          slug?: Database["public"]["Enums"]["sport_slug"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      recent_profile_matches: {
        Row: {
          challenge_id: string | null;
          challenger_profile_id: string | null;
          confirmed_at: string | null;
          id: string | null;
          location_name: string | null;
          loser_profile_id: string | null;
          opponent_profile_id: string | null;
          played_at: string | null;
          result_status: Database["public"]["Enums"]["match_result_status"] | null;
          score_summary: string | null;
          sport_id: number | null;
          sport_name: string | null;
          sport_slug: Database["public"]["Enums"]["sport_slug"] | null;
          winner_profile_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_open_challenge: {
        Args: {
          p_challenge_id: string;
        };
        Returns: string;
      };
      auto_confirm_overdue_match_results: {
        Args: {
          p_profile_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["matches"]["Row"][];
      };
      confirm_match_result: {
        Args: {
          confirmer_profile_id: string;
          match_id: string;
        };
        Returns: Database["public"]["Tables"]["matches"]["Row"];
      };
      create_open_challenge: {
        Args: {
          p_challenge_type: Database["public"]["Enums"]["challenge_type"];
          p_location_name: string;
          p_scheduled_at: string;
          p_sport_id: number;
          p_stake_note?: string | null;
        };
        Returns: string;
      };
      get_activity_feed_for_profile: {
        Args: {
          feed_limit?: number | null;
          target_profile_id: string;
        };
        Returns: {
          actor_profile_id: string;
          challenge_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          match_id: string | null;
          metadata: Json;
          sport_slug: Database["public"]["Enums"]["sport_slug"] | null;
          target_profile_id: string | null;
        }[];
      };
      get_open_challenges: {
        Args: {
          p_sport_id?: number | null;
        };
        Returns: {
          challenge_id: string;
          challenge_type: Database["public"]["Enums"]["challenge_type"];
          challenger_area: string;
          challenger_display_name: string;
          challenger_profile_id: string;
          challenger_username: string;
          created_at: string;
          location_name: string;
          matches_played: number;
          scheduled_at: string;
          sport_id: number;
          sport_name: string;
          sport_slug: Database["public"]["Enums"]["sport_slug"];
          stake_note: string | null;
        }[];
      };
      submit_match_result: {
        Args: {
          loser_profile_id_param: string;
          result_notes_param?: string | null;
          score_summary_param?: string | null;
          submitter_profile_id_param: string;
          target_match_id: string;
          winner_profile_id_param: string;
        };
        Returns: Database["public"]["Tables"]["matches"]["Row"];
      };
      insert_activity_event: {
        Args: {
          actor_profile_id_param: string;
          challenge_id_param?: string | null;
          event_type_param: string;
          match_id_param?: string | null;
          metadata_param?: Json;
          sport_id_param?: number | null;
          target_profile_id_param?: string | null;
        };
        Returns: undefined;
      };
      apply_match_rating: {
        Args: {
          match_id: string;
        };
        Returns: undefined;
      };
      reject_match_result: {
        Args: {
          rejecting_profile_id: string;
          target_match_id: string;
        };
        Returns: Database["public"]["Tables"]["matches"]["Row"];
      };
      recalculate_profile_stats: {
        Args: {
          target_profile_id: string;
        };
        Returns: undefined;
      };
      requesting_firebase_uid: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      upsert_profile_stat_row: {
        Args: {
          target_profile_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      challenge_status: "pending" | "accepted" | "declined" | "completed" | "canceled";
      challenge_type: "casual" | "practice" | "ranked";
      match_result_status:
        | "pending_submission"
        | "pending_confirmation"
        | "confirmed"
        | "disputed";
      skill_level: "beginner" | "intermediate" | "advanced" | "competitive";
      sport_slug: "golf" | "tennis" | "pickleball" | "volleyball" | "basketball" | "running";
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
};

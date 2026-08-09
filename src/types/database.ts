export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
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
      admin_users: {
        Row: {
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      draft_picks: {
        Row: {
          created_at: string
          draft_id: string
          draft_slot: number | null
          fantasy_team_id: string | null
          id: string
          is_keeper: boolean
          manager_provider_id: string | null
          metadata: Json
          pick_number: number
          player_name: string
          player_provider_id: string | null
          position: string | null
          pro_team: string | null
          provider_pick_id: string
          raw_data: Json
          roster_id: number | null
          round: number
          round_pick: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          draft_slot?: number | null
          fantasy_team_id?: string | null
          id?: string
          is_keeper?: boolean
          manager_provider_id?: string | null
          metadata?: Json
          pick_number: number
          player_name: string
          player_provider_id?: string | null
          position?: string | null
          pro_team?: string | null
          provider_pick_id: string
          raw_data?: Json
          roster_id?: number | null
          round: number
          round_pick: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          draft_slot?: number | null
          fantasy_team_id?: string | null
          id?: string
          is_keeper?: boolean
          manager_provider_id?: string | null
          metadata?: Json
          pick_number?: number
          player_name?: string
          player_provider_id?: string | null
          position?: string | null
          pro_team?: string | null
          provider_pick_id?: string
          raw_data?: Json
          roster_id?: number | null
          round?: number
          round_pick?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
        ]
      }
      drafts: {
        Row: {
          created_at: string
          draft_type: string | null
          id: string
          last_synced_at: string
          league_id: string | null
          metadata: Json
          name: string | null
          provider: string
          provider_draft_id: string
          raw_data: Json
          rounds: number | null
          season_id: string | null
          season_year: number
          settings: Json
          starts_at: string | null
          status: string | null
          team_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_type?: string | null
          id?: string
          last_synced_at?: string
          league_id?: string | null
          metadata?: Json
          name?: string | null
          provider: string
          provider_draft_id: string
          raw_data?: Json
          rounds?: number | null
          season_id?: string | null
          season_year: number
          settings?: Json
          starts_at?: string | null
          status?: string | null
          team_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_type?: string | null
          id?: string
          last_synced_at?: string
          league_id?: string | null
          metadata?: Json
          name?: string | null
          provider?: string
          provider_draft_id?: string
          raw_data?: Json
          rounds?: number | null
          season_id?: string | null
          season_year?: number
          settings?: Json
          starts_at?: string | null
          status?: string | null
          team_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_notifications: {
        Row: {
          action_url: string | null
          article_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
          recipient_user_id: string
          title: string
        }
        Insert: {
          action_url?: string | null
          article_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          read_at?: string | null
          recipient_user_id: string
          title: string
        }
        Update: {
          action_url?: string | null
          article_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          recipient_user_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "editorial_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "gazette_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "public_gazette_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_review_events: {
        Row: {
          action: string
          actor_user_id: string | null
          article_id: string
          created_at: string
          id: string
          note: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          article_id: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          article_id?: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_review_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "editorial_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_review_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "gazette_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_review_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "public_gazette_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_teams: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          last_synced_at: string
          league_id: string
          losses: number
          manager_id: string | null
          metadata: Json
          points_against: number
          points_for: number
          raw_data: Json
          season_id: string
          settings: Json
          sleeper_roster_id: number
          team_name: string | null
          ties: number
          updated_at: string
          waiver_budget_used: number | null
          waiver_position: number | null
          wins: number
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string
          league_id: string
          losses?: number
          manager_id?: string | null
          metadata?: Json
          points_against?: number
          points_for?: number
          raw_data?: Json
          season_id: string
          settings?: Json
          sleeper_roster_id: number
          team_name?: string | null
          ties?: number
          updated_at?: string
          waiver_budget_used?: number | null
          waiver_position?: number | null
          wins?: number
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string
          league_id?: string
          losses?: number
          manager_id?: string | null
          metadata?: Json
          points_against?: number
          points_for?: number
          raw_data?: Json
          season_id?: string
          settings?: Json
          sleeper_roster_id?: number
          team_name?: string | null
          ties?: number
          updated_at?: string
          waiver_budget_used?: number | null
          waiver_position?: number | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      gazette_articles: {
        Row: {
          author_name: string
          body: Json
          category: string
          created_at: string
          created_by: string | null
          headline: string
          homepage_order: number | null
          id: string
          image_alt: string | null
          image_url: string | null
          is_featured: boolean
          published_at: string | null
          slug: string
          status: string
          subcategory: string | null
          summary: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          body?: Json
          category: string
          created_at?: string
          created_by?: string | null
          headline: string
          homepage_order?: number | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_featured?: boolean
          published_at?: string | null
          slug: string
          status?: string
          subcategory?: string | null
          summary: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          body?: Json
          category?: string
          created_at?: string
          created_by?: string | null
          headline?: string
          homepage_order?: number | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_featured?: boolean
          published_at?: string | null
          slug?: string
          status?: string
          subcategory?: string | null
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      league_members: {
        Row: {
          created_at: string
          id: string
          is_owner: boolean
          league_id: string
          manager_id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_owner?: boolean
          league_id: string
          manager_id: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_owner?: boolean
          league_id?: string
          manager_id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      league_transactions: {
        Row: {
          created_at: string
          creator_provider_id: string | null
          faab_bid: number | null
          id: string
          last_synced_at: string
          league_id: string | null
          metadata: Json
          occurred_at: string | null
          processed_at: string | null
          provider: string
          provider_transaction_id: string
          raw_data: Json
          season_id: string | null
          season_year: number
          settings: Json
          status: string
          transaction_type: string
          updated_at: string
          week: number
        }
        Insert: {
          created_at?: string
          creator_provider_id?: string | null
          faab_bid?: number | null
          id?: string
          last_synced_at?: string
          league_id?: string | null
          metadata?: Json
          occurred_at?: string | null
          processed_at?: string | null
          provider: string
          provider_transaction_id: string
          raw_data?: Json
          season_id?: string | null
          season_year: number
          settings?: Json
          status: string
          transaction_type: string
          updated_at?: string
          week: number
        }
        Update: {
          created_at?: string
          creator_provider_id?: string | null
          faab_bid?: number | null
          id?: string
          last_synced_at?: string
          league_id?: string | null
          metadata?: Json
          occurred_at?: string | null
          processed_at?: string | null
          provider?: string
          provider_transaction_id?: string
          raw_data?: Json
          season_id?: string | null
          season_year?: number
          settings?: Json
          status?: string
          transaction_type?: string
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_transactions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_transactions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          avatar: string | null
          created_at: string
          current_week: number | null
          draft_id: string | null
          id: string
          last_synced_at: string
          metadata: Json
          name: string
          previous_league_id: string | null
          raw_data: Json
          roster_positions: Json
          scoring_settings: Json
          season: number
          settings: Json
          sleeper_created_at: string | null
          sleeper_league_id: string
          sport: string
          status: string | null
          total_rosters: number | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          current_week?: number | null
          draft_id?: string | null
          id?: string
          last_synced_at?: string
          metadata?: Json
          name: string
          previous_league_id?: string | null
          raw_data?: Json
          roster_positions?: Json
          scoring_settings?: Json
          season: number
          settings?: Json
          sleeper_created_at?: string | null
          sleeper_league_id: string
          sport?: string
          status?: string | null
          total_rosters?: number | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          current_week?: number | null
          draft_id?: string | null
          id?: string
          last_synced_at?: string
          metadata?: Json
          name?: string
          previous_league_id?: string | null
          raw_data?: Json
          roster_positions?: Json
          scoring_settings?: Json
          season?: number
          settings?: Json
          sleeper_created_at?: string | null
          sleeper_league_id?: string
          sport?: string
          status?: string | null
          total_rosters?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      managers: {
        Row: {
          avatar: string | null
          created_at: string
          display_name: string
          id: string
          last_synced_at: string
          metadata: Json
          raw_data: Json
          sleeper_user_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name: string
          id?: string
          last_synced_at?: string
          metadata?: Json
          raw_data?: Json
          sleeper_user_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_synced_at?: string
          metadata?: Json
          raw_data?: Json
          sleeper_user_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      matchup_players: {
        Row: {
          created_at: string
          id: string
          is_starter: boolean
          matchup_team_id: string
          nfl_team_at_week: string | null
          points: number
          sleeper_player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_starter?: boolean
          matchup_team_id: string
          nfl_team_at_week?: string | null
          points?: number
          sleeper_player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_starter?: boolean
          matchup_team_id?: string
          nfl_team_at_week?: string | null
          points?: number
          sleeper_player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchup_players_matchup_team_id_fkey"
            columns: ["matchup_team_id"]
            isOneToOne: false
            referencedRelation: "matchup_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_players_matchup_team_id_fkey"
            columns: ["matchup_team_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_results"
            referencedColumns: ["matchup_team_id"]
          },
          {
            foreignKeyName: "matchup_players_sleeper_player_id_fkey"
            columns: ["sleeper_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["sleeper_player_id"]
          },
        ]
      }
      matchup_teams: {
        Row: {
          bench_points: number | null
          created_at: string
          fantasy_team_id: string
          id: string
          is_tie: boolean
          is_winner: boolean | null
          matchup_id: string
          points: number
          raw_data: Json | null
          starters_points: number | null
          updated_at: string
        }
        Insert: {
          bench_points?: number | null
          created_at?: string
          fantasy_team_id: string
          id?: string
          is_tie?: boolean
          is_winner?: boolean | null
          matchup_id: string
          points?: number
          raw_data?: Json | null
          starters_points?: number | null
          updated_at?: string
        }
        Update: {
          bench_points?: number | null
          created_at?: string
          fantasy_team_id?: string
          id?: string
          is_tie?: boolean
          is_winner?: boolean | null
          matchup_id?: string
          points?: number
          raw_data?: Json | null
          starters_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "matchup_teams_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: false
            referencedRelation: "matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_teams_matchup_id_fkey"
            columns: ["matchup_id"]
            isOneToOne: false
            referencedRelation: "team_weekly_results"
            referencedColumns: ["matchup_id"]
          },
        ]
      }
      matchups: {
        Row: {
          created_at: string
          id: string
          league_id: string
          season_id: string
          sleeper_matchup_id: number
          status: string
          updated_at: string
          week: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          season_id: string
          sleeper_matchup_id: number
          status?: string
          updated_at?: string
          week: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          season_id?: string
          sleeper_matchup_id?: number
          status?: string
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_weekly_scores: {
        Row: {
          created_at: string
          id: string
          nfl_team: string | null
          player_name: string
          points: number
          position: string
          raw_stats: Json
          season_id: string
          season_year: number
          sleeper_player_id: string
          updated_at: string
          week: number
        }
        Insert: {
          created_at?: string
          id?: string
          nfl_team?: string | null
          player_name: string
          points?: number
          position: string
          raw_stats?: Json
          season_id: string
          season_year: number
          sleeper_player_id: string
          updated_at?: string
          week: number
        }
        Update: {
          created_at?: string
          id?: string
          nfl_team?: string | null
          player_name?: string
          points?: number
          position?: string
          raw_stats?: Json
          season_id?: string
          season_year?: number
          sleeper_player_id?: string
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_weekly_scores_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean | null
          age: number | null
          created_at: string
          depth_chart_order: number | null
          depth_chart_position: string | null
          fantasy_positions: string[]
          first_name: string | null
          full_name: string | null
          injury_status: string | null
          jersey_number: number | null
          last_name: string | null
          last_synced_at: string
          nfl_team: string | null
          position: string | null
          raw_data: Json
          search_rank: number | null
          sleeper_player_id: string
          status: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          active?: boolean | null
          age?: number | null
          created_at?: string
          depth_chart_order?: number | null
          depth_chart_position?: string | null
          fantasy_positions?: string[]
          first_name?: string | null
          full_name?: string | null
          injury_status?: string | null
          jersey_number?: number | null
          last_name?: string | null
          last_synced_at?: string
          nfl_team?: string | null
          position?: string | null
          raw_data?: Json
          search_rank?: number | null
          sleeper_player_id: string
          status?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          active?: boolean | null
          age?: number | null
          created_at?: string
          depth_chart_order?: number | null
          depth_chart_position?: string | null
          fantasy_positions?: string[]
          first_name?: string | null
          full_name?: string | null
          injury_status?: string | null
          jersey_number?: number | null
          last_name?: string | null
          last_synced_at?: string
          nfl_team?: string | null
          position?: string | null
          raw_data?: Json
          search_rank?: number | null
          sleeper_player_id?: string
          status?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      power_rankings: {
        Row: {
          created_at: string
          created_by: string | null
          entries: Json
          id: string
          season_year: number
          status: string
          title: string
          updated_at: string
          week: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entries?: Json
          id?: string
          season_year: number
          status?: string
          title?: string
          updated_at?: string
          week: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entries?: Json
          id?: string
          season_year?: number
          status?: string
          title?: string
          updated_at?: string
          week?: number
        }
        Relationships: []
      }
      publication_contributors: {
        Row: {
          created_at: string
          display_name: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      reader_poll_windows: {
        Row: {
          closes_at: string | null
          is_open: boolean
          season_year: number
          updated_at: string
          week: number
        }
        Insert: {
          closes_at?: string | null
          is_open?: boolean
          season_year: number
          updated_at?: string
          week: number
        }
        Update: {
          closes_at?: string | null
          is_open?: boolean
          season_year?: number
          updated_at?: string
          week?: number
        }
        Relationships: []
      }
      reader_power_ballots: {
        Row: {
          created_at: string
          id: string
          rankings: Json
          season_year: number
          updated_at: string
          user_id: string
          week: number
        }
        Insert: {
          created_at?: string
          id?: string
          rankings: Json
          season_year: number
          updated_at?: string
          user_id: string
          week: number
        }
        Update: {
          created_at?: string
          id?: string
          rankings?: Json
          season_year?: number
          updated_at?: string
          user_id?: string
          week?: number
        }
        Relationships: []
      }
      reader_profiles: {
        Row: {
          created_at: string
          digest_enabled: boolean
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_enabled?: boolean
          display_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_enabled?: boolean
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roster_players: {
        Row: {
          created_at: string
          fantasy_team_id: string
          id: string
          is_reserve: boolean
          is_starter: boolean
          is_taxi: boolean
          sleeper_player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fantasy_team_id: string
          id?: string
          is_reserve?: boolean
          is_starter?: boolean
          is_taxi?: boolean
          sleeper_player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fantasy_team_id?: string
          id?: string
          is_reserve?: boolean
          is_starter?: boolean
          is_taxi?: boolean
          sleeper_player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_players_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_players_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "roster_players_sleeper_player_id_fkey"
            columns: ["sleeper_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["sleeper_player_id"]
          },
        ]
      }
      roster_snapshot_players: {
        Row: {
          created_at: string
          id: string
          is_reserve: boolean
          is_starter: boolean
          is_taxi: boolean
          roster_snapshot_id: string
          sleeper_player_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_reserve?: boolean
          is_starter?: boolean
          is_taxi?: boolean
          roster_snapshot_id: string
          sleeper_player_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_reserve?: boolean
          is_starter?: boolean
          is_taxi?: boolean
          roster_snapshot_id?: string
          sleeper_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_snapshot_players_roster_snapshot_id_fkey"
            columns: ["roster_snapshot_id"]
            isOneToOne: false
            referencedRelation: "roster_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_snapshot_players_sleeper_player_id_fkey"
            columns: ["sleeper_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["sleeper_player_id"]
          },
        ]
      }
      roster_snapshots: {
        Row: {
          created_at: string
          fantasy_team_id: string
          id: string
          losses: number
          metadata: Json | null
          points_against: number | null
          points_for: number | null
          raw_data: Json | null
          season_id: string
          settings: Json | null
          ties: number
          waiver_budget_used: number | null
          waiver_position: number | null
          week: number
          wins: number
        }
        Insert: {
          created_at?: string
          fantasy_team_id: string
          id?: string
          losses?: number
          metadata?: Json | null
          points_against?: number | null
          points_for?: number | null
          raw_data?: Json | null
          season_id: string
          settings?: Json | null
          ties?: number
          waiver_budget_used?: number | null
          waiver_position?: number | null
          week: number
          wins?: number
        }
        Update: {
          created_at?: string
          fantasy_team_id?: string
          id?: string
          losses?: number
          metadata?: Json | null
          points_against?: number | null
          points_for?: number | null
          raw_data?: Json | null
          season_id?: string
          settings?: Json | null
          ties?: number
          waiver_budget_used?: number | null
          waiver_position?: number | null
          week?: number
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_snapshots_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_snapshots_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "roster_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          league_id: string
          league_name: string | null
          metadata: Json | null
          playoff_start_week: number | null
          playoff_teams: number | null
          raw_data: Json | null
          regular_season_weeks: number | null
          roster_positions: Json | null
          scoring_settings: Json | null
          season_type: string
          sleeper_league_id: string
          status: string
          total_rosters: number | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          league_name?: string | null
          metadata?: Json | null
          playoff_start_week?: number | null
          playoff_teams?: number | null
          raw_data?: Json | null
          regular_season_weeks?: number | null
          roster_positions?: Json | null
          scoring_settings?: Json | null
          season_type?: string
          sleeper_league_id: string
          status?: string
          total_rosters?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          league_name?: string | null
          metadata?: Json | null
          playoff_start_week?: number | null
          playoff_teams?: number | null
          raw_data?: Json | null
          regular_season_weeks?: number | null
          roster_positions?: Json | null
          scoring_settings?: Json | null
          season_type?: string
          sleeper_league_id?: string
          status?: string
          total_rosters?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          completed_at: string | null
          details: Json
          error_message: string | null
          id: string
          records_processed: number
          sleeper_league_id: string | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json
          error_message?: string | null
          id?: string
          records_processed?: number
          sleeper_league_id?: string | null
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          details?: Json
          error_message?: string | null
          id?: string
          records_processed?: number
          sleeper_league_id?: string | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      transaction_assets: {
        Row: {
          amount: number | null
          asset_type: string
          created_at: string
          draft_round: number | null
          draft_season: number | null
          from_fantasy_team_id: string | null
          from_provider_roster_id: number | null
          id: string
          movement_type: string
          original_provider_roster_id: number | null
          player_name: string | null
          player_provider_id: string | null
          position: string | null
          pro_team: string | null
          provider_asset_key: string
          raw_data: Json
          to_fantasy_team_id: string | null
          to_provider_roster_id: number | null
          transaction_id: string
        }
        Insert: {
          amount?: number | null
          asset_type: string
          created_at?: string
          draft_round?: number | null
          draft_season?: number | null
          from_fantasy_team_id?: string | null
          from_provider_roster_id?: number | null
          id?: string
          movement_type: string
          original_provider_roster_id?: number | null
          player_name?: string | null
          player_provider_id?: string | null
          position?: string | null
          pro_team?: string | null
          provider_asset_key: string
          raw_data?: Json
          to_fantasy_team_id?: string | null
          to_provider_roster_id?: number | null
          transaction_id: string
        }
        Update: {
          amount?: number | null
          asset_type?: string
          created_at?: string
          draft_round?: number | null
          draft_season?: number | null
          from_fantasy_team_id?: string | null
          from_provider_roster_id?: number | null
          id?: string
          movement_type?: string
          original_provider_roster_id?: number | null
          player_name?: string | null
          player_provider_id?: string | null
          position?: string | null
          pro_team?: string | null
          provider_asset_key?: string
          raw_data?: Json
          to_fantasy_team_id?: string | null
          to_provider_roster_id?: number | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_assets_from_fantasy_team_id_fkey"
            columns: ["from_fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_assets_from_fantasy_team_id_fkey"
            columns: ["from_fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "transaction_assets_to_fantasy_team_id_fkey"
            columns: ["to_fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_assets_to_fantasy_team_id_fkey"
            columns: ["to_fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "transaction_assets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "league_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_participants: {
        Row: {
          consented: boolean
          created_at: string
          fantasy_team_id: string | null
          id: string
          provider_roster_id: number
          transaction_id: string
        }
        Insert: {
          consented?: boolean
          created_at?: string
          fantasy_team_id?: string | null
          id?: string
          provider_roster_id: number
          transaction_id: string
        }
        Update: {
          consented?: boolean
          created_at?: string
          fantasy_team_id?: string | null
          id?: string
          provider_roster_id?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_participants_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_participants_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "transaction_participants_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "league_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_digest_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          delivered_count: number
          error_message: string | null
          failed_count: number
          id: string
          recipient_count: number
          season_year: number | null
          status: string
          subject: string
          week: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          delivered_count?: number
          error_message?: string | null
          failed_count?: number
          id?: string
          recipient_count?: number
          season_year?: number | null
          status?: string
          subject: string
          week?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          delivered_count?: number
          error_message?: string | null
          failed_count?: number
          id?: string
          recipient_count?: number
          season_year?: number | null
          status?: string
          subject?: string
          week?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      all_play_standings: {
        Row: {
          all_play_games: number | null
          all_play_losses: number | null
          all_play_percentage: number | null
          all_play_rank: number | null
          all_play_ties: number | null
          all_play_wins: number | null
          average_points: number | null
          fantasy_team_id: string | null
          league_id: string | null
          points_for: number | null
          season_id: string | null
          season_year: number | null
          sleeper_league_id: string | null
          sleeper_roster_id: number | null
          team_name: string | null
          weeks_played: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_articles: {
        Row: {
          author_name: string | null
          can_publish: boolean | null
          category: string | null
          created_at: string | null
          editorial_date: string | null
          editorial_sort_at: string | null
          has_body: boolean | null
          has_featured_image: boolean | null
          has_summary: boolean | null
          headline: string | null
          homepage_order: number | null
          id: string | null
          image_alt: string | null
          image_url: string | null
          is_due_for_publishing: boolean | null
          is_featured: boolean | null
          is_publicly_available: boolean | null
          is_scheduled: boolean | null
          needs_image_alt: boolean | null
          published_at: string | null
          slug: string | null
          status: string | null
          status_label: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          author_name?: string | null
          can_publish?: never
          category?: string | null
          created_at?: string | null
          editorial_date?: never
          editorial_sort_at?: never
          has_body?: never
          has_featured_image?: never
          has_summary?: never
          headline?: string | null
          homepage_order?: number | null
          id?: string | null
          image_alt?: string | null
          image_url?: string | null
          is_due_for_publishing?: never
          is_featured?: boolean | null
          is_publicly_available?: never
          is_scheduled?: never
          needs_image_alt?: never
          published_at?: string | null
          slug?: string | null
          status?: string | null
          status_label?: never
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          author_name?: string | null
          can_publish?: never
          category?: string | null
          created_at?: string | null
          editorial_date?: never
          editorial_sort_at?: never
          has_body?: never
          has_featured_image?: never
          has_summary?: never
          headline?: string | null
          homepage_order?: number | null
          id?: string | null
          image_alt?: string | null
          image_url?: string | null
          is_due_for_publishing?: never
          is_featured?: boolean | null
          is_publicly_available?: never
          is_scheduled?: never
          needs_image_alt?: never
          published_at?: string | null
          slug?: string | null
          status?: string | null
          status_label?: never
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_gazette_articles: {
        Row: {
          author_name: string | null
          body: Json | null
          category: string | null
          created_at: string | null
          effective_status: string | null
          headline: string | null
          homepage_order: number | null
          id: string | null
          image_alt: string | null
          image_url: string | null
          is_featured: boolean | null
          published_at: string | null
          published_from_schedule: boolean | null
          slug: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          author_name?: string | null
          body?: Json | null
          category?: string | null
          created_at?: string | null
          effective_status?: never
          headline?: string | null
          homepage_order?: number | null
          id?: string | null
          image_alt?: string | null
          image_url?: string | null
          is_featured?: boolean | null
          published_at?: string | null
          published_from_schedule?: never
          slug?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          author_name?: string | null
          body?: Json | null
          category?: string | null
          created_at?: string | null
          effective_status?: never
          headline?: string | null
          homepage_order?: number | null
          id?: string | null
          image_alt?: string | null
          image_url?: string | null
          is_featured?: boolean | null
          published_at?: string | null
          published_from_schedule?: never
          slug?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_reader_profiles: {
        Row: {
          display_name: string | null
          user_id: string | null
        }
        Insert: {
          display_name?: string | null
          user_id?: string | null
        }
        Update: {
          display_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      season_standings: {
        Row: {
          average_points: number | null
          fantasy_team_id: string | null
          games_played: number | null
          highest_score: number | null
          league_id: string | null
          losses: number | null
          lowest_score: number | null
          point_differential: number | null
          points_against: number | null
          points_for: number | null
          season_id: string | null
          season_year: number | null
          sleeper_league_id: string | null
          sleeper_roster_id: number | null
          standings_rank: number | null
          team_name: string | null
          ties: number | null
          winning_percentage: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      team_weekly_results: {
        Row: {
          bench_points: number | null
          fantasy_team_id: string | null
          is_tie: boolean | null
          is_winner: boolean | null
          league_id: string | null
          loss: number | null
          matchup_id: string | null
          matchup_team_id: string | null
          opponent_fantasy_team_id: string | null
          opponent_sleeper_roster_id: number | null
          opponent_team_name: string | null
          point_differential: number | null
          points_against: number | null
          points_for: number | null
          result: string | null
          season_id: string | null
          season_year: number | null
          sleeper_league_id: string | null
          sleeper_matchup_id: number | null
          sleeper_roster_id: number | null
          starters_points: number | null
          team_name: string | null
          tie: number | null
          week: number | null
          win: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["opponent_fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["opponent_fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_standings: {
        Row: {
          average_points: number | null
          fantasy_team_id: string | null
          games_played: number | null
          highest_score: number | null
          league_id: string | null
          losses: number | null
          lowest_score: number | null
          point_differential: number | null
          points_against: number | null
          points_for: number | null
          season_id: string | null
          season_year: number | null
          sleeper_league_id: string | null
          sleeper_roster_id: number | null
          standings_rank: number | null
          team_name: string | null
          ties: number | null
          week: number | null
          winning_percentage: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "fantasy_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchup_teams_fantasy_team_id_fkey"
            columns: ["fantasy_team_id"]
            isOneToOne: false
            referencedRelation: "season_standings"
            referencedColumns: ["fantasy_team_id"]
          },
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_add_publication_contributor: {
        Args: { contributor_display_name: string; contributor_email: string }
        Returns: string
      }
      admin_publication_contributors: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          role: string
          user_id: string
        }[]
      }
      admin_remove_publication_contributor: {
        Args: { contributor_user_id: string }
        Returns: undefined
      }
      admin_return_article_for_changes: {
        Args: { review_note: string; target_article_id: string }
        Returns: undefined
      }
      admin_set_contributor_access: {
        Args: { access_enabled: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_site_accounts: {
        Args: never
        Returns: {
          created_at: string
          digest_enabled: boolean
          display_name: string
          email: string
          is_admin: boolean
          is_contributor: boolean
          user_id: string
        }[]
      }
      admin_sleeper_status: { Args: never; Returns: Json }
      article_login_identity: {
        Args: { target_article_id: string }
        Returns: {
          email: string
          login: string
          user_id: string
        }[]
      }
      is_gazette_admin: { Args: never; Returns: boolean }
      public_computer_poll_lineups: {
        Args: { target_season_year: number; target_through_week: number }
        Returns: {
          fantasy_team_id: string
          is_starter: boolean
          player_position: string
          points: number
          sleeper_player_id: string
          week: number
        }[]
      }
      public_matchup_lineups: {
        Args: { target_matchup_team_ids: string[] }
        Returns: {
          is_starter: boolean
          matchup_team_id: string
          nfl_team: string
          player_name: string
          player_position: string
          points: number
          sleeper_player_id: string
        }[]
      }
      reader_poll_is_open: {
        Args: { target_season: number; target_week: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

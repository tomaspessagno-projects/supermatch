// Generado con generate_typescript_types de Supabase (sin los helpers genéricos). No editar a mano.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      minigames: {
        Row: {
          id: string
          is_active: boolean
          max_score: number
          min_duration_ms: number
          name: string
        }
        Insert: {
          id: string
          is_active?: boolean
          max_score: number
          min_duration_ms: number
          name: string
        }
        Update: {
          id?: string
          is_active?: boolean
          max_score?: number
          min_duration_ms?: number
          name?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          id: string
          nickname: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id: string
          nickname: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      run_results: {
        Row: {
          duration_ms: number
          minigame_id: string
          run_id: string
          score: number
          slot: number
        }
        Insert: {
          duration_ms: number
          minigame_id: string
          run_id: string
          score: number
          slot: number
        }
        Update: {
          duration_ms?: number
          minigame_id?: string
          run_id?: string
          score?: number
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "run_results_minigame_id_fkey"
            columns: ["minigame_id"]
            isOneToOne: false
            referencedRelation: "minigames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          finished_at: string | null
          id: string
          player_id: string
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          team_id: string
          total_score: number
        }
        Insert: {
          finished_at?: string | null
          id?: string
          player_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          team_id: string
          total_score?: number
        }
        Update: {
          finished_at?: string | null
          id?: string
          player_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          team_id?: string
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "runs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_missions: {
        Row: {
          completed_at: string | null
          day: string
          progress: number
          target: number
          team_id: string
        }
        Insert: {
          completed_at?: string | null
          day: string
          progress?: number
          target: number
          team_id: string
        }
        Update: {
          completed_at?: string | null
          day?: string
          progress?: number
          target?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_missions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_totals: {
        Row: {
          runs_count: number
          team_id: string
          total_score: number
          updated_at: string
        }
        Insert: {
          runs_count?: number
          team_id: string
          total_score?: number
          updated_at?: string
        }
        Update: {
          runs_count?: number
          team_id?: string
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_totals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color_hex: string
          id: string
          name: string
        }
        Insert: {
          color_hex: string
          id: string
          name: string
        }
        Update: {
          color_hex?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finish_run: {
        Args: { p_results: Json; p_run_id: string }
        Returns: number
      }
      mission_day: { Args: never; Returns: string }
      mission_target: { Args: never; Returns: number }
      start_run: { Args: never; Returns: string }
      tower_cash: { Args: { p_climbed: number }; Returns: number }
      today_missions: {
        Args: never
        Returns: {
          completed_at: string
          progress: number
          target: number
          team_id: string
        }[]
      }
    }
    Enums: {
      run_status: "in_progress" | "finished" | "abandoned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      run_status: ["in_progress", "finished", "abandoned"],
    },
  },
} as const

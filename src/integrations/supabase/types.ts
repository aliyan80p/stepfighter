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
  public: {
    Tables: {
      answers: {
        Row: {
          answer_index: number
          answer_text: string
          correct_percentage: number | null
          id: number
          question_id: number
        }
        Insert: {
          answer_index: number
          answer_text: string
          correct_percentage?: number | null
          id: number
          question_id: number
        }
        Update: {
          answer_index?: number
          answer_text?: string
          correct_percentage?: number | null
          id?: number
          question_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          created_at: string
          id: number
          is_correct: boolean | null
          question_id: number
          selected_answer: number | null
          test_id: number | null
          time_seconds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_correct?: boolean | null
          question_id: number
          selected_answer?: number | null
          test_id?: number | null
          time_seconds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_correct?: boolean | null
          question_id?: number
          selected_answer?: number | null
          test_id?: number | null
          time_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          question_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          question_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          question_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          corr_taken: number | null
          correct_answer: number | null
          explanation: string | null
          id: number
          media_name: string | null
          other_medias: string | null
          ppl_taken: number | null
          question: string
          question_format_type: number | null
          question_type: number | null
          subject_id: number | null
          system_id: number | null
          title: string | null
        }
        Insert: {
          corr_taken?: number | null
          correct_answer?: number | null
          explanation?: string | null
          id: number
          media_name?: string | null
          other_medias?: string | null
          ppl_taken?: number | null
          question: string
          question_format_type?: number | null
          question_type?: number | null
          subject_id?: number | null
          system_id?: number | null
          title?: string | null
        }
        Update: {
          corr_taken?: number | null
          correct_answer?: number | null
          explanation?: string | null
          id?: number
          media_name?: string | null
          other_medias?: string | null
          ppl_taken?: number | null
          question?: string
          question_format_type?: number | null
          question_type?: number | null
          subject_id?: number | null
          system_id?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      refs: {
        Row: {
          id: number
          question_id: number
          ref_link: string | null
          ref_title: string | null
          ref_type: number | null
        }
        Insert: {
          id: number
          question_id: number
          ref_link?: string | null
          ref_title?: string | null
          ref_type?: number | null
        }
        Update: {
          id?: number
          question_id?: number
          ref_link?: string | null
          ref_title?: string | null
          ref_type?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "refs_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          count: number | null
          id: number
          name: string
        }
        Insert: {
          count?: number | null
          id: number
          name: string
        }
        Update: {
          count?: number | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      systems: {
        Row: {
          count: number | null
          id: number
          name: string
        }
        Insert: {
          count?: number | null
          id: number
          name: string
        }
        Update: {
          count?: number | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          created_at: string
          current_index: number
          done: boolean
          id: number
          mode: string
          question_ids: number[]
          right_count: number
          subject_label: string | null
          system_label: string | null
          user_id: string
          wrong_count: number
        }
        Insert: {
          created_at?: string
          current_index?: number
          done?: boolean
          id?: number
          mode?: string
          question_ids: number[]
          right_count?: number
          subject_label?: string | null
          system_label?: string | null
          user_id: string
          wrong_count?: number
        }
        Update: {
          created_at?: string
          current_index?: number
          done?: boolean
          id?: number
          mode?: string
          question_ids?: number[]
          right_count?: number
          subject_label?: string | null
          system_label?: string | null
          user_id?: string
          wrong_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

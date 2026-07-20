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
          qbank_id: number
          question_id: number
        }
        Insert: {
          answer_index: number
          answer_text: string
          correct_percentage?: number | null
          id: number
          qbank_id: number
          question_id: number
        }
        Update: {
          answer_index?: number
          answer_text?: string
          correct_percentage?: number | null
          id?: number
          qbank_id?: number
          question_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_fkey"
            columns: ["qbank_id", "question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["qbank_id", "id"]
          },
        ]
      }
      attempts: {
        Row: {
          created_at: string
          id: number
          is_correct: boolean | null
          qbank_id: number
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
          qbank_id: number
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
          qbank_id?: number
          question_id?: number
          selected_answer?: number | null
          test_id?: number | null
          time_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_question_fkey"
            columns: ["qbank_id", "question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["qbank_id", "id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          qbank_id: number
          question_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          qbank_id: number
          question_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          qbank_id?: number
          question_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_question_fkey"
            columns: ["qbank_id", "question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["qbank_id", "id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          is_technical: boolean
          message: string
          qbank_id: number | null
          question_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_technical?: boolean
          message: string
          qbank_id?: number | null
          question_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_technical?: boolean
          message?: string
          qbank_id?: number | null
          question_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          color: string
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          new_card_order: string
          new_cards_per_day: number
          reviews_per_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          new_card_order?: string
          new_cards_per_day?: number
          reviews_per_day?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          new_card_order?: string
          new_cards_per_day?: number
          reviews_per_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          card_id: string
          deck_id: string | null
          id: string
          rating: string
          reviewed_at: string
          time_ms: number
          user_id: string
        }
        Insert: {
          card_id: string
          deck_id?: string | null
          id?: string
          rating: string
          reviewed_at?: string
          time_ms?: number
          user_id: string
        }
        Update: {
          card_id?: string
          deck_id?: string | null
          id?: string
          rating?: string
          reviewed_at?: string
          time_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_reviews_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          back_html: string | null
          back_image: string | null
          created_at: string
          deck_id: string | null
          due_at: string | null
          ease: number
          front: string
          front_html: string | null
          front_image: string | null
          id: string
          interval_days: number
          lapses: number
          last_reviewed_at: string | null
          qbank_id: number | null
          question_id: number | null
          reps: number
          state: string
          tags: string[]
          time_spent_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          back?: string
          back_html?: string | null
          back_image?: string | null
          created_at?: string
          deck_id?: string | null
          due_at?: string | null
          ease?: number
          front: string
          front_html?: string | null
          front_image?: string | null
          id?: string
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          qbank_id?: number | null
          question_id?: number | null
          reps?: number
          state?: string
          tags?: string[]
          time_spent_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          back_html?: string | null
          back_image?: string | null
          created_at?: string
          deck_id?: string | null
          due_at?: string | null
          ease?: number
          front?: string
          front_html?: string | null
          front_image?: string | null
          id?: string
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          qbank_id?: number | null
          question_id?: number | null
          reps?: number
          state?: string
          tags?: string[]
          time_spent_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
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
      qbank_media: {
        Row: {
          created_at: string
          drive_file_id: string
          name: string
          qbank_id: number
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          drive_file_id: string
          name: string
          qbank_id: number
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string
          name?: string
          qbank_id?: number
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qbank_media_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
        ]
      }
      qbank_resets: {
        Row: {
          id: string
          qbank_id: number
          reset_at: string
          user_id: string
        }
        Insert: {
          id?: string
          qbank_id: number
          reset_at?: string
          user_id: string
        }
        Update: {
          id?: string
          qbank_id?: number
          reset_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qbanks: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      question_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          qbank_id: number | null
          question_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          qbank_id?: number | null
          question_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          qbank_id?: number | null
          question_id?: number
          updated_at?: string
          user_id?: string
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
          qbank_id: number
          question: string
          question_format_type: number | null
          question_type: number | null
          source: string
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
          qbank_id: number
          question: string
          question_format_type?: number | null
          question_type?: number | null
          source?: string
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
          qbank_id?: number
          question?: string
          question_format_type?: number | null
          question_type?: number | null
          source?: string
          subject_id?: number | null
          system_id?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
        ]
      }
      refs: {
        Row: {
          id: number
          qbank_id: number
          question_id: number
          ref_link: string | null
          ref_title: string | null
          ref_type: number | null
        }
        Insert: {
          id: number
          qbank_id: number
          question_id: number
          ref_link?: string | null
          ref_title?: string | null
          ref_type?: number | null
        }
        Update: {
          id?: number
          qbank_id?: number
          question_id?: number
          ref_link?: string | null
          ref_title?: string | null
          ref_type?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "refs_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refs_question_fkey"
            columns: ["qbank_id", "question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["qbank_id", "id"]
          },
        ]
      }
      subjects: {
        Row: {
          count: number | null
          id: number
          name: string
          qbank_id: number
        }
        Insert: {
          count?: number | null
          id: number
          name: string
          qbank_id: number
        }
        Update: {
          count?: number | null
          id?: number
          name?: string
          qbank_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          count: number | null
          id: number
          name: string
          qbank_id: number
        }
        Insert: {
          count?: number | null
          id: number
          name: string
          qbank_id: number
        }
        Update: {
          count?: number | null
          id?: number
          name?: string
          qbank_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "systems_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string
          current_index: number
          done: boolean
          id: number
          mode: string
          name: string | null
          qbank_id: number
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
          name?: string | null
          qbank_id: number
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
          name?: string | null
          qbank_id?: number
          question_ids?: number[]
          right_count?: number
          subject_label?: string | null
          system_label?: string | null
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tests_qbank_id_fkey"
            columns: ["qbank_id"]
            isOneToOne: false
            referencedRelation: "qbanks"
            referencedColumns: ["id"]
          },
        ]
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

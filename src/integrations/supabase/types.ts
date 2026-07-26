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
      internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      library_docs: {
        Row: {
          created_at: string
          html: string
          id: number
          path: string | null
          plain: string | null
          qbank_id: number
          title: string
        }
        Insert: {
          created_at?: string
          html: string
          id: number
          path?: string | null
          plain?: string | null
          qbank_id?: number
          title: string
        }
        Update: {
          created_at?: string
          html?: string
          id?: number
          path?: string | null
          plain?: string | null
          qbank_id?: number
          title?: string
        }
        Relationships: []
      }
      library_toc: {
        Row: {
          doc_id: number | null
          id: number
          leaf: number | null
          name: string
          parent_id: number | null
          qbank_id: number
          section: string | null
        }
        Insert: {
          doc_id?: number | null
          id: number
          leaf?: number | null
          name: string
          parent_id?: number | null
          qbank_id?: number
          section?: string | null
        }
        Update: {
          doc_id?: number | null
          id?: number
          leaf?: number | null
          name?: string
          parent_id?: number | null
          qbank_id?: number
          section?: string | null
        }
        Relationships: []
      }
      login_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      media_backup_log: {
        Row: {
          bucket: string
          drive_file_id: string | null
          id: number
          name: string
          size: number | null
          uploaded_at: string
        }
        Insert: {
          bucket: string
          drive_file_id?: string | null
          id?: number
          name: string
          size?: number | null
          uploaded_at?: string
        }
        Update: {
          bucket?: string
          drive_file_id?: string | null
          id?: number
          name?: string
          size?: number | null
          uploaded_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          medical_school: string | null
          mfa_verified_until: string | null
          selected_qbanks: string[] | null
          target_date: string | null
          target_exam: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          medical_school?: string | null
          mfa_verified_until?: string | null
          selected_qbanks?: string[] | null
          target_date?: string | null
          target_exam?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          medical_school?: string | null
          mfa_verified_until?: string | null
          selected_qbanks?: string[] | null
          target_date?: string | null
          target_exam?: string | null
        }
        Relationships: []
      }
      qbank_media: {
        Row: {
          created_at: string
          drive_file_id: string
          name: string
          plain_url: string | null
          plain_url_expires_at: string | null
          qbank_id: number
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          drive_file_id: string
          name: string
          plain_url?: string | null
          plain_url_expires_at?: string | null
          qbank_id: number
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string
          name?: string
          plain_url?: string | null
          plain_url_expires_at?: string | null
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
          study_plan_index: number | null
          subject_label: string | null
          system_label: string | null
          timed: boolean
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
          study_plan_index?: number | null
          subject_label?: string | null
          system_label?: string | null
          timed?: boolean
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
          study_plan_index?: number | null
          subject_label?: string | null
          system_label?: string | null
          timed?: boolean
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
      user_entitlements: {
        Row: {
          paid_until: string | null
          plan: string
          qbank_access: string[]
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          paid_until?: string | null
          plan?: string
          qbank_access?: string[]
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          paid_until?: string | null
          plan?: string
          qbank_access?: string[]
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      effective_qbank_access: { Args: { _user_id: string }; Returns: string[] }
      export_auth_snapshot: {
        Args: { p_limit?: number; p_offset?: number; p_table: string }
        Returns: Json
      }
      has_qbank_access: {
        Args: { _qbank_id: number; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_media_objects: {
        Args: { _bucket: string; _limit?: number }
        Returns: {
          name: string
          size: number
        }[]
      }
      media_backup_progress: {
        Args: never
        Returns: {
          backed_up: number
          bucket: string
          total: number
        }[]
      }
      pick_question_ids: {
        Args: {
          p_count?: number
          p_qbank_id: number
          p_scope?: string
          p_sources?: string[]
          p_subject_ids?: number[]
          p_system_ids?: number[]
          p_topic_names?: string[]
        }
        Returns: number[]
      }
      pool_count: {
        Args: {
          p_qbank_id: number
          p_scope?: string
          p_sources?: string[]
          p_subject_ids?: number[]
          p_system_ids?: number[]
          p_topic_names?: string[]
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

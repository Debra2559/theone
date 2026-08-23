export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      counselor_messages: {
        Row: {
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          thread_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role: string;
          thread_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "counselor_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "counselor_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      counselor_threads: {
        Row: {
          context_type: string;
          created_at: string;
          id: string;
          match_id: string | null;
          situation: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          context_type?: string;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          situation?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          context_type?: string;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          situation?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "counselor_threads_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          created_at: string;
          highlights: Json;
          id: string;
          matched_user_id: string | null;
          persona_id: string | null;
          relationship_manual: Json | null;
          score: number;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          highlights?: Json;
          id?: string;
          matched_user_id?: string | null;
          persona_id?: string | null;
          relationship_manual?: Json | null;
          score?: number;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          highlights?: Json;
          id?: string;
          matched_user_id?: string | null;
          persona_id?: string | null;
          relationship_manual?: Json | null;
          score?: number;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "personas";
            referencedColumns: ["id"];
          },
        ];
      };
      personas: {
        Row: {
          age: number;
          avatar: string;
          city: string;
          created_at: string;
          gender: string;
          id: string;
          manual: Json;
          nickname: string;
          tagline: string;
          tags: Json;
        };
        Insert: {
          age: number;
          avatar: string;
          city: string;
          created_at?: string;
          gender: string;
          id?: string;
          manual?: Json;
          nickname: string;
          tagline?: string;
          tags?: Json;
        };
        Update: {
          age?: number;
          avatar?: string;
          city?: string;
          created_at?: string;
          gender?: string;
          id?: string;
          manual?: Json;
          nickname?: string;
          tagline?: string;
          tags?: Json;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar: string;
          bio: string;
          birth_date: string | null;
          birth_time: string;
          city: string;
          created_at: string;
          gender: string;
          id: string;
          nickname: string;
          onboarding_done: boolean;
          updated_at: string;
        };
        Insert: {
          avatar?: string;
          bio?: string;
          birth_date?: string | null;
          birth_time?: string;
          city?: string;
          created_at?: string;
          gender?: string;
          id: string;
          nickname?: string;
          onboarding_done?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar?: string;
          bio?: string;
          birth_date?: string | null;
          birth_time?: string;
          city?: string;
          created_at?: string;
          gender?: string;
          id?: string;
          nickname?: string;
          onboarding_done?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      relationship_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          id: string;
          invitee_user_id: string | null;
          inviter_user_id: string;
          inviter_avatar: string;
          inviter_nickname: string;
          match_id: string | null;
          status: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invitee_user_id?: string | null;
          inviter_user_id: string;
          inviter_avatar?: string;
          inviter_nickname?: string;
          match_id?: string | null;
          status?: string;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invitee_user_id?: string | null;
          inviter_user_id?: string;
          inviter_avatar?: string;
          inviter_nickname?: string;
          match_id?: string | null;
          status?: string;
          token?: string;
        };
        Relationships: [];
      };
      test_results: {
        Row: {
          answers: Json;
          created_at: string;
          id: string;
          result: Json;
          test_id: string;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          created_at?: string;
          id?: string;
          result?: Json;
          test_id: string;
          user_id: string;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          id?: string;
          result?: Json;
          test_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_manuals: {
        Row: {
          content: Json;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

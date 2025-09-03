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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      benutzer: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nachname: string | null
          passwort_hash: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          updated_at: string | null
          vorname: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          nachname?: string | null
          passwort_hash?: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          updated_at?: string | null
          vorname?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nachname?: string | null
          passwort_hash?: string | null
          rolle?: Database["public"]["Enums"]["user_rolle"]
          updated_at?: string | null
          vorname?: string | null
        }
        Relationships: []
      }
      kunden: {
        Row: {
          aktiv: boolean | null
          created_at: string | null
          email: string | null
          id: string
          nachname: string
          notfall_name: string | null
          notfall_telefon: string | null
          telefon: string | null
          updated_at: string | null
          vorname: string
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          nachname: string
          notfall_name?: string | null
          notfall_telefon?: string | null
          telefon?: string | null
          updated_at?: string | null
          vorname: string
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          nachname?: string
          notfall_name?: string | null
          notfall_telefon?: string | null
          telefon?: string | null
          updated_at?: string | null
          vorname?: string
        }
        Relationships: []
      }
      kunden_zeitfenster: {
        Row: {
          bis: string
          id: string
          kunden_id: string
          prioritaet: number
          von: string
          wochentag: number
        }
        Insert: {
          bis: string
          id?: string
          kunden_id: string
          prioritaet?: number
          von: string
          wochentag: number
        }
        Update: {
          bis?: string
          id?: string
          kunden_id?: string
          prioritaet?: number
          von?: string
          wochentag?: number
        }
        Relationships: [
          {
            foreignKeyName: "kunden_zeitfenster_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
        ]
      }
      mitarbeiter: {
        Row: {
          benutzer_id: string | null
          created_at: string | null
          email: string | null
          id: string
          ist_aktiv: boolean | null
          max_termine_pro_tag: number | null
          nachname: string
          soll_wochenstunden: number | null
          telefon: string | null
          updated_at: string | null
          vorname: string
        }
        Insert: {
          benutzer_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ist_aktiv?: boolean | null
          max_termine_pro_tag?: number | null
          nachname: string
          soll_wochenstunden?: number | null
          telefon?: string | null
          updated_at?: string | null
          vorname: string
        }
        Update: {
          benutzer_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ist_aktiv?: boolean | null
          max_termine_pro_tag?: number | null
          nachname?: string
          soll_wochenstunden?: number | null
          telefon?: string | null
          updated_at?: string | null
          vorname?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_benutzer_id_fkey"
            columns: ["benutzer_id"]
            isOneToOne: true
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
        ]
      }
      mitarbeiter_abwesenheiten: {
        Row: {
          created_at: string
          grund: string | null
          id: string
          mitarbeiter_id: string
          zeitraum: unknown
        }
        Insert: {
          created_at?: string
          grund?: string | null
          id?: string
          mitarbeiter_id: string
          zeitraum: unknown
        }
        Update: {
          created_at?: string
          grund?: string | null
          id?: string
          mitarbeiter_id?: string
          zeitraum?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_abwesenheiten_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      mitarbeiter_verfuegbarkeit: {
        Row: {
          bis: string
          id: string
          mitarbeiter_id: string
          von: string
          wochentag: number
        }
        Insert: {
          bis: string
          id?: string
          mitarbeiter_id: string
          von: string
          wochentag: number
        }
        Update: {
          bis?: string
          id?: string
          mitarbeiter_id?: string
          von?: string
          wochentag?: number
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_verfuegbarkeit_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      termine: {
        Row: {
          created_at: string | null
          end_at: string
          id: string
          kunden_id: string | null
          mitarbeiter_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["termin_status"] | null
          titel: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_at: string
          id?: string
          kunden_id?: string | null
          mitarbeiter_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["termin_status"] | null
          titel: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_at?: string
          id?: string
          kunden_id?: string | null
          mitarbeiter_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["termin_status"] | null
          titel?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "termine_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termine_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
      find_free_mitarbeiter: {
        Args: { p_end: string; p_kunden_id?: string; p_start: string }
        Returns: {
          mitarbeiter_id: string
          nachname: string
          vorname: string
        }[]
      }
      gbt_bit_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bool_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bool_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bpchar_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bytea_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_cash_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_cash_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_date_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_date_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_enum_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_enum_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float4_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float4_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_inet_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int2_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int2_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int4_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int4_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_numeric_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_oid_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_oid_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_text_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_time_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_time_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_timetz_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_ts_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_ts_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_tstz_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_uuid_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_uuid_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_var_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_var_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey_var_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey_var_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey16_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey16_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey2_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey2_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey32_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey32_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey4_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey4_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey8_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey8_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      suggest_slots_for_kunde: {
        Args: {
          p_dauer_min: number
          p_kunden_id: string
          p_step_min?: number
          p_tag: string
        }
        Returns: {
          end_at: string
          mitarbeiter_id: string
          start_at: string
        }[]
      }
    }
    Enums: {
      termin_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      user_rolle: "admin" | "manager" | "mitarbeiter"
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
      termin_status: ["scheduled", "in_progress", "completed", "cancelled"],
      user_rolle: ["admin", "manager", "mitarbeiter"],
    },
  },
} as const

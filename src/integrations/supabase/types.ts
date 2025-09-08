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
      audit_log: {
        Row: {
          actor_benutzer_id: string | null
          changed_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          operation: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          actor_benutzer_id?: string | null
          changed_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          actor_benutzer_id?: string | null
          changed_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      benutzer: {
        Row: {
          created_at: string
          email: string
          id: string
          nachname: string | null
          passwort_hash: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          updated_at: string
          vorname: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nachname?: string | null
          passwort_hash?: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          updated_at?: string
          vorname?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nachname?: string | null
          passwort_hash?: string | null
          rolle?: Database["public"]["Enums"]["user_rolle"]
          updated_at?: string
          vorname?: string | null
        }
        Relationships: []
      }
      kunden: {
        Row: {
          aktiv: boolean
          created_at: string
          email: string | null
          id: string
          nachname: string
          notfall_name: string | null
          notfall_telefon: string | null
          telefon: string | null
          updated_at: string
          vorname: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nachname: string
          notfall_name?: string | null
          notfall_telefon?: string | null
          telefon?: string | null
          updated_at?: string
          vorname: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nachname?: string
          notfall_name?: string | null
          notfall_telefon?: string | null
          telefon?: string | null
          updated_at?: string
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
          created_at: string
          email: string | null
          farbe_kalender: string | null
          id: string
          ist_aktiv: boolean
          max_termine_pro_tag: number | null
          nachname: string
          soll_wochenstunden: number | null
          telefon: string | null
          updated_at: string
          vorname: string
        }
        Insert: {
          benutzer_id?: string | null
          created_at?: string
          email?: string | null
          farbe_kalender?: string | null
          id?: string
          ist_aktiv?: boolean
          max_termine_pro_tag?: number | null
          nachname: string
          soll_wochenstunden?: number | null
          telefon?: string | null
          updated_at?: string
          vorname: string
        }
        Update: {
          benutzer_id?: string | null
          created_at?: string
          email?: string | null
          farbe_kalender?: string | null
          id?: string
          ist_aktiv?: boolean
          max_termine_pro_tag?: number | null
          nachname?: string
          soll_wochenstunden?: number | null
          telefon?: string | null
          updated_at?: string
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
      termin_aenderungen: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          created_at: string
          id: string
          new_end_at: string | null
          new_kunden_id: string | null
          new_mitarbeiter_id: string | null
          new_start_at: string | null
          old_end_at: string | null
          old_kunden_id: string | null
          old_mitarbeiter_id: string | null
          old_start_at: string | null
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          termin_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          id?: string
          new_end_at?: string | null
          new_kunden_id?: string | null
          new_mitarbeiter_id?: string | null
          new_start_at?: string | null
          old_end_at?: string | null
          old_kunden_id?: string | null
          old_mitarbeiter_id?: string | null
          old_start_at?: string | null
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          termin_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          id?: string
          new_end_at?: string | null
          new_kunden_id?: string | null
          new_mitarbeiter_id?: string | null
          new_start_at?: string | null
          old_end_at?: string | null
          old_kunden_id?: string | null
          old_mitarbeiter_id?: string | null
          old_start_at?: string | null
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          termin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "termin_aenderungen_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termin_aenderungen_termin_id_fkey"
            columns: ["termin_id"]
            isOneToOne: false
            referencedRelation: "termine"
            referencedColumns: ["id"]
          },
        ]
      }
      termin_vorlagen: {
        Row: {
          created_at: string
          dauer_minuten: number
          gueltig_bis: string | null
          gueltig_von: string
          id: string
          intervall: Database["public"]["Enums"]["recurrence_interval"]
          ist_aktiv: boolean
          kunden_id: string
          mitarbeiter_id: string
          notizen: string | null
          start_zeit: string
          titel: string
          updated_at: string
          wochentag: number
        }
        Insert: {
          created_at?: string
          dauer_minuten?: number
          gueltig_bis?: string | null
          gueltig_von?: string
          id?: string
          intervall?: Database["public"]["Enums"]["recurrence_interval"]
          ist_aktiv?: boolean
          kunden_id: string
          mitarbeiter_id: string
          notizen?: string | null
          start_zeit: string
          titel: string
          updated_at?: string
          wochentag: number
        }
        Update: {
          created_at?: string
          dauer_minuten?: number
          gueltig_bis?: string | null
          gueltig_von?: string
          id?: string
          intervall?: Database["public"]["Enums"]["recurrence_interval"]
          ist_aktiv?: boolean
          kunden_id?: string
          mitarbeiter_id?: string
          notizen?: string | null
          start_zeit?: string
          titel?: string
          updated_at?: string
          wochentag?: number
        }
        Relationships: [
          {
            foreignKeyName: "termin_vorlagen_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termin_vorlagen_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      termine: {
        Row: {
          created_at: string
          end_at: string
          id: string
          kunden_id: string
          mitarbeiter_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["termin_status"]
          titel: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          kunden_id: string
          mitarbeiter_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["termin_status"]
          titel: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          kunden_id?: string
          mitarbeiter_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["termin_status"]
          titel?: string
          updated_at?: string
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
      app_clear_context: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      app_set_context: {
        Args: { p_benutzer_id: string }
        Returns: undefined
      }
      approve_termin_change: {
        Args: { p_request_id: string }
        Returns: undefined
      }
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
          email: string
          farbe_kalender: string
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
      reject_termin_change: {
        Args: { p_reason: string; p_request_id: string }
        Returns: undefined
      }
      request_termin_change: {
        Args: {
          p_new_end: string
          p_new_kunde: string
          p_new_mitarbeiter: string
          p_new_start: string
          p_reason: string
          p_termin_id: string
        }
        Returns: string
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      recurrence_interval: "none" | "weekly" | "biweekly" | "monthly"
      termin_status:
        | "unassigned"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
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
      approval_status: ["pending", "approved", "rejected"],
      recurrence_interval: ["none", "weekly", "biweekly", "monthly"],
      termin_status: [
        "unassigned",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_rolle: ["admin", "manager", "mitarbeiter"],
    },
  },
} as const

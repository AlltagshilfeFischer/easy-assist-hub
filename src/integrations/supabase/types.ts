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
      appointments: {
        Row: {
          aktualisiert_am: string
          beschreibung: string | null
          endzeit: string
          erstellt_am: string
          id: string
          kunden_id: string
          mitarbeiter_id: string
          notizen: string | null
          private_notizen: string | null
          startzeit: string
          status: string | null
          termin_datum: string
          titel: string
        }
        Insert: {
          aktualisiert_am?: string
          beschreibung?: string | null
          endzeit: string
          erstellt_am?: string
          id?: string
          kunden_id: string
          mitarbeiter_id: string
          notizen?: string | null
          private_notizen?: string | null
          startzeit: string
          status?: string | null
          termin_datum: string
          titel: string
        }
        Update: {
          aktualisiert_am?: string
          beschreibung?: string | null
          endzeit?: string
          erstellt_am?: string
          id?: string
          kunden_id?: string
          mitarbeiter_id?: string
          notizen?: string | null
          private_notizen?: string | null
          startzeit?: string
          status?: string | null
          termin_datum?: string
          titel?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_employee_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          adresse: string | null
          aktualisiert_am: string
          betriebstage: string[] | null
          betriebszeiten_ende: string | null
          betriebszeiten_start: string | null
          email: string | null
          erstellt_am: string
          geburtsdatum: string | null
          id: string
          kapazitaet_pro_tag: number | null
          nachname: string
          notfallkontakt_name: string | null
          notfallkontakt_telefon: string | null
          notizen: string | null
          telefon: string | null
          vorname: string
        }
        Insert: {
          adresse?: string | null
          aktualisiert_am?: string
          betriebstage?: string[] | null
          betriebszeiten_ende?: string | null
          betriebszeiten_start?: string | null
          email?: string | null
          erstellt_am?: string
          geburtsdatum?: string | null
          id?: string
          kapazitaet_pro_tag?: number | null
          nachname: string
          notfallkontakt_name?: string | null
          notfallkontakt_telefon?: string | null
          notizen?: string | null
          telefon?: string | null
          vorname: string
        }
        Update: {
          adresse?: string | null
          aktualisiert_am?: string
          betriebstage?: string[] | null
          betriebszeiten_ende?: string | null
          betriebszeiten_start?: string | null
          email?: string | null
          erstellt_am?: string
          geburtsdatum?: string | null
          id?: string
          kapazitaet_pro_tag?: number | null
          nachname?: string
          notfallkontakt_name?: string | null
          notfallkontakt_telefon?: string | null
          notizen?: string | null
          telefon?: string | null
          vorname?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          aktualisiert_am: string
          arbeitstage: string[] | null
          arbeitszeiten_ende: string | null
          arbeitszeiten_start: string | null
          benutzer_id: string
          einstellungsdatum: string | null
          erstellt_am: string
          id: string
          ist_aktiv: boolean | null
          max_termine_pro_tag: number | null
          mitarbeiter_nummer: string | null
          notizen: string | null
          position: string | null
          qualifikationen: string[] | null
          stundenlohn: number | null
          urlaubstage: string[] | null
        }
        Insert: {
          aktualisiert_am?: string
          arbeitstage?: string[] | null
          arbeitszeiten_ende?: string | null
          arbeitszeiten_start?: string | null
          benutzer_id: string
          einstellungsdatum?: string | null
          erstellt_am?: string
          id?: string
          ist_aktiv?: boolean | null
          max_termine_pro_tag?: number | null
          mitarbeiter_nummer?: string | null
          notizen?: string | null
          position?: string | null
          qualifikationen?: string[] | null
          stundenlohn?: number | null
          urlaubstage?: string[] | null
        }
        Update: {
          aktualisiert_am?: string
          arbeitstage?: string[] | null
          arbeitszeiten_ende?: string | null
          arbeitszeiten_start?: string | null
          benutzer_id?: string
          einstellungsdatum?: string | null
          erstellt_am?: string
          id?: string
          ist_aktiv?: boolean | null
          max_termine_pro_tag?: number | null
          mitarbeiter_nummer?: string | null
          notizen?: string | null
          position?: string | null
          qualifikationen?: string[] | null
          stundenlohn?: number | null
          urlaubstage?: string[] | null
        }
        Relationships: []
      }
      mitarbeiter: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aktualisiert_am: string
          benutzer_id: string
          email: string | null
          erstellt_am: string
          id: string
          nachname: string | null
          telefon: string | null
          vorname: string | null
        }
        Insert: {
          aktualisiert_am?: string
          benutzer_id: string
          email?: string | null
          erstellt_am?: string
          id?: string
          nachname?: string | null
          telefon?: string | null
          vorname?: string | null
        }
        Update: {
          aktualisiert_am?: string
          benutzer_id?: string
          email?: string | null
          erstellt_am?: string
          id?: string
          nachname?: string | null
          telefon?: string | null
          vorname?: string | null
        }
        Relationships: []
      }
      schedule_templates: {
        Row: {
          aktualisiert_am: string
          endzeit: string
          erstellt_am: string
          id: string
          ist_aktiv: boolean | null
          kunden_id: string
          mitarbeiter_id: string
          startzeit: string
          wochentag: string
        }
        Insert: {
          aktualisiert_am?: string
          endzeit: string
          erstellt_am?: string
          id?: string
          ist_aktiv?: boolean | null
          kunden_id: string
          mitarbeiter_id: string
          startzeit: string
          wochentag: string
        }
        Update: {
          aktualisiert_am?: string
          endzeit?: string
          erstellt_am?: string
          id?: string
          ist_aktiv?: boolean | null
          kunden_id?: string
          mitarbeiter_id?: string
          startzeit?: string
          wochentag?: string
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

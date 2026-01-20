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
          geburtsdatum: string | null
          id: string
          nachname: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          status: Database["public"]["Enums"]["benutzer_status"]
          updated_at: string
          vorname: string | null
        }
        Insert: {
          created_at?: string
          email: string
          geburtsdatum?: string | null
          id?: string
          nachname?: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          status?: Database["public"]["Enums"]["benutzer_status"]
          updated_at?: string
          vorname?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          geburtsdatum?: string | null
          id?: string
          nachname?: string | null
          rolle?: Database["public"]["Enums"]["user_rolle"]
          status?: Database["public"]["Enums"]["benutzer_status"]
          updated_at?: string
          vorname?: string | null
        }
        Relationships: []
      }
      dokumente: {
        Row: {
          beschreibung: string | null
          created_at: string
          dateiname: string
          dateipfad: string
          groesse_bytes: number
          hochgeladen_von: string
          id: string
          kategorie: string
          kunden_id: string | null
          mime_type: string
          mitarbeiter_id: string | null
          titel: string
          updated_at: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          dateiname: string
          dateipfad: string
          groesse_bytes: number
          hochgeladen_von: string
          id?: string
          kategorie?: string
          kunden_id?: string | null
          mime_type: string
          mitarbeiter_id?: string | null
          titel: string
          updated_at?: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          dateiname?: string
          dateipfad?: string
          groesse_bytes?: number
          hochgeladen_von?: string
          id?: string
          kategorie?: string
          kunden_id?: string | null
          mime_type?: string
          mitarbeiter_id?: string | null
          titel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dokumente_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dokumente_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dokumente_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      kunden: {
        Row: {
          adresse: string | null
          aktiv: boolean
          angehoerige_ansprechpartner: string | null
          austritt: string | null
          begruendung: string | null
          column1: string | null
          created_at: string | null
          eintritt: string | null
          email: string | null
          farbe_kalender: string | null
          geburtsdatum: string | null
          id: string
          kasse_privat: string | null
          kategorie: string | null
          kopie_lw: string | null
          mitarbeiter: string | null
          nachname: string | null
          name: string | null
          notfall_name: string | null
          notfall_telefon: string | null
          pflegegrad: number | null
          pflegekasse: string | null
          plz: string | null
          sollstunden: number | null
          sonstiges: string | null
          stadt: string | null
          stadtteil: string | null
          startdatum: string | null
          status: string | null
          strasse: string | null
          stunden_kontingent_monat: number | null
          tage: string | null
          telefonnr: string | null
          updated_at: string | null
          verhinderungspflege_status: string | null
          versichertennummer: string | null
          vorname: string | null
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean
          angehoerige_ansprechpartner?: string | null
          austritt?: string | null
          begruendung?: string | null
          column1?: string | null
          created_at?: string | null
          eintritt?: string | null
          email?: string | null
          farbe_kalender?: string | null
          geburtsdatum?: string | null
          id?: string
          kasse_privat?: string | null
          kategorie?: string | null
          kopie_lw?: string | null
          mitarbeiter?: string | null
          nachname?: string | null
          name?: string | null
          notfall_name?: string | null
          notfall_telefon?: string | null
          pflegegrad?: number | null
          pflegekasse?: string | null
          plz?: string | null
          sollstunden?: number | null
          sonstiges?: string | null
          stadt?: string | null
          stadtteil?: string | null
          startdatum?: string | null
          status?: string | null
          strasse?: string | null
          stunden_kontingent_monat?: number | null
          tage?: string | null
          telefonnr?: string | null
          updated_at?: string | null
          verhinderungspflege_status?: string | null
          versichertennummer?: string | null
          vorname?: string | null
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean
          angehoerige_ansprechpartner?: string | null
          austritt?: string | null
          begruendung?: string | null
          column1?: string | null
          created_at?: string | null
          eintritt?: string | null
          email?: string | null
          farbe_kalender?: string | null
          geburtsdatum?: string | null
          id?: string
          kasse_privat?: string | null
          kategorie?: string | null
          kopie_lw?: string | null
          mitarbeiter?: string | null
          nachname?: string | null
          name?: string | null
          notfall_name?: string | null
          notfall_telefon?: string | null
          pflegegrad?: number | null
          pflegekasse?: string | null
          plz?: string | null
          sollstunden?: number | null
          sonstiges?: string | null
          stadt?: string | null
          stadtteil?: string | null
          startdatum?: string | null
          status?: string | null
          strasse?: string | null
          stunden_kontingent_monat?: number | null
          tage?: string | null
          telefonnr?: string | null
          updated_at?: string | null
          verhinderungspflege_status?: string | null
          versichertennummer?: string | null
          vorname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kunden_mitarbeiter_fkey"
            columns: ["mitarbeiter"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      kunden_zeitfenster: {
        Row: {
          bis: string | null
          id: string
          kunden_id: string
          prioritaet: number | null
          von: string | null
          wochentag: number | null
        }
        Insert: {
          bis?: string | null
          id?: string
          kunden_id: string
          prioritaet?: number | null
          von?: string | null
          wochentag?: number | null
        }
        Update: {
          bis?: string | null
          id?: string
          kunden_id?: string
          prioritaet?: number | null
          von?: string | null
          wochentag?: number | null
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
          adresse: string | null
          benutzer_id: string | null
          created_at: string
          farbe_kalender: string | null
          id: string
          ist_aktiv: boolean
          max_termine_pro_tag: number | null
          nachname: string | null
          plz: string | null
          soll_wochenstunden: number | null
          stadt: string | null
          standort: Database["public"]["Enums"]["standort"] | null
          strasse: string | null
          telefon: string | null
          updated_at: string
          vorname: string | null
          zustaendigkeitsbereich: string | null
        }
        Insert: {
          adresse?: string | null
          benutzer_id?: string | null
          created_at?: string
          farbe_kalender?: string | null
          id?: string
          ist_aktiv?: boolean
          max_termine_pro_tag?: number | null
          nachname?: string | null
          plz?: string | null
          soll_wochenstunden?: number | null
          stadt?: string | null
          standort?: Database["public"]["Enums"]["standort"] | null
          strasse?: string | null
          telefon?: string | null
          updated_at?: string
          vorname?: string | null
          zustaendigkeitsbereich?: string | null
        }
        Update: {
          adresse?: string | null
          benutzer_id?: string | null
          created_at?: string
          farbe_kalender?: string | null
          id?: string
          ist_aktiv?: boolean
          max_termine_pro_tag?: number | null
          nachname?: string | null
          plz?: string | null
          soll_wochenstunden?: number | null
          stadt?: string | null
          standort?: Database["public"]["Enums"]["standort"] | null
          strasse?: string | null
          telefon?: string | null
          updated_at?: string
          vorname?: string | null
          zustaendigkeitsbereich?: string | null
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
      pending_registrations: {
        Row: {
          created_at: string
          email: string
          id: string
          ignored: boolean
          nachname: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          vorname: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ignored?: boolean
          nachname?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          vorname?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ignored?: boolean
          nachname?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          vorname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "benutzer"
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
            foreignKeyName: "termin_aenderungen_new_kunden_id_fkey"
            columns: ["new_kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termin_aenderungen_new_mitarbeiter_id_fkey"
            columns: ["new_mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termin_aenderungen_old_kunden_id_fkey"
            columns: ["old_kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termin_aenderungen_old_mitarbeiter_id_fkey"
            columns: ["old_mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
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
          mitarbeiter_id: string | null
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
          mitarbeiter_id?: string | null
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
          mitarbeiter_id?: string | null
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
          ausnahme_grund: string | null
          created_at: string
          end_at: string
          id: string
          ist_ausnahme: boolean | null
          iststunden: number | null
          kunden_id: string
          mitarbeiter_id: string | null
          notizen: string | null
          start_at: string
          status: Database["public"]["Enums"]["termin_status"]
          titel: string
          updated_at: string
          vorlage_id: string | null
        }
        Insert: {
          ausnahme_grund?: string | null
          created_at?: string
          end_at: string
          id?: string
          ist_ausnahme?: boolean | null
          iststunden?: number | null
          kunden_id: string
          mitarbeiter_id?: string | null
          notizen?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["termin_status"]
          titel: string
          updated_at?: string
          vorlage_id?: string | null
        }
        Update: {
          ausnahme_grund?: string | null
          created_at?: string
          end_at?: string
          id?: string
          ist_ausnahme?: boolean | null
          iststunden?: number | null
          kunden_id?: string
          mitarbeiter_id?: string | null
          notizen?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["termin_status"]
          titel?: string
          updated_at?: string
          vorlage_id?: string | null
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
          {
            foreignKeyName: "termine_vorlage_id_fkey"
            columns: ["vorlage_id"]
            isOneToOne: false
            referencedRelation: "termin_vorlagen"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_clear_context: { Args: never; Returns: undefined }
      app_set_context: { Args: { p_benutzer_id: string }; Returns: undefined }
      approve_registration: {
        Args: { p_email: string; p_password: string; p_registration_id: string }
        Returns: Json
      }
      approve_termin_change: {
        Args: { p_request_id: string }
        Returns: boolean
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
      freischalte_mitarbeiter:
        | { Args: { p_email: string; p_user_id: string }; Returns: undefined }
        | {
            Args: {
              p_email: string
              p_geburtsdatum?: string
              p_nachname?: string
              p_user_id: string
              p_vorname?: string
            }
            Returns: undefined
          }
      generate_termine_from_vorlagen: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      get_pending_registration: {
        Args: { p_registration_id: string }
        Returns: {
          email: string
          nachname: string
          vorname: string
        }[]
      }
      get_unactivated_users: {
        Args: never
        Returns: {
          created_at: string
          user_email: string
          user_id: string
        }[]
      }
      get_user_rolle: { Args: { p_user_id: string }; Returns: string }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_employee_for_appointment: {
        Args: { p_termin_id: string }
        Returns: boolean
      }
      reject_registration: {
        Args: { p_reason: string; p_registration_id: string }
        Returns: Json
      }
      reject_termin_change: {
        Args: { p_reason: string; p_request_id: string }
        Returns: boolean
      }
      request_termin_change: {
        Args: {
          p_new_end?: string
          p_new_kunde?: string
          p_new_mitarbeiter?: string
          p_new_start?: string
          p_reason?: string
          p_termin_id: string
        }
        Returns: string
      }
      update_registration_status: {
        Args: { p_registration_id: string; p_reviewer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      benutzer_status: "pending" | "approved" | "rejected"
      recurrence_interval: "none" | "weekly" | "biweekly" | "monthly"
      standort: "Hannover"
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
      benutzer_status: ["pending", "approved", "rejected"],
      recurrence_interval: ["none", "weekly", "biweekly", "monthly"],
      standort: ["Hannover"],
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

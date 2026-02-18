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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abrechnungs_historie: {
        Row: {
          aktion: string
          alter_status: Database["public"]["Enums"]["rechnung_status"] | null
          created_at: string
          details: Json | null
          durchgefuehrt_am: string
          durchgefuehrt_von: string | null
          id: string
          neuer_status: Database["public"]["Enums"]["rechnung_status"] | null
          rechnung_id: string
        }
        Insert: {
          aktion: string
          alter_status?: Database["public"]["Enums"]["rechnung_status"] | null
          created_at?: string
          details?: Json | null
          durchgefuehrt_am?: string
          durchgefuehrt_von?: string | null
          id?: string
          neuer_status?: Database["public"]["Enums"]["rechnung_status"] | null
          rechnung_id: string
        }
        Update: {
          aktion?: string
          alter_status?: Database["public"]["Enums"]["rechnung_status"] | null
          created_at?: string
          details?: Json | null
          durchgefuehrt_am?: string
          durchgefuehrt_von?: string | null
          id?: string
          neuer_status?: Database["public"]["Enums"]["rechnung_status"] | null
          rechnung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abrechnungs_historie_durchgefuehrt_von_fkey"
            columns: ["durchgefuehrt_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abrechnungs_historie_rechnung_id_fkey"
            columns: ["rechnung_id"]
            isOneToOne: false
            referencedRelation: "rechnungen"
            referencedColumns: ["id"]
          },
        ]
      }
      abrechnungsregeln: {
        Row: {
          beschreibung: string | null
          created_at: string
          gueltig_bis: string | null
          gueltig_von: string
          hoechstbetrag_jahr: number | null
          hoechstbetrag_monat: number | null
          id: string
          ist_aktiv: boolean
          kostentraeger_typ: Database["public"]["Enums"]["kostentraeger_typ"]
          leistungsart: Database["public"]["Enums"]["leistungsart"]
          max_pflegegrad: number | null
          min_pflegegrad: number | null
          stundensatz: number | null
          updated_at: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          gueltig_bis?: string | null
          gueltig_von?: string
          hoechstbetrag_jahr?: number | null
          hoechstbetrag_monat?: number | null
          id?: string
          ist_aktiv?: boolean
          kostentraeger_typ: Database["public"]["Enums"]["kostentraeger_typ"]
          leistungsart: Database["public"]["Enums"]["leistungsart"]
          max_pflegegrad?: number | null
          min_pflegegrad?: number | null
          stundensatz?: number | null
          updated_at?: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          gueltig_bis?: string | null
          gueltig_von?: string
          hoechstbetrag_jahr?: number | null
          hoechstbetrag_monat?: number | null
          id?: string
          ist_aktiv?: boolean
          kostentraeger_typ?: Database["public"]["Enums"]["kostentraeger_typ"]
          leistungsart?: Database["public"]["Enums"]["leistungsart"]
          max_pflegegrad?: number | null
          min_pflegegrad?: number | null
          stundensatz?: number | null
          updated_at?: string
        }
        Relationships: []
      }
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
      einsatzorte: {
        Row: {
          bezeichnung: string | null
          created_at: string
          haushalt_id: string
          id: string
          ist_aktiv: boolean
          ist_haupteinsatzort: boolean
          plz: string | null
          stadt: string | null
          stadtteil: string | null
          strasse: string | null
          updated_at: string
          zugangsinformationen: string | null
        }
        Insert: {
          bezeichnung?: string | null
          created_at?: string
          haushalt_id: string
          id?: string
          ist_aktiv?: boolean
          ist_haupteinsatzort?: boolean
          plz?: string | null
          stadt?: string | null
          stadtteil?: string | null
          strasse?: string | null
          updated_at?: string
          zugangsinformationen?: string | null
        }
        Update: {
          bezeichnung?: string | null
          created_at?: string
          haushalt_id?: string
          id?: string
          ist_aktiv?: boolean
          ist_haupteinsatzort?: boolean
          plz?: string | null
          stadt?: string | null
          stadtteil?: string | null
          strasse?: string | null
          updated_at?: string
          zugangsinformationen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einsatzorte_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
        ]
      }
      haushalte: {
        Row: {
          angehoerige_ansprechpartner: string | null
          created_at: string
          id: string
          name: string
          notfall_name: string | null
          notfall_telefon: string | null
          rechnungsempfaenger_name: string | null
          rechnungsempfaenger_plz: string | null
          rechnungsempfaenger_stadt: string | null
          rechnungsempfaenger_strasse: string | null
          sonstiges: string | null
          updated_at: string
        }
        Insert: {
          angehoerige_ansprechpartner?: string | null
          created_at?: string
          id?: string
          name: string
          notfall_name?: string | null
          notfall_telefon?: string | null
          rechnungsempfaenger_name?: string | null
          rechnungsempfaenger_plz?: string | null
          rechnungsempfaenger_stadt?: string | null
          rechnungsempfaenger_strasse?: string | null
          sonstiges?: string | null
          updated_at?: string
        }
        Update: {
          angehoerige_ansprechpartner?: string | null
          created_at?: string
          id?: string
          name?: string
          notfall_name?: string | null
          notfall_telefon?: string | null
          rechnungsempfaenger_name?: string | null
          rechnungsempfaenger_plz?: string | null
          rechnungsempfaenger_stadt?: string | null
          rechnungsempfaenger_strasse?: string | null
          sonstiges?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kostentraeger: {
        Row: {
          abrechnungs_hinweise: string | null
          anschrift_plz: string | null
          anschrift_stadt: string | null
          anschrift_strasse: string | null
          ansprechpartner: string | null
          created_at: string
          email: string | null
          id: string
          ik_nummer: string | null
          ist_aktiv: boolean
          name: string
          telefon: string | null
          typ: Database["public"]["Enums"]["kostentraeger_typ"]
          updated_at: string
        }
        Insert: {
          abrechnungs_hinweise?: string | null
          anschrift_plz?: string | null
          anschrift_stadt?: string | null
          anschrift_strasse?: string | null
          ansprechpartner?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ik_nummer?: string | null
          ist_aktiv?: boolean
          name: string
          telefon?: string | null
          typ: Database["public"]["Enums"]["kostentraeger_typ"]
          updated_at?: string
        }
        Update: {
          abrechnungs_hinweise?: string | null
          anschrift_plz?: string | null
          anschrift_stadt?: string | null
          anschrift_strasse?: string | null
          ansprechpartner?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ik_nummer?: string | null
          ist_aktiv?: boolean
          name?: string
          telefon?: string | null
          typ?: Database["public"]["Enums"]["kostentraeger_typ"]
          updated_at?: string
        }
        Relationships: []
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
          geschlecht: string | null
          haushalt_id: string | null
          id: string
          kasse_privat: string | null
          kategorie: string | null
          kontaktweg: string | null
          kopie_lw: string | null
          kunden_nummer: number
          mitarbeiter: string | null
          nachname: string | null
          name: string | null
          notfall_name: string | null
          notfall_telefon: string | null
          pflegegrad: number | null
          pflegekasse: string | null
          plz: string | null
          rechnungskopie: string[] | null
          rechnungskopie_adresse_name: string | null
          rechnungskopie_adresse_plz: string | null
          rechnungskopie_adresse_stadt: string | null
          rechnungskopie_adresse_strasse: string | null
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
          termindauer_stunden: number | null
          terminfrequenz: string | null
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
          geschlecht?: string | null
          haushalt_id?: string | null
          id?: string
          kasse_privat?: string | null
          kategorie?: string | null
          kontaktweg?: string | null
          kopie_lw?: string | null
          kunden_nummer?: number
          mitarbeiter?: string | null
          nachname?: string | null
          name?: string | null
          notfall_name?: string | null
          notfall_telefon?: string | null
          pflegegrad?: number | null
          pflegekasse?: string | null
          plz?: string | null
          rechnungskopie?: string[] | null
          rechnungskopie_adresse_name?: string | null
          rechnungskopie_adresse_plz?: string | null
          rechnungskopie_adresse_stadt?: string | null
          rechnungskopie_adresse_strasse?: string | null
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
          termindauer_stunden?: number | null
          terminfrequenz?: string | null
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
          geschlecht?: string | null
          haushalt_id?: string | null
          id?: string
          kasse_privat?: string | null
          kategorie?: string | null
          kontaktweg?: string | null
          kopie_lw?: string | null
          kunden_nummer?: number
          mitarbeiter?: string | null
          nachname?: string | null
          name?: string | null
          notfall_name?: string | null
          notfall_telefon?: string | null
          pflegegrad?: number | null
          pflegekasse?: string | null
          plz?: string | null
          rechnungskopie?: string[] | null
          rechnungskopie_adresse_name?: string | null
          rechnungskopie_adresse_plz?: string | null
          rechnungskopie_adresse_stadt?: string | null
          rechnungskopie_adresse_strasse?: string | null
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
          termindauer_stunden?: number | null
          terminfrequenz?: string | null
          updated_at?: string | null
          verhinderungspflege_status?: string | null
          versichertennummer?: string | null
          vorname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kunden_haushalt_id_fkey"
            columns: ["haushalt_id"]
            isOneToOne: false
            referencedRelation: "haushalte"
            referencedColumns: ["id"]
          },
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
      leistungen: {
        Row: {
          art: Database["public"]["Enums"]["leistungsart"]
          beantragt_am: string | null
          beantragt_von: string | null
          beendet_am: string | null
          beendet_grund: string | null
          bemerkungen: string | null
          bewilligung_aktenzeichen: string | null
          bewilligung_datum: string | null
          bewilligung_dokument_id: string | null
          created_at: string
          genehmigt_am: string | null
          genehmigt_von: string | null
          gueltig_bis: string | null
          gueltig_von: string
          id: string
          kontingent_einheit: string | null
          kontingent_menge: number | null
          kontingent_verbraucht: number | null
          kontingent_zeitraum: string | null
          kostentraeger_id: string | null
          kunden_id: string
          pflegegrad_bei_bewilligung: number | null
          status: Database["public"]["Enums"]["leistungs_status"]
          updated_at: string
          versichertennummer: string | null
        }
        Insert: {
          art: Database["public"]["Enums"]["leistungsart"]
          beantragt_am?: string | null
          beantragt_von?: string | null
          beendet_am?: string | null
          beendet_grund?: string | null
          bemerkungen?: string | null
          bewilligung_aktenzeichen?: string | null
          bewilligung_datum?: string | null
          bewilligung_dokument_id?: string | null
          created_at?: string
          genehmigt_am?: string | null
          genehmigt_von?: string | null
          gueltig_bis?: string | null
          gueltig_von: string
          id?: string
          kontingent_einheit?: string | null
          kontingent_menge?: number | null
          kontingent_verbraucht?: number | null
          kontingent_zeitraum?: string | null
          kostentraeger_id?: string | null
          kunden_id: string
          pflegegrad_bei_bewilligung?: number | null
          status?: Database["public"]["Enums"]["leistungs_status"]
          updated_at?: string
          versichertennummer?: string | null
        }
        Update: {
          art?: Database["public"]["Enums"]["leistungsart"]
          beantragt_am?: string | null
          beantragt_von?: string | null
          beendet_am?: string | null
          beendet_grund?: string | null
          bemerkungen?: string | null
          bewilligung_aktenzeichen?: string | null
          bewilligung_datum?: string | null
          bewilligung_dokument_id?: string | null
          created_at?: string
          genehmigt_am?: string | null
          genehmigt_von?: string | null
          gueltig_bis?: string | null
          gueltig_von?: string
          id?: string
          kontingent_einheit?: string | null
          kontingent_menge?: number | null
          kontingent_verbraucht?: number | null
          kontingent_zeitraum?: string | null
          kostentraeger_id?: string | null
          kunden_id?: string
          pflegegrad_bei_bewilligung?: number | null
          status?: Database["public"]["Enums"]["leistungs_status"]
          updated_at?: string
          versichertennummer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leistungen_beantragt_von_fkey"
            columns: ["beantragt_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungen_bewilligung_dokument_id_fkey"
            columns: ["bewilligung_dokument_id"]
            isOneToOne: false
            referencedRelation: "dokumente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungen_genehmigt_von_fkey"
            columns: ["genehmigt_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungen_kostentraeger_id_fkey"
            columns: ["kostentraeger_id"]
            isOneToOne: false
            referencedRelation: "kostentraeger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungen_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
        ]
      }
      leistungs_status_historie: {
        Row: {
          alter_status: Database["public"]["Enums"]["leistungs_status"] | null
          geaendert_am: string
          geaendert_von: string | null
          grund: string | null
          id: string
          leistung_id: string
          neuer_status: Database["public"]["Enums"]["leistungs_status"]
          zusatz_daten: Json | null
        }
        Insert: {
          alter_status?: Database["public"]["Enums"]["leistungs_status"] | null
          geaendert_am?: string
          geaendert_von?: string | null
          grund?: string | null
          id?: string
          leistung_id: string
          neuer_status: Database["public"]["Enums"]["leistungs_status"]
          zusatz_daten?: Json | null
        }
        Update: {
          alter_status?: Database["public"]["Enums"]["leistungs_status"] | null
          geaendert_am?: string
          geaendert_von?: string | null
          grund?: string | null
          id?: string
          leistung_id?: string
          neuer_status?: Database["public"]["Enums"]["leistungs_status"]
          zusatz_daten?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "leistungs_status_historie_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungs_status_historie_leistung_id_fkey"
            columns: ["leistung_id"]
            isOneToOne: false
            referencedRelation: "leistungen"
            referencedColumns: ["id"]
          },
        ]
      }
      leistungsnachweise: {
        Row: {
          abweichende_rechnungsadresse: boolean
          created_at: string
          geleistete_stunden: number
          geplante_stunden: number
          id: string
          ist_privat: boolean
          jahr: number
          kostentraeger_id: string | null
          kunden_id: string
          monat: number
          privat_empfaenger_name: string | null
          rechnungsadresse_name: string | null
          rechnungsadresse_plz: string | null
          rechnungsadresse_stadt: string | null
          rechnungsadresse_strasse: string | null
          status: string
          unterschrift_gf_name: string | null
          unterschrift_gf_template: string | null
          unterschrift_kunde_bild: string | null
          unterschrift_kunde_durch: string | null
          unterschrift_kunde_zeitstempel: string | null
          updated_at: string
        }
        Insert: {
          abweichende_rechnungsadresse?: boolean
          created_at?: string
          geleistete_stunden?: number
          geplante_stunden?: number
          id?: string
          ist_privat?: boolean
          jahr: number
          kostentraeger_id?: string | null
          kunden_id: string
          monat: number
          privat_empfaenger_name?: string | null
          rechnungsadresse_name?: string | null
          rechnungsadresse_plz?: string | null
          rechnungsadresse_stadt?: string | null
          rechnungsadresse_strasse?: string | null
          status?: string
          unterschrift_gf_name?: string | null
          unterschrift_gf_template?: string | null
          unterschrift_kunde_bild?: string | null
          unterschrift_kunde_durch?: string | null
          unterschrift_kunde_zeitstempel?: string | null
          updated_at?: string
        }
        Update: {
          abweichende_rechnungsadresse?: boolean
          created_at?: string
          geleistete_stunden?: number
          geplante_stunden?: number
          id?: string
          ist_privat?: boolean
          jahr?: number
          kostentraeger_id?: string | null
          kunden_id?: string
          monat?: number
          privat_empfaenger_name?: string | null
          rechnungsadresse_name?: string | null
          rechnungsadresse_plz?: string | null
          rechnungsadresse_stadt?: string | null
          rechnungsadresse_strasse?: string | null
          status?: string
          unterschrift_gf_name?: string | null
          unterschrift_gf_template?: string | null
          unterschrift_kunde_bild?: string | null
          unterschrift_kunde_durch?: string | null
          unterschrift_kunde_zeitstempel?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leistungsnachweise_kostentraeger_id_fkey"
            columns: ["kostentraeger_id"]
            isOneToOne: false
            referencedRelation: "kostentraeger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leistungsnachweise_kunden_id_fkey"
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
          avatar_url: string | null
          benutzer_id: string | null
          created_at: string
          employment_type: string | null
          farbe_kalender: string | null
          hourly_rate: number | null
          id: string
          is_bookable: boolean
          ist_aktiv: boolean
          max_termine_pro_tag: number | null
          nachname: string | null
          plz: string | null
          qualification: string | null
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
          avatar_url?: string | null
          benutzer_id?: string | null
          created_at?: string
          employment_type?: string | null
          farbe_kalender?: string | null
          hourly_rate?: number | null
          id?: string
          is_bookable?: boolean
          ist_aktiv?: boolean
          max_termine_pro_tag?: number | null
          nachname?: string | null
          plz?: string | null
          qualification?: string | null
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
          avatar_url?: string | null
          benutzer_id?: string | null
          created_at?: string
          employment_type?: string | null
          farbe_kalender?: string | null
          hourly_rate?: number | null
          id?: string
          is_bookable?: boolean
          ist_aktiv?: boolean
          max_termine_pro_tag?: number | null
          nachname?: string | null
          plz?: string | null
          qualification?: string | null
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
          approved_at: string | null
          approved_by: string | null
          bis: string | null
          created_at: string
          grund: string | null
          id: string
          mitarbeiter_id: string
          requested_by: string | null
          status: string
          typ: string
          von: string | null
          zeitraum: unknown
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bis?: string | null
          created_at?: string
          grund?: string | null
          id?: string
          mitarbeiter_id: string
          requested_by?: string | null
          status?: string
          typ?: string
          von?: string | null
          zeitraum: unknown
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bis?: string | null
          created_at?: string
          grund?: string | null
          id?: string
          mitarbeiter_id?: string
          requested_by?: string | null
          status?: string
          typ?: string
          von?: string | null
          zeitraum?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_abwesenheiten_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mitarbeiter_abwesenheiten_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mitarbeiter_abwesenheiten_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "benutzer"
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
      notfallkontakte: {
        Row: {
          bezug: string | null
          created_at: string
          id: string
          kunden_id: string
          name: string
          telefon: string
        }
        Insert: {
          bezug?: string | null
          created_at?: string
          id?: string
          kunden_id: string
          name: string
          telefon: string
        }
        Update: {
          bezug?: string | null
          created_at?: string
          id?: string
          kunden_id?: string
          name?: string
          telefon?: string
        }
        Relationships: [
          {
            foreignKeyName: "notfallkontakte_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
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
      permissions: {
        Row: {
          beschreibung: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      rechnungen: {
        Row: {
          abrechnungszeitraum_bis: string
          abrechnungszeitraum_von: string
          bezahlt_am: string | null
          brutto_betrag: number
          created_at: string
          empfaenger_adresse: string | null
          empfaenger_name: string
          erstellt_von: string | null
          freigegeben_am: string | null
          freigegeben_von: string | null
          id: string
          kostentraeger_id: string | null
          mwst_betrag: number
          mwst_satz: number
          netto_betrag: number
          privat_kunde_id: string | null
          rechnungsnummer: string
          status: Database["public"]["Enums"]["rechnung_status"]
          updated_at: string
          validierung_ergebnis: Json | null
          validierung_warnungen: Json | null
          versendet_am: string | null
        }
        Insert: {
          abrechnungszeitraum_bis: string
          abrechnungszeitraum_von: string
          bezahlt_am?: string | null
          brutto_betrag?: number
          created_at?: string
          empfaenger_adresse?: string | null
          empfaenger_name: string
          erstellt_von?: string | null
          freigegeben_am?: string | null
          freigegeben_von?: string | null
          id?: string
          kostentraeger_id?: string | null
          mwst_betrag?: number
          mwst_satz?: number
          netto_betrag?: number
          privat_kunde_id?: string | null
          rechnungsnummer: string
          status?: Database["public"]["Enums"]["rechnung_status"]
          updated_at?: string
          validierung_ergebnis?: Json | null
          validierung_warnungen?: Json | null
          versendet_am?: string | null
        }
        Update: {
          abrechnungszeitraum_bis?: string
          abrechnungszeitraum_von?: string
          bezahlt_am?: string | null
          brutto_betrag?: number
          created_at?: string
          empfaenger_adresse?: string | null
          empfaenger_name?: string
          erstellt_von?: string | null
          freigegeben_am?: string | null
          freigegeben_von?: string | null
          id?: string
          kostentraeger_id?: string | null
          mwst_betrag?: number
          mwst_satz?: number
          netto_betrag?: number
          privat_kunde_id?: string | null
          rechnungsnummer?: string
          status?: Database["public"]["Enums"]["rechnung_status"]
          updated_at?: string
          validierung_ergebnis?: Json | null
          validierung_warnungen?: Json | null
          versendet_am?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rechnungen_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungen_freigegeben_von_fkey"
            columns: ["freigegeben_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungen_kostentraeger_id_fkey"
            columns: ["kostentraeger_id"]
            isOneToOne: false
            referencedRelation: "kostentraeger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungen_privat_kunde_id_fkey"
            columns: ["privat_kunde_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnungspositionen: {
        Row: {
          created_at: string
          einzelbetrag: number
          id: string
          ist_gueltig: boolean
          kunden_id: string
          leistung_id: string | null
          leistungsart: string
          leistungsbeginn: string
          leistungsdatum: string
          leistungsende: string
          mitarbeiter_id: string | null
          rechnung_id: string
          stunden: number
          stundensatz: number
          termin_id: string
          validierung_hinweise: Json | null
        }
        Insert: {
          created_at?: string
          einzelbetrag?: number
          id?: string
          ist_gueltig?: boolean
          kunden_id: string
          leistung_id?: string | null
          leistungsart: string
          leistungsbeginn: string
          leistungsdatum: string
          leistungsende: string
          mitarbeiter_id?: string | null
          rechnung_id: string
          stunden: number
          stundensatz?: number
          termin_id: string
          validierung_hinweise?: Json | null
        }
        Update: {
          created_at?: string
          einzelbetrag?: number
          id?: string
          ist_gueltig?: boolean
          kunden_id?: string
          leistung_id?: string | null
          leistungsart?: string
          leistungsbeginn?: string
          leistungsdatum?: string
          leistungsende?: string
          mitarbeiter_id?: string | null
          rechnung_id?: string
          stunden?: number
          stundensatz?: number
          termin_id?: string
          validierung_hinweise?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rechnungspositionen_kunden_id_fkey"
            columns: ["kunden_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungspositionen_leistung_id_fkey"
            columns: ["leistung_id"]
            isOneToOne: false
            referencedRelation: "leistungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungspositionen_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungspositionen_rechnung_id_fkey"
            columns: ["rechnung_id"]
            isOneToOne: false
            referencedRelation: "rechnungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungspositionen_termin_id_fkey"
            columns: ["termin_id"]
            isOneToOne: false
            referencedRelation: "termine"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
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
          einsatzort_id: string | null
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
          einsatzort_id?: string | null
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
          einsatzort_id?: string | null
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
            foreignKeyName: "termine_einsatzort_id_fkey"
            columns: ["einsatzort_id"]
            isOneToOne: false
            referencedRelation: "einsatzorte"
            referencedColumns: ["id"]
          },
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
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_benutzer_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "benutzer"
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
      approve_termin_change: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      can_delete: { Args: { _user_id: string }; Returns: boolean }
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
      freischalte_mitarbeiter: {
        Args: {
          p_email: string
          p_geburtsdatum?: string
          p_nachname?: string
          p_user_id: string
          p_vorname?: string
        }
        Returns: undefined
      }
      generate_rechnungsnummer: { Args: never; Returns: string }
      generate_termine_from_vorlagen: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      get_unactivated_users: {
        Args: never
        Returns: {
          created_at: string
          user_email: string
          user_id: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_rolle: { Args: { p_user_id: string }; Returns: string }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_higher: { Args: { _user_id: string }; Returns: boolean }
      is_admin_secure: { Args: { _user_id: string }; Returns: boolean }
      is_authenticated_employee: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_buchhaltung: { Args: { _user_id: string }; Returns: boolean }
      is_employee_for_appointment: {
        Args: { p_termin_id: string }
        Returns: boolean
      }
      is_geschaeftsfuehrer: { Args: { _user_id: string }; Returns: boolean }
      is_globaladmin: { Args: { _user_id: string }; Returns: boolean }
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
    }
    Enums: {
      app_role:
        | "geschaeftsfuehrer"
        | "admin"
        | "mitarbeiter"
        | "buchhaltung"
        | "globaladmin"
      approval_status: "pending" | "approved" | "rejected"
      benutzer_status: "pending" | "approved" | "rejected"
      kostentraeger_typ:
        | "pflegekasse"
        | "krankenkasse"
        | "kommune"
        | "privat"
        | "beihilfe"
      leistungs_status:
        | "beantragt"
        | "genehmigt"
        | "aktiv"
        | "pausiert"
        | "beendet"
      leistungsart:
        | "entlastungsleistung"
        | "verhinderungspflege"
        | "kurzzeitpflege"
        | "pflegesachleistung"
        | "privat"
        | "sonstige"
      rechnung_status:
        | "entwurf"
        | "freigegeben"
        | "versendet"
        | "bezahlt"
        | "storniert"
      recurrence_interval: "none" | "weekly" | "biweekly" | "monthly"
      standort: "Hannover"
      termin_status:
        | "unassigned"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "abgerechnet"
        | "bezahlt"
        | "nicht_angetroffen"
        | "abgesagt_rechtzeitig"
      user_rolle:
        | "geschaeftsfuehrer"
        | "admin"
        | "mitarbeiter"
        | "buchhaltung"
        | "globaladmin"
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
      app_role: [
        "geschaeftsfuehrer",
        "admin",
        "mitarbeiter",
        "buchhaltung",
        "globaladmin",
      ],
      approval_status: ["pending", "approved", "rejected"],
      benutzer_status: ["pending", "approved", "rejected"],
      kostentraeger_typ: [
        "pflegekasse",
        "krankenkasse",
        "kommune",
        "privat",
        "beihilfe",
      ],
      leistungs_status: [
        "beantragt",
        "genehmigt",
        "aktiv",
        "pausiert",
        "beendet",
      ],
      leistungsart: [
        "entlastungsleistung",
        "verhinderungspflege",
        "kurzzeitpflege",
        "pflegesachleistung",
        "privat",
        "sonstige",
      ],
      rechnung_status: [
        "entwurf",
        "freigegeben",
        "versendet",
        "bezahlt",
        "storniert",
      ],
      recurrence_interval: ["none", "weekly", "biweekly", "monthly"],
      standort: ["Hannover"],
      termin_status: [
        "unassigned",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "abgerechnet",
        "bezahlt",
        "nicht_angetroffen",
        "abgesagt_rechtzeitig",
      ],
      user_rolle: [
        "geschaeftsfuehrer",
        "admin",
        "mitarbeiter",
        "buchhaltung",
        "globaladmin",
      ],
    },
  },
} as const

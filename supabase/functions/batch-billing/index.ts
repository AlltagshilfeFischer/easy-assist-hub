import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BillingRequest {
  zeitraum_von: string;
  zeitraum_bis: string;
  kostentraeger_id?: string;
  kunden_ids?: string[];
  dry_run?: boolean; // Validieren ohne zu speichern
}

interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

interface TerminForBilling {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  iststunden: number;
  status: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  kunden: {
    id: string;
    vorname: string;
    nachname: string;
    pflegegrad: number | null;
  };
  mitarbeiter: {
    id: string;
    vorname: string;
    nachname: string;
  } | null;
}

interface Leistung {
  id: string;
  kunden_id: string;
  art: string;
  status: string;
  gueltig_von: string;
  gueltig_bis: string | null;
  kontingent_menge: number | null;
  kontingent_verbraucht: number | null;
  kontingent_einheit: string | null;
  kostentraeger_id: string | null;
  kostentraeger?: {
    id: string;
    name: string;
    typ: string;
  } | null;
}

interface Abrechnungsregel {
  id: string;
  kostentraeger_typ: string;
  leistungsart: string;
  min_pflegegrad: number | null;
  max_pflegegrad: number | null;
  stundensatz: number | null;
  hoechstbetrag_monat: number | null;
  hoechstbetrag_jahr: number | null;
  gueltig_von: string;
  gueltig_bis: string | null;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: BillingRequest = await req.json();
    const { zeitraum_von, zeitraum_bis, kostentraeger_id, kunden_ids, dry_run = false } = body;

    if (!zeitraum_von || !zeitraum_bis) {
      return new Response(
        JSON.stringify({ error: "zeitraum_von and zeitraum_bis are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch completed termine for the period that haven't been billed yet
    let termineQuery = supabase
      .from("termine")
      .select(`
        id, titel, start_at, end_at, iststunden, status, kunden_id, mitarbeiter_id,
        kunden:kunden_id (id, vorname, nachname, pflegegrad),
        mitarbeiter:mitarbeiter_id (id, vorname, nachname)
      `)
      .eq("status", "completed")
      .gte("start_at", zeitraum_von)
      .lte("start_at", zeitraum_bis);

    if (kunden_ids && kunden_ids.length > 0) {
      termineQuery = termineQuery.in("kunden_id", kunden_ids);
    }

    const { data: termine, error: termineError } = await termineQuery;

    if (termineError) {
      throw new Error(`Failed to fetch termine: ${termineError.message}`);
    }

    if (!termine || termine.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Keine abrechenbaren Termine im Zeitraum gefunden",
          rechnungen: [],
          validierung: { is_valid: true, errors: [], warnings: [] }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch active leistungen for these customers
    const kundenIdsFromTermine = [...new Set(termine.map((t: any) => t.kunden_id))];
    
    const { data: leistungen, error: leistungenError } = await supabase
      .from("leistungen")
      .select(`
        id, kunden_id, art, status, gueltig_von, gueltig_bis, 
        kontingent_menge, kontingent_verbraucht, kontingent_einheit,
        kostentraeger_id,
        kostentraeger:kostentraeger_id (id, name, typ)
      `)
      .in("kunden_id", kundenIdsFromTermine)
      .eq("status", "aktiv");

    if (leistungenError) {
      throw new Error(`Failed to fetch leistungen: ${leistungenError.message}`);
    }

    // 3. Fetch abrechnungsregeln
    const { data: regeln, error: regelnError } = await supabase
      .from("abrechnungsregeln")
      .select("*")
      .eq("ist_aktiv", true)
      .lte("gueltig_von", zeitraum_bis)
      .or(`gueltig_bis.is.null,gueltig_bis.gte.${zeitraum_von}`);

    if (regelnError) {
      throw new Error(`Failed to fetch regeln: ${regelnError.message}`);
    }

    // 4. Group termine by Kostenträger
    const terminGruppen = new Map<string, { 
      kostentraeger: any; 
      termine: any[]; 
      leistung: any;
    }>();

    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];

    for (const termin of (termine as unknown as TerminForBilling[])) {
      const kundenLeistungen = (leistungen as any[] || []).filter(
        (l: any) => l.kunden_id === termin.kunden_id
      );

      if (kundenLeistungen.length === 0) {
        validationErrors.push(
          `Keine aktive Leistung für Kunde ${termin.kunden?.vorname} ${termin.kunden?.nachname} gefunden`
        );
        continue;
      }

      // Find matching leistung for termin date
      const terminDate = termin.start_at.split("T")[0];
      const matchingLeistung = kundenLeistungen.find((l: any) => {
        const gueltigVon = l.gueltig_von;
        const gueltigBis = l.gueltig_bis || "9999-12-31";
        return terminDate >= gueltigVon && terminDate <= gueltigBis;
      });

      if (!matchingLeistung) {
        validationErrors.push(
          `Termin am ${terminDate} für ${termin.kunden?.vorname} ${termin.kunden?.nachname} liegt außerhalb des Leistungs-Gültigkeitszeitraums`
        );
        continue;
      }

      // Validate Pflegegrad
      const kundenPflegegrad = termin.kunden?.pflegegrad;
      const matchingRegel = (regeln || []).find((r: Abrechnungsregel) => {
        if (!matchingLeistung.kostentraeger) return false;
        return r.kostentraeger_typ === (matchingLeistung as any).kostentraeger?.typ &&
               r.leistungsart === matchingLeistung.art;
      });

      if (matchingRegel) {
        const minPG = matchingRegel.min_pflegegrad;
        const maxPG = matchingRegel.max_pflegegrad;
        
        if (minPG !== null && (kundenPflegegrad === null || kundenPflegegrad < minPG)) {
          validationErrors.push(
            `Pflegegrad ${kundenPflegegrad || 'nicht gesetzt'} für ${termin.kunden?.vorname} ${termin.kunden?.nachname} unterschreitet Mindestanforderung (${minPG})`
          );
          continue;
        }
        
        if (maxPG !== null && kundenPflegegrad !== null && kundenPflegegrad > maxPG) {
          validationWarnings.push(
            `Pflegegrad ${kundenPflegegrad} für ${termin.kunden?.vorname} ${termin.kunden?.nachname} überschreitet Maximum (${maxPG})`
          );
        }
      }

      // Check Kontingent
      if (matchingLeistung.kontingent_menge !== null) {
        const verbraucht = matchingLeistung.kontingent_verbraucht || 0;
        const stunden = termin.iststunden || 0;
        
        if (verbraucht + stunden > matchingLeistung.kontingent_menge) {
          validationWarnings.push(
            `Kontingent für ${termin.kunden?.vorname} ${termin.kunden?.nachname} wird überschritten (${verbraucht + stunden}/${matchingLeistung.kontingent_menge} ${matchingLeistung.kontingent_einheit || 'Stunden'})`
          );
        }
      }

      // Group by Kostenträger
      const kostentraegerId = matchingLeistung.kostentraeger_id || `privat_${termin.kunden_id}`;
      
      if (!terminGruppen.has(kostentraegerId)) {
        terminGruppen.set(kostentraegerId, {
          kostentraeger: matchingLeistung.kostentraeger,
          termine: [],
          leistung: matchingLeistung
        });
      }
      
      terminGruppen.get(kostentraegerId)!.termine.push({
        ...termin,
        leistung: matchingLeistung,
        regel: matchingRegel
      });
    }

    // Filter by kostentraeger_id if specified
    if (kostentraeger_id) {
      for (const [key] of terminGruppen) {
        if (key !== kostentraeger_id) {
          terminGruppen.delete(key);
        }
      }
    }

    // 5. Create Rechnungen (if not dry run)
    const erstellteRechnungen: any[] = [];

    if (!dry_run && validationErrors.length === 0) {
      for (const [groupKey, group] of terminGruppen) {
        if (group.termine.length === 0) continue;

        // Generate Rechnungsnummer
        const { data: rechnungsnummer } = await supabase.rpc("generate_rechnungsnummer");

        // Calculate totals
        let nettoBetrag = 0;
        const positionen: any[] = [];

        for (const terminData of group.termine) {
          const stunden = terminData.iststunden || 
            ((new Date(terminData.end_at).getTime() - new Date(terminData.start_at).getTime()) / (1000 * 60 * 60));
          
          const stundensatz = terminData.regel?.stundensatz || 0;
          const einzelbetrag = stunden * stundensatz;
          nettoBetrag += einzelbetrag;

          positionen.push({
            termin_id: terminData.id,
            leistung_id: terminData.leistung.id,
            kunden_id: terminData.kunden_id,
            mitarbeiter_id: terminData.mitarbeiter_id,
            leistungsart: terminData.leistung.art,
            leistungsdatum: terminData.start_at.split("T")[0],
            leistungsbeginn: terminData.start_at.split("T")[1].substring(0, 5),
            leistungsende: terminData.end_at.split("T")[1].substring(0, 5),
            stunden,
            stundensatz,
            einzelbetrag,
            ist_gueltig: true,
            validierung_hinweise: null
          });
        }

        // Determine recipient
        const empfaengerName = group.kostentraeger?.name || 
          `${group.termine[0].kunden.vorname} ${group.termine[0].kunden.nachname}`;
        
        const isPrivat = !group.kostentraeger;

        // Create Rechnung
        const { data: rechnung, error: rechnungError } = await supabase
          .from("rechnungen")
          .insert({
            rechnungsnummer,
            kostentraeger_id: isPrivat ? null : group.kostentraeger.id,
            privat_kunde_id: isPrivat ? group.termine[0].kunden_id : null,
            empfaenger_name: empfaengerName,
            abrechnungszeitraum_von: zeitraum_von,
            abrechnungszeitraum_bis: zeitraum_bis,
            netto_betrag: nettoBetrag,
            brutto_betrag: nettoBetrag, // No MwSt for Pflegeleistungen
            erstellt_von: user.id,
            validierung_ergebnis: { errors: [], warnings: validationWarnings },
            validierung_warnungen: validationWarnings
          })
          .select()
          .single();

        if (rechnungError) {
          throw new Error(`Failed to create Rechnung: ${rechnungError.message}`);
        }

        // Create Positionen
        const positionenWithRechnungId = positionen.map(p => ({
          ...p,
          rechnung_id: rechnung.id
        }));

        const { error: positionenError } = await supabase
          .from("rechnungspositionen")
          .insert(positionenWithRechnungId);

        if (positionenError) {
          throw new Error(`Failed to create Positionen: ${positionenError.message}`);
        }

        // Update termine status to 'abgerechnet'
        const terminIds = group.termine.map((t: any) => t.id);
        const { error: updateError } = await supabase
          .from("termine")
          .update({ status: "abgerechnet" })
          .in("id", terminIds);

        if (updateError) {
          throw new Error(`Failed to update termine: ${updateError.message}`);
        }

        // Update Kontingent-Verbrauch
        const stundenProLeistung = new Map<string, number>();
        for (const t of group.termine) {
          const leistungId = t.leistung.id;
          const current = stundenProLeistung.get(leistungId) || 0;
          stundenProLeistung.set(leistungId, current + (t.iststunden || 0));
        }

        for (const [leistungId, stunden] of stundenProLeistung) {
          const { error: kontingentError } = await supabase.rpc("update_kontingent", {
            p_leistung_id: leistungId,
            p_stunden: stunden
          }).then((res: any) => res, () => ({ error: null })); // RPC may not exist yet
        }

        // Log to audit
        await supabase
          .from("abrechnungs_historie")
          .insert({
            rechnung_id: rechnung.id,
            aktion: "erstellt",
            neuer_status: "entwurf",
            durchgefuehrt_von: user.id,
            details: {
              anzahl_positionen: positionen.length,
              netto_betrag: nettoBetrag,
              zeitraum: { von: zeitraum_von, bis: zeitraum_bis }
            }
          });

        erstellteRechnungen.push({
          ...rechnung,
          positionen_anzahl: positionen.length
        });
      }
    }

    // Return result
    const response = {
      success: validationErrors.length === 0,
      dry_run,
      validierung: {
        is_valid: validationErrors.length === 0,
        errors: validationErrors,
        warnings: validationWarnings
      },
      zusammenfassung: {
        termine_gesamt: termine.length,
        gruppen: terminGruppen.size,
        rechnungen_erstellt: erstellteRechnungen.length
      },
      rechnungen: erstellteRechnungen,
      gruppen_preview: dry_run ? Array.from(terminGruppen.entries()).map(([key, group]) => ({
        kostentraeger: group.kostentraeger?.name || "Privat",
        termine_anzahl: group.termine.length,
        kunden: [...new Set(group.termine.map((t: any) => 
          `${t.kunden?.vorname} ${t.kunden?.nachname}`
        ))]
      })) : undefined
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Billing error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

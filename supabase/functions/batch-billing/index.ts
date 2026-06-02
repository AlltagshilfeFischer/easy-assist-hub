import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  allocateTermine,
  type CareLevel,
  type HaushaltshilfeVerordnung,
  type KundeForAllocation,
  type Tariff,
  type TerminInput,
} from "../_shared/budget-allocation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Request Type ─────────────────────────────────────────────

interface BillingRequest {
  zeitraum_von: string;
  zeitraum_bis: string;
  kunden_ids?: string[];
  dry_run?: boolean;
}

// ─── DB Row Shapes ────────────────────────────────────────────

interface TerminRow {
  id: string;
  start_at: string;
  end_at: string;
  iststunden: number | null;
  kunden_id: string;
  mitarbeiter_id: string | null;
  kunden: {
    id: string;
    vorname: string | null;
    nachname: string | null;
    pflegegrad: number | null;
    entlastung_genehmigt: boolean | null;
    verhinderungspflege_genehmigt: boolean | null;
    pflegesachleistung_genehmigt: boolean | null;
    initial_budget_entlastung: number | null;
    budget_prioritaet: string[] | null;
  } | null;
}

interface LeistungRow {
  id: string;
  kunden_id: string;
  art: string;
  status: string;
  gueltig_von: string;
  gueltig_bis: string | null;
  kostentraeger_id: string | null;
}

// ─── LN-Gruppe (ein Leistungsnachweis pro Kunde × Monat × HH-Track) ──────────
// cb_haushaltshilfe trennt HH §38 vom regulären LN (separate Abrechnung)

interface LNGroup {
  kundenId: string;
  kundenName: string;
  monat: number;
  jahr: number;
  kostentraegerId: string | null;
  cbEntlastungsleistung: boolean;
  cbKombinationsleistung: boolean;
  cbVerhinderungspflege: boolean;
  cbHaushaltshilfe: boolean;
  istPrivat: boolean;
  gesamtStunden: number;
  terminIds: Set<string>;
  // Für budget_transactions (nur ENTLASTUNG/KOMBI/VERHINDERUNG — kein HH)
  budgetPositionen: Array<{
    terminId: string;
    serviceDate: string;
    serviceType: "ENTLASTUNG" | "KOMBI" | "VERHINDERUNG";
    hours: number;
    visits: number;
    hourlyRate: number;
    amount: number;
    travelFlat: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolveHours(termin: TerminRow): number {
  if (termin.iststunden && termin.iststunden > 0) return termin.iststunden;
  return r2(
    (new Date(termin.end_at).getTime() - new Date(termin.start_at).getTime()) / (1000 * 60 * 60),
  );
}

const SERVICE_TYPE_TO_ART: Record<string, string> = {
  ENTLASTUNG: "entlastungsleistung",
  KOMBI: "pflegesachleistung",
  VERHINDERUNG: "verhinderungspflege",
};

function findKostentraeger(
  leistungen: LeistungRow[],
  kundenId: string,
  serviceDate: string,
): string | null {
  // Nehme Kostenträger von der ersten aktiven Kassen-Leistung
  const arts = ["entlastungsleistung", "pflegesachleistung", "verhinderungspflege"];
  for (const art of arts) {
    const l = leistungen.find(
      (l) =>
        l.kunden_id === kundenId &&
        l.art === art &&
        l.status === "aktiv" &&
        l.gueltig_von <= serviceDate &&
        (l.gueltig_bis === null || l.gueltig_bis >= serviceDate) &&
        l.kostentraeger_id !== null,
    );
    if (l?.kostentraeger_id) return l.kostentraeger_id;
  }
  return null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Edge Function ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization required" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: user.id });
    if (!isAdmin) return jsonResponse({ error: "Admin access required" }, 403);

    // ── Input ─────────────────────────────────────────────────
    const body: BillingRequest = await req.json();
    const { zeitraum_von, zeitraum_bis, kunden_ids, dry_run = false } = body;
    if (!zeitraum_von || !zeitraum_bis) {
      return jsonResponse({ error: "zeitraum_von and zeitraum_bis sind erforderlich" }, 400);
    }

    // ── 1. Abrechenbare Termine laden ─────────────────────────
    let termineQuery = supabase
      .from("termine")
      .select(`
        id, start_at, end_at, iststunden, kunden_id, mitarbeiter_id,
        kunden:kunden_id (
          id, vorname, nachname, pflegegrad,
          entlastung_genehmigt, verhinderungspflege_genehmigt, pflegesachleistung_genehmigt,
          initial_budget_entlastung, budget_prioritaet
        )
      `)
      .in("status", ["completed", "cancelled"])
      .gte("start_at", zeitraum_von)
      .lte("start_at", zeitraum_bis);

    if (kunden_ids?.length) termineQuery = termineQuery.in("kunden_id", kunden_ids);

    const { data: termine, error: termineErr } = await termineQuery;
    if (termineErr) throw new Error(`Termine laden: ${termineErr.message}`);
    if (!termine?.length) {
      return jsonResponse({ success: true, dry_run, warnings: [], zusammenfassung: { termine_gesamt: 0, leistungsnachweise: 0 }, vorschau: [] });
    }

    const billingYear = new Date(zeitraum_von).getFullYear();
    const warnings: string[] = [];
    const billedTerminIds: string[] = [];

    // ── 2. Stammdaten laden ───────────────────────────────────
    const kundenIds = [...new Set((termine as TerminRow[]).map((t) => t.kunden_id))];

    // Tarife + Care Levels
    const [{ data: tariffs }, { data: careLevels }, { data: leistungen }] = await Promise.all([
      supabase.from("tariffs").select("service_type, hourly_rate, travel_flat_per_visit, active").eq("active", true),
      supabase.from("care_levels").select("pflegegrad, kombi_max_40_prozent_monat"),
      supabase
        .from("leistungen")
        .select("id, kunden_id, art, status, gueltig_von, gueltig_bis, kostentraeger_id")
        .in("kunden_id", kundenIds),
    ]);

    // Bereits abgerechnete Budgets im Billing-Jahr (vor zeitraum_von)
    const { data: preConsumedRows } = await supabase
      .from("budget_transactions")
      .select("client_id, service_type, total_amount")
      .in("client_id", kundenIds)
      .eq("billed", true)
      .gte("service_date", `${billingYear}-01-01`)
      .lt("service_date", zeitraum_von.slice(0, 10));

    const preConsumedMap = new Map<string, { ENTLASTUNG: number; VERHINDERUNG: number }>();
    for (const row of preConsumedRows ?? []) {
      const cur = preConsumedMap.get(row.client_id) ?? { ENTLASTUNG: 0, VERHINDERUNG: 0 };
      if (row.service_type === "ENTLASTUNG") cur.ENTLASTUNG += row.total_amount;
      if (row.service_type === "VERHINDERUNG") cur.VERHINDERUNG += row.total_amount;
      preConsumedMap.set(row.client_id, cur);
    }

    // ── 2b. Haushaltshilfe §38 Verordnungen laden ─────────────
    // Nur Verordnungen, die den Abrechnungszeitraum (auch partiell) überschneiden
    const { data: hhVerordnungenRows } = await supabase
      .from("haushaltshilfe_verordnungen")
      .select("kunden_id, gueltig_von, gueltig_bis, max_dauer_stunden")
      .in("kunden_id", kundenIds)
      .lte("gueltig_von", zeitraum_bis.slice(0, 10))
      .gte("gueltig_bis", zeitraum_von.slice(0, 10));

    const hhVerordnungenByKunde = new Map<string, HaushaltshilfeVerordnung[]>();
    for (const row of hhVerordnungenRows ?? []) {
      const existing = hhVerordnungenByKunde.get(row.kunden_id) ?? [];
      existing.push({
        gueltig_von: row.gueltig_von,
        gueltig_bis: row.gueltig_bis,
        max_dauer_stunden: Number(row.max_dauer_stunden),
      });
      hhVerordnungenByKunde.set(row.kunden_id, existing);
    }

    // ── 3. FIFO-Allokation pro Kunde ──────────────────────────
    const termineByKunde = new Map<string, TerminRow[]>();
    for (const t of termine as TerminRow[]) {
      termineByKunde.set(t.kunden_id, [...(termineByKunde.get(t.kunden_id) ?? []), t]);
    }

    // lnKey: `${kundenId}:${yyyy-MM}:hh` oder `${kundenId}:${yyyy-MM}:reg`
    const lnGroups = new Map<string, LNGroup>();

    for (const [kundenId, kundenTermine] of termineByKunde) {
      const kundeData = kundenTermine[0].kunden;
      if (!kundeData) {
        warnings.push(`Kundendaten für ID ${kundenId} fehlen — übersprungen.`);
        continue;
      }

      const kunde: KundeForAllocation = {
        pflegegrad: kundeData.pflegegrad,
        entlastung_genehmigt: kundeData.entlastung_genehmigt,
        verhinderungspflege_genehmigt: kundeData.verhinderungspflege_genehmigt,
        pflegesachleistung_genehmigt: kundeData.pflegesachleistung_genehmigt,
        initial_budget_entlastung: kundeData.initial_budget_entlastung,
        budget_prioritaet: kundeData.budget_prioritaet,
        haushaltshilfe_verordnungen: hhVerordnungenByKunde.get(kundenId) ?? [],
      };

      const terminInputs: TerminInput[] = kundenTermine.map((t) => ({
        id: t.id,
        serviceDate: t.start_at.split("T")[0],
        hours: resolveHours(t),
        visits: 1,
      }));

      const preConsumed = preConsumedMap.get(kundenId) ?? { ENTLASTUNG: 0, VERHINDERUNG: 0 };
      const allocationResults = allocateTermine(
        terminInputs,
        kunde,
        (tariffs ?? []) as Tariff[],
        (careLevels ?? []) as CareLevel[],
        billingYear,
        preConsumed.ENTLASTUNG,
        preConsumed.VERHINDERUNG,
      );

      const kundenName = `${kundeData.vorname ?? ""} ${kundeData.nachname ?? ""}`.trim();

      for (const result of allocationResults) {
        billedTerminIds.push(result.terminId);

        // Separater LN-Track für §38 HH vs. reguläre Budgets
        const isHH = result.positions.some((p) => p.serviceType === "HAUSHALTSHILFE");
        const dateObj = new Date(result.serviceDate + "T00:00:00Z");
        const monat = dateObj.getUTCMonth() + 1;
        const jahr = dateObj.getUTCFullYear();
        const lnKey = `${kundenId}:${jahr}-${String(monat).padStart(2, "0")}:${isHH ? "hh" : "reg"}`;

        if (!lnGroups.has(lnKey)) {
          const ktId = findKostentraeger(leistungen ?? [], kundenId, result.serviceDate);
          lnGroups.set(lnKey, {
            kundenId,
            kundenName,
            monat,
            jahr,
            kostentraegerId: ktId,
            cbEntlastungsleistung: false,
            cbKombinationsleistung: false,
            cbVerhinderungspflege: false,
            cbHaushaltshilfe: isHH,
            istPrivat: false,
            gesamtStunden: 0,
            terminIds: new Set(),
            budgetPositionen: [],
          });
        }
        const group = lnGroups.get(lnKey)!;
        group.terminIds.add(result.terminId);
        group.gesamtStunden = r2(group.gesamtStunden + result.hours);

        for (const pos of result.positions) {
          switch (pos.serviceType) {
            case "ENTLASTUNG":     group.cbEntlastungsleistung = true; break;
            case "KOMBI":          group.cbKombinationsleistung = true; break;
            case "VERHINDERUNG":   group.cbVerhinderungspflege = true; break;
            case "HAUSHALTSHILFE": group.cbHaushaltshilfe = true; break;
            case "PRIVAT":         group.istPrivat = true; break;
          }

          // budget_transactions nur für Kassentöpfe (kein HH — geht zur Krankenkasse)
          if (pos.serviceType !== "PRIVAT" && pos.serviceType !== "HAUSHALTSHILFE") {
            const art = SERVICE_TYPE_TO_ART[pos.serviceType];
            const leistungActive = (leistungen ?? []).find(
              (l) =>
                l.kunden_id === kundenId &&
                l.art === art &&
                l.status === "aktiv" &&
                l.gueltig_von <= result.serviceDate &&
                (l.gueltig_bis === null || l.gueltig_bis >= result.serviceDate),
            );
            if (!leistungActive) {
              warnings.push(
                `Keine aktive ${art}-Leistung für ${kundenName} am ${result.serviceDate}.`,
              );
            }
            group.budgetPositionen.push({
              terminId: result.terminId,
              serviceDate: result.serviceDate,
              serviceType: pos.serviceType as "ENTLASTUNG" | "KOMBI" | "VERHINDERUNG",
              hours: pos.stunden,
              visits: result.visits,
              hourlyRate: pos.hourlyRate,
              amount: pos.amount,
              travelFlat: pos.travelFlat,
            });
          }
        }
      }
    }

    // ── Dry Run: Vorschau ─────────────────────────────────────
    if (dry_run) {
      return jsonResponse({
        success: true,
        dry_run: true,
        warnings,
        zusammenfassung: {
          termine_gesamt: (termine as TerminRow[]).length,
          leistungsnachweise: lnGroups.size,
        },
        vorschau: [...lnGroups.values()].map((g) => ({
          kunde: g.kundenName,
          monat: g.monat,
          jahr: g.jahr,
          termine_anzahl: g.terminIds.size,
          gesamtstunden: g.gesamtStunden,
          toeffe: {
            entlastung: g.cbEntlastungsleistung,
            kombi: g.cbKombinationsleistung,
            verhinderung: g.cbVerhinderungspflege,
            haushaltshilfe: g.cbHaushaltshilfe,
            privat: g.istPrivat,
          },
        })),
      });
    }

    // ── 5. Leistungsnachweise upserten ────────────────────────

    // 5a. Gesperrte LNs vorab ermitteln — unterschrieben/abgeschlossen dürfen nicht
    //     überschrieben werden (rechtsgültige Dokumente).
    const allKundenIds = [...new Set([...lnGroups.values()].map((g) => g.kundenId))];
    const { data: existingLNs } = await supabase
      .from("leistungsnachweise")
      .select("kunden_id, monat, jahr, cb_haushaltshilfe, status")
      .in("kunden_id", allKundenIds)
      .in("status", ["unterschrieben", "abgeschlossen"]);

    const lockedLNKeys = new Set<string>(
      (existingLNs ?? []).map(
        (ln) =>
          `${ln.kunden_id}:${ln.jahr}-${String(ln.monat).padStart(2, "0")}:${ln.cb_haushaltshilfe ? "hh" : "reg"}`,
      ),
    );

    const erstellteLN: unknown[] = [];

    for (const [lnKey, group] of lnGroups.entries()) {
      // Gesperrten LN nicht überschreiben
      if (lockedLNKeys.has(lnKey)) {
        warnings.push(
          `LN für ${group.kundenName} ${group.monat}/${group.jahr} ist bereits unterschrieben/abgeschlossen — übersprungen.`,
        );
        continue;
      }

      const { data: ln, error: lnErr } = await supabase
        .from("leistungsnachweise")
        .upsert(
          {
            kunden_id: group.kundenId,
            monat: group.monat,
            jahr: group.jahr,
            kostentraeger_id: group.kostentraegerId,
            cb_entlastungsleistung: group.cbEntlastungsleistung,
            cb_kombinationsleistung: group.cbKombinationsleistung,
            cb_verhinderungspflege: group.cbVerhinderungspflege,
            cb_haushaltshilfe: group.cbHaushaltshilfe,
            ist_privat: group.istPrivat,
            geleistete_stunden: group.gesamtStunden,
            status: "offen",
          },
          { onConflict: "kunden_id,monat,jahr,cb_haushaltshilfe", ignoreDuplicates: false },
        )
        .select("id")
        .single();

      if (lnErr) throw new Error(`Leistungsnachweis upsert: ${lnErr.message}`);

      // ── 6. Budget-Transaktionen schreiben (kein HH — geht zur Krankenkasse) ──
      if (group.budgetPositionen.length) {
        const txRows = group.budgetPositionen.map((p) => ({
          client_id: group.kundenId,
          service_type: p.serviceType,
          service_date: p.serviceDate,
          hours: p.hours,
          visits: p.visits,
          hourly_rate: p.hourlyRate,
          total_amount: p.amount,
          travel_flat_total: p.travelFlat,
          allocation_type: "FIFO",
          source: "MANUAL",
          billed: true,
          external_ref: ln.id,
        }));

        const { error: txErr } = await supabase.from("budget_transactions").insert(txRows);
        if (txErr) throw new Error(`Budget-Transaktionen: ${txErr.message}`);
      }

      erstellteLN.push({
        ln_id: ln.id,
        kunden_id: group.kundenId,
        kunde: group.kundenName,
        monat: group.monat,
        jahr: group.jahr,
        haushaltshilfe: group.cbHaushaltshilfe,
        termine_anzahl: group.terminIds.size,
        gesamtstunden: group.gesamtStunden,
      });
    }

    // ── 7. Termine auf 'abgerechnet' setzen ──────────────────
    const uniqueTerminIds = [...new Set(billedTerminIds)];
    if (uniqueTerminIds.length) {
      const { error: updateErr } = await supabase
        .from("termine")
        .update({ status: "abgerechnet" })
        .in("id", uniqueTerminIds);
      if (updateErr) throw new Error(`Status-Update: ${updateErr.message}`);
    }

    return jsonResponse({
      success: true,
      dry_run: false,
      warnings,
      zusammenfassung: {
        termine_gesamt: (termine as TerminRow[]).length,
        termine_abgerechnet: uniqueTerminIds.length,
        leistungsnachweise_erstellt: erstellteLN.length,
      },
      leistungsnachweise: erstellteLN,
    });
  } catch (err) {
    console.error("Billing error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler", success: false },
      500,
    );
  }
});

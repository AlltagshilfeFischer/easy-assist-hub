import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  allocateTermine,
  type CareLevel,
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
  kostentraeger_id?: string;
  dry_run?: boolean;
}

// ─── DB Row Shapes ────────────────────────────────────────────

interface TerminRow {
  id: string;
  titel: string;
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
  mitarbeiter: { id: string } | null;
}

interface LeistungRow {
  id: string;
  kunden_id: string;
  art: string;
  status: string;
  gueltig_von: string;
  gueltig_bis: string | null;
  kostentraeger_id: string | null;
  kostentraeger: { id: string; name: string; typ: string } | null;
}

// ─── Rechnung-Gruppe ──────────────────────────────────────────

interface PositionForRechnung {
  terminId: string;
  kundenId: string;
  mitarbeiterId: string | null;
  leistungId: string | null;
  leistungsart: string;
  serviceDate: string;
  beginn: string;
  ende: string;
  amount: number;
  hourlyRate: number;
  stunden: number;
  mwstSatz: number;
  mwstBetrag: number;
  bruttoBetrag: number;
}

interface RechnungGroup {
  kostentraegerId: string | null;
  empfaengerName: string;
  privatKundeId: string | null;
  kundenId: string;
  positionen: PositionForRechnung[];
}

// ─── Helpers ──────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toHHMM(iso: string): string {
  return iso.split("T")[1]?.slice(0, 5) ?? "00:00";
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

function findLeistung(
  serviceType: string,
  leistungen: LeistungRow[],
  kundenId: string,
  serviceDate: string,
): LeistungRow | undefined {
  const art = SERVICE_TYPE_TO_ART[serviceType];
  if (!art) return undefined;
  return leistungen.find(
    (l) =>
      l.kunden_id === kundenId &&
      l.art === art &&
      l.status === "aktiv" &&
      l.gueltig_von <= serviceDate &&
      (l.gueltig_bis === null || l.gueltig_bis >= serviceDate),
  );
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
    const { zeitraum_von, zeitraum_bis, kunden_ids, kostentraeger_id, dry_run = false } = body;
    if (!zeitraum_von || !zeitraum_bis) {
      return jsonResponse({ error: "zeitraum_von and zeitraum_bis are required" }, 400);
    }

    // ── 1. Termine laden ──────────────────────────────────────
    let termineQuery = supabase
      .from("termine")
      .select(`
        id, titel, start_at, end_at, iststunden, kunden_id, mitarbeiter_id,
        kunden:kunden_id (
          id, vorname, nachname, pflegegrad,
          entlastung_genehmigt, verhinderungspflege_genehmigt, pflegesachleistung_genehmigt,
          initial_budget_entlastung, budget_prioritaet
        ),
        mitarbeiter:mitarbeiter_id (id)
      `)
      .eq("status", "completed")
      .gte("start_at", zeitraum_von)
      .lte("start_at", zeitraum_bis);

    if (kunden_ids?.length) termineQuery = termineQuery.in("kunden_id", kunden_ids);

    const { data: termine, error: termineErr } = await termineQuery;
    if (termineErr) throw new Error(`Fehler beim Laden der Termine: ${termineErr.message}`);
    if (!termine?.length) {
      return jsonResponse({
        success: true,
        message: "Keine abrechenbaren Termine im Zeitraum gefunden",
        rechnungen: [],
        validierung: { is_valid: true, errors: [], warnings: [] },
      });
    }

    const kundenIds = [...new Set((termine as TerminRow[]).map((t) => t.kunden_id))];

    // ── 2. Stammdaten parallel laden ─────────────────────────
    const billingYear = new Date(zeitraum_von + "T00:00:00Z").getUTCFullYear();

    const [tariffsRes, careLevelsRes, leistungenRes, preConsumedRes] = await Promise.all([
      supabase
        .from("tariffs")
        .select("service_type, hourly_rate, travel_flat_per_visit, active")
        .eq("active", true),
      supabase
        .from("care_levels")
        .select("pflegegrad, kombi_max_40_prozent_monat"),
      supabase
        .from("leistungen")
        .select(
          "id, kunden_id, art, status, gueltig_von, gueltig_bis, kostentraeger_id, kostentraeger:kostentraeger_id(id, name, typ)",
        )
        .in("kunden_id", kundenIds)
        .eq("status", "aktiv"),
      // Bereits abgerechnete Budgets im laufenden Jahr (vor dem Abrechnungszeitraum)
      supabase
        .from("budget_transactions")
        .select("client_id, service_type, total_amount")
        .in("client_id", kundenIds)
        .eq("billed", true)
        .gte("service_date", `${billingYear}-01-01`)
        .lt("service_date", zeitraum_von),
    ]);

    if (tariffsRes.error) throw new Error(`Tarife: ${tariffsRes.error.message}`);
    if (careLevelsRes.error) throw new Error(`Pflegegrade: ${careLevelsRes.error.message}`);
    if (leistungenRes.error) throw new Error(`Leistungen: ${leistungenRes.error.message}`);

    const tariffs = (tariffsRes.data ?? []) as Tariff[];
    const careLevels = (careLevelsRes.data ?? []) as CareLevel[];
    const leistungen = (leistungenRes.data ?? []) as LeistungRow[];

    if (!tariffs.length) {
      throw new Error("Keine aktiven Tarife — Abrechnung nicht möglich.");
    }

    // ── 3. Vorverbrauch pro Kunde aggregieren ─────────────────
    const preConsumedMap = new Map<string, { ENTLASTUNG: number; VERHINDERUNG: number }>();
    for (const tx of preConsumedRes.data ?? []) {
      if (!preConsumedMap.has(tx.client_id)) {
        preConsumedMap.set(tx.client_id, { ENTLASTUNG: 0, VERHINDERUNG: 0 });
      }
      const e = preConsumedMap.get(tx.client_id)!;
      if (tx.service_type === "ENTLASTUNG") e.ENTLASTUNG += tx.total_amount;
      else if (tx.service_type === "VERHINDERUNG") e.VERHINDERUNG += tx.total_amount;
    }

    // ── 4. FIFO-Allokation pro Kunde ──────────────────────────
    const warnings: string[] = [];
    const rechnungGroups = new Map<string, RechnungGroup>();
    const billedTerminIds: string[] = [];

    const termineByKunde = new Map<string, TerminRow[]>();
    for (const t of termine as TerminRow[]) {
      termineByKunde.set(t.kunden_id, [...(termineByKunde.get(t.kunden_id) ?? []), t]);
    }

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
        tariffs,
        careLevels,
        billingYear,
        preConsumed.ENTLASTUNG,
        preConsumed.VERHINDERUNG,
      );

      const terminMap = new Map(kundenTermine.map((t) => [t.id, t]));

      for (const result of allocationResults) {
        const termin = terminMap.get(result.terminId)!;
        billedTerminIds.push(result.terminId);

        for (const pos of result.positions) {
          const posEntry: PositionForRechnung = {
            terminId: result.terminId,
            kundenId,
            mitarbeiterId: termin.mitarbeiter?.id ?? null,
            leistungId: null,
            leistungsart: "privat",
            serviceDate: result.serviceDate,
            beginn: toHHMM(termin.start_at),
            ende: toHHMM(termin.end_at),
            amount: pos.amount,
            hourlyRate: pos.hourlyRate,
            stunden: pos.stunden,
            mwstSatz: pos.mwstSatz,
            mwstBetrag: pos.mwstBetrag,
            bruttoBetrag: pos.bruttoBetrag,
          };

          if (pos.serviceType === "PRIVAT") {
            // Privatrechnung direkt an den Kunden
            const groupKey = `${kundenId}:privat`;
            if (!rechnungGroups.has(groupKey)) {
              rechnungGroups.set(groupKey, {
                kostentraegerId: null,
                empfaengerName: `${kundeData.vorname ?? ""} ${kundeData.nachname ?? ""}`.trim(),
                privatKundeId: kundenId,
                kundenId,
                positionen: [],
              });
            }
            rechnungGroups.get(groupKey)!.positionen.push(posEntry);
          } else {
            // Kassenrechnung an den Kostenträger
            const leistung = findLeistung(pos.serviceType, leistungen, kundenId, result.serviceDate);
            if (!leistung) {
              warnings.push(
                `Keine aktive ${SERVICE_TYPE_TO_ART[pos.serviceType] ?? pos.serviceType}-Leistung ` +
                `für ${kundeData.vorname} ${kundeData.nachname} am ${result.serviceDate}.`,
              );
            }

            const ktId = leistung?.kostentraeger_id ?? null;
            const ktName = leistung?.kostentraeger?.name ?? "Pflegekasse";
            const groupKey = `${kundenId}:kasse:${ktId ?? "unbekannt"}`;

            if (!rechnungGroups.has(groupKey)) {
              rechnungGroups.set(groupKey, {
                kostentraegerId: ktId,
                empfaengerName: ktName,
                privatKundeId: null,
                kundenId,
                positionen: [],
              });
            }
            rechnungGroups.get(groupKey)!.positionen.push({
              ...posEntry,
              leistungId: leistung?.id ?? null,
              leistungsart: SERVICE_TYPE_TO_ART[pos.serviceType] ?? pos.serviceType.toLowerCase(),
            });
          }
        }
      }
    }

    // Optionaler Filter nach Kostenträger
    if (kostentraeger_id) {
      for (const [key, group] of rechnungGroups) {
        if (group.kostentraegerId !== kostentraeger_id) rechnungGroups.delete(key);
      }
    }

    // ── Dry Run: Vorschau ─────────────────────────────────────
    if (dry_run) {
      return jsonResponse({
        success: true,
        dry_run: true,
        validierung: { is_valid: true, errors: [], warnings },
        zusammenfassung: { termine_gesamt: termine.length, gruppen: rechnungGroups.size },
        gruppen_preview: [...rechnungGroups.values()].map((g) => {
          const terminIds = [...new Set(g.positionen.map((p) => p.terminId))];
          const splitTermine = terminIds.filter(
            (tid) => g.positionen.filter((p) => p.terminId === tid).length > 1,
          ).length;
          const netto = r2(g.positionen.reduce((s, p) => s + p.amount, 0));
          const mwst = r2(g.positionen.reduce((s, p) => s + p.mwstBetrag, 0));
          return {
            empfaenger: g.empfaengerName,
            typ: g.privatKundeId ? "Privat" : "Kasse",
            termine_anzahl: terminIds.length,
            split_termine: splitTermine,
            positionen_anzahl: g.positionen.length,
            netto_betrag: netto,
            mwst_betrag: mwst,
            brutto_betrag: r2(netto + mwst),
          };
        }),
        rechnungen: [],
      });
    }

    // ── 5. Rechnungen, Positionen, Termine ───────────────────
    const erstellteRechnungen: unknown[] = [];

    for (const group of rechnungGroups.values()) {
      if (!group.positionen.length) continue;

      const nettoBetrag = r2(group.positionen.reduce((s, p) => s + p.amount, 0));
      const mwstBetrag = r2(group.positionen.reduce((s, p) => s + p.mwstBetrag, 0));
      const bruttoBetrag = r2(nettoBetrag + mwstBetrag);
      const mwstSatz = nettoBetrag > 0 ? r2(mwstBetrag / nettoBetrag) : 0;

      const { data: rechnungsnummer } = await supabase.rpc("generate_rechnungsnummer");

      const { data: rechnung, error: rechnungErr } = await supabase
        .from("rechnungen")
        .insert({
          rechnungsnummer,
          kostentraeger_id: group.kostentraegerId,
          privat_kunde_id: group.privatKundeId,
          empfaenger_name: group.empfaengerName,
          abrechnungszeitraum_von: zeitraum_von,
          abrechnungszeitraum_bis: zeitraum_bis,
          netto_betrag: nettoBetrag,
          mwst_satz: mwstSatz,
          mwst_betrag: mwstBetrag,
          brutto_betrag: bruttoBetrag,
          erstellt_von: user.id,
          validierung_ergebnis: warnings.length ? { warnings } : null,
          validierung_warnungen: warnings.length ? warnings : null,
        })
        .select()
        .single();

      if (rechnungErr) throw new Error(`Rechnung anlegen: ${rechnungErr.message}`);

      const positionen = group.positionen.map((p) => ({
        rechnung_id: rechnung.id,
        termin_id: p.terminId,
        kunden_id: p.kundenId,
        mitarbeiter_id: p.mitarbeiterId,
        leistung_id: p.leistungId,
        leistungsart: p.leistungsart,
        leistungsdatum: p.serviceDate,
        leistungsbeginn: p.beginn,
        leistungsende: p.ende,
        stunden: p.stunden,
        stundensatz: p.hourlyRate,
        einzelbetrag: p.amount,
        mwst_satz: p.mwstSatz,
        mwst_betrag: p.mwstBetrag,
        brutto_betrag: p.bruttoBetrag,
        ist_gueltig: true,
        validierung_hinweise: null,
      }));

      const { error: posErr } = await supabase.from("rechnungspositionen").insert(positionen);
      if (posErr) throw new Error(`Positionen anlegen: ${posErr.message}`);

      const splitCount = [...new Set(positionen.map((p) => p.termin_id))].filter(
        (tid) => positionen.filter((p) => p.termin_id === tid).length > 1,
      ).length;

      await supabase.from("abrechnungs_historie").insert({
        rechnung_id: rechnung.id,
        aktion: "erstellt",
        neuer_status: "entwurf",
        durchgefuehrt_von: user.id,
        details: {
          positionen_anzahl: positionen.length,
          split_termine: splitCount,
          netto_betrag: nettoBetrag,
          mwst_betrag: mwstBetrag,
          brutto_betrag: bruttoBetrag,
          zeitraum: { von: zeitraum_von, bis: zeitraum_bis },
        },
      });

      erstellteRechnungen.push({ ...rechnung, positionen_anzahl: positionen.length });
    }

    // Terme auf 'abgerechnet' setzen
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
      validierung: { is_valid: true, errors: [], warnings },
      zusammenfassung: {
        termine_gesamt: termine.length,
        gruppen: rechnungGroups.size,
        rechnungen_erstellt: erstellteRechnungen.length,
      },
      rechnungen: erstellteRechnungen,
    });
  } catch (err) {
    console.error("Billing error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler", success: false },
      500,
    );
  }
});

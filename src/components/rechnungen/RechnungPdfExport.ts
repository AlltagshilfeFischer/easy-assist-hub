import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Rechnung, Rechnungsposition } from '@/hooks/useRechnungen';

const LEISTUNGSART_LABELS: Record<string, string> = {
  kombileistung: 'Kombileistung (§45a)',
  vorjahresrest_entlastung: 'Entlastung Vorjahresrest',
  verhinderungspflege: 'Verhinderungspflege (§39)',
  entlastungsbetrag: 'Entlastungsbetrag (§45b)',
  privat: 'Privat',
  KOMBI: 'Kombileistung (§45a)',
  VERHINDERUNG: 'Verhinderungspflege (§39)',
  ENTLASTUNG: 'Entlastungsbetrag (§45b)',
  PRIVAT: 'Privat',
};

function formatLeistungsart(raw: string): string {
  return LEISTUNGSART_LABELS[raw] ?? raw;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de });
}

export async function exportRechnungPdf(
  rechnung: Rechnung,
  positionen: Rechnungsposition[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginLeft = 14;
  const marginRight = pageWidth - 14;

  // ── Header ─────────────────────────────────────────────────────────────────
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ALLTAGSHILFE FISCHER GbR', marginLeft, 20);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text('Hannover', marginLeft, 26);
  pdf.setTextColor(0);

  // Rechnung-Label rechts
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Rechnung', marginRight, 20, { align: 'right' });

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80);
  pdf.text(`Rechnungsnr.: ${rechnung.rechnungsnummer}`, marginRight, 27, { align: 'right' });
  pdf.text(`Datum: ${format(new Date(), 'dd.MM.yyyy', { locale: de })}`, marginRight, 32, { align: 'right' });
  pdf.setTextColor(0);

  // ── Empfänger ──────────────────────────────────────────────────────────────
  let y = 45;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text('An:', marginLeft, y);
  pdf.setTextColor(0);
  y += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.text(rechnung.empfaenger_name, marginLeft, y);
  y += 5;

  if (rechnung.empfaenger_adresse) {
    pdf.setFont('helvetica', 'normal');
    const adressLines = rechnung.empfaenger_adresse.split('\n');
    for (const line of adressLines) {
      pdf.text(line, marginLeft, y);
      y += 5;
    }
  }

  // ── Abrechnungszeitraum ────────────────────────────────────────────────────
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(80);
  pdf.text('Abrechnungszeitraum:', marginLeft, y);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold');
  pdf.text(
    `${formatDate(rechnung.abrechnungszeitraum_von)} – ${formatDate(rechnung.abrechnungszeitraum_bis)}`,
    marginLeft + 42,
    y
  );

  // ── Trennlinie ─────────────────────────────────────────────────────────────
  y += 8;
  pdf.setDrawColor(200);
  pdf.line(marginLeft, y, marginRight, y);
  y += 6;

  // ── Tabellen-Header ────────────────────────────────────────────────────────
  const colDatum = marginLeft;
  const colLeistungsart = marginLeft + 22;
  const colStunden = marginLeft + 85;
  const colSatz = marginLeft + 105;
  const colBetrag = marginRight;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(80);
  pdf.text('Datum', colDatum, y);
  pdf.text('Leistungsart', colLeistungsart, y);
  pdf.text('Stunden', colStunden, y);
  pdf.text('Satz €/h', colSatz, y);
  pdf.text('Betrag €', colBetrag, y, { align: 'right' });
  pdf.setTextColor(0);

  y += 2;
  pdf.setDrawColor(180);
  pdf.line(marginLeft, y, marginRight, y);
  y += 5;

  // ── Tabellenzeilen ─────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  for (const pos of positionen) {
    if (y > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage();
      y = 20;
    }

    pdf.text(formatDate(pos.leistungsdatum), colDatum, y);
    pdf.text(formatLeistungsart(pos.leistungsart), colLeistungsart, y);
    pdf.text(pos.stunden.toFixed(2), colStunden, y);
    pdf.text(formatCurrency(pos.stundensatz), colSatz, y);
    pdf.text(formatCurrency(pos.einzelbetrag), colBetrag, y, { align: 'right' });

    y += 6;
  }

  // ── Fußzeile Beträge ───────────────────────────────────────────────────────
  y += 3;
  pdf.setDrawColor(180);
  pdf.line(marginLeft, y, marginRight, y);
  y += 6;

  const summaryLabelX = marginLeft + 90;
  const summaryValueX = marginRight;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Nettobetrag:', summaryLabelX, y);
  pdf.text(`${formatCurrency(rechnung.netto_betrag)} €`, summaryValueX, y, { align: 'right' });
  y += 6;

  if (rechnung.mwst_betrag > 0) {
    const mwstProzent = Math.round(rechnung.mwst_satz * 100);
    pdf.text(`MwSt (${mwstProzent}%):`, summaryLabelX, y);
    pdf.text(`${formatCurrency(rechnung.mwst_betrag)} €`, summaryValueX, y, { align: 'right' });
    y += 6;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Gesamtbetrag:', summaryLabelX, y);
  pdf.text(`${formatCurrency(rechnung.brutto_betrag)} €`, summaryValueX, y, { align: 'right' });

  // ── Zahlungshinweis ────────────────────────────────────────────────────────
  y += 14;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text('Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.', marginLeft, y);
  pdf.setTextColor(0);

  // ── Speichern ──────────────────────────────────────────────────────────────
  pdf.save(`Rechnung_${rechnung.rechnungsnummer}.pdf`);
}

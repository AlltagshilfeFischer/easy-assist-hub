import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Kunde {
  vorname: string | null;
  nachname: string | null;
  name: string | null;
  strasse: string | null;
  plz: string | null;
  stadt: string | null;
  adresse: string | null;
  geburtsdatum: string | null;
  pflegekasse: string | null;
  versichertennummer: string | null;
  pflegegrad: number | null;
}

interface Termin {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  iststunden: number | null;
}

interface LeistungsnachweisData {
  monat: number;
  jahr: number;
  ist_privat: boolean;
  abweichende_rechnungsadresse: boolean;
  unterschrift_kunde_bild: string | null;
  unterschrift_gf_name: string | null;
}

interface Props {
  kunde: Kunde;
  nachweis: LeistungsnachweisData;
  termine: Termin[];
}

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const SKIP_STATUS = ['cancelled', 'abgesagt_rechtzeitig'];

export default function LeistungsnachweisPreview({ kunde, nachweis, termine }: Props) {
  const kundenName = [kunde.vorname, kunde.nachname].filter(Boolean).join(' ') || kunde.name || '';
  const adresse = kunde.adresse || [kunde.strasse, [kunde.plz, kunde.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const geburtsdatum = kunde.geburtsdatum ? format(new Date(kunde.geburtsdatum), 'dd.MM.yyyy') : '';

  // Build day map: day number -> { uhrzeit, stunden }
  const dayMap = new Map<number, { uhrzeit: string; stunden: string }>();
  let totalStunden = 0;

  for (const t of termine) {
    if (SKIP_STATUS.includes(t.status)) continue;
    const start = new Date(t.start_at);
    const end = new Date(t.end_at);
    const day = start.getDate();
    const uhrzeit = `${format(start, 'HH:mm')}-${format(end, 'HH:mm')}`;
    const hours = t.iststunden ?? ((end.getTime() - start.getTime()) / 3600000);
    totalStunden += hours;
    // If multiple termine on same day, append
    const existing = dayMap.get(day);
    if (existing) {
      dayMap.set(day, {
        uhrzeit: existing.uhrzeit + '\n' + uhrzeit,
        stunden: (parseFloat(existing.stunden.replace(',', '.')) + hours).toFixed(1).replace('.', ','),
      });
    } else {
      dayMap.set(day, { uhrzeit, stunden: hours.toFixed(1).replace('.', ',') });
    }
  }

  const daysInMonth = new Date(nachweis.jahr, nachweis.monat, 0).getDate();
  const leftDays = Array.from({ length: 15 }, (_, i) => i + 1);
  const rightDays = Array.from({ length: daysInMonth - 15 }, (_, i) => i + 16);
  // Pad right to 16 rows for visual alignment
  while (rightDays.length < 16) rightDays.push(0);

  const rows = leftDays.map((ld, i) => ({
    leftDay: ld,
    rightDay: rightDays[i] || 0,
  }));
  // If right has more than 15
  while (rows.length < rightDays.length) {
    rows.push({ leftDay: 0, rightDay: rightDays[rows.length] || 0 });
  }

  const renderDayCell = (day: number) => {
    if (day === 0 || day > daysInMonth) return { tag: '', uhrzeit: '', std: '' };
    const entry = dayMap.get(day);
    return {
      tag: String(day).padStart(2, '0'),
      uhrzeit: entry?.uhrzeit || '',
      std: entry?.stunden || '',
    };
  };

  return (
    <div className="print-area bg-white text-black" style={{ width: '210mm', minHeight: '297mm', padding: '12mm 15mm', fontFamily: 'Arial, sans-serif', fontSize: '10px', lineHeight: '1.4', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6mm' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Leistungsnachweis Alltagshilfe Fischer</h1>
        <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#2563eb' }}>
          Alltagshilfe<br />Fischer
        </div>
      </div>

      {/* Kundendaten */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', fontSize: '10px' }}>
        <tbody>
          <tr>
            <td style={{ width: '25%', padding: '1mm 2mm', fontWeight: 'bold' }}>Leistungsnehmer:</td>
            <td style={{ width: '40%', padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{kundenName}</td>
            <td style={{ width: '15%', padding: '1mm 2mm', fontWeight: 'bold' }}>Pflegekasse:</td>
            <td style={{ width: '20%', padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{kunde.pflegekasse || ''}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 2mm', fontWeight: 'bold' }}>Adresse:</td>
            <td style={{ padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{adresse}</td>
            <td style={{ padding: '1mm 2mm', fontWeight: 'bold' }}>Vers. Nr.:</td>
            <td style={{ padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{kunde.versichertennummer || ''}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 2mm', fontWeight: 'bold' }}>Geburtsdatum:</td>
            <td style={{ padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{geburtsdatum}</td>
            <td style={{ padding: '1mm 2mm', fontWeight: 'bold' }}>Pflegegrad:</td>
            <td style={{ padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{kunde.pflegegrad ?? ''}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 2mm', fontWeight: 'bold' }}>Monat:</td>
            <td style={{ padding: '1mm 2mm', borderBottom: '1px solid #ccc' }}>{monthNames[nachweis.monat - 1]} {nachweis.jahr}</td>
            <td colSpan={2}></td>
          </tr>
        </tbody>
      </table>

      {/* Termintabelle - Two columns side by side */}
      <div style={{ display: 'flex', gap: '3mm', marginBottom: '3mm' }}>
        {/* Left column: Days 1-15 */}
        <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Tag</th>
              <th style={{ ...thStyle, minWidth: '25mm' }}>Uhrzeit</th>
              <th style={thStyle}>Std</th>
            </tr>
          </thead>
          <tbody>
            {leftDays.map(day => {
              const c = renderDayCell(day);
              return (
                <tr key={day}>
                  <td style={tdStyle}>{c.tag}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'pre-line' }}>{c.uhrzeit}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{c.std}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Right column: Days 16-31 */}
        <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Tag</th>
              <th style={{ ...thStyle, minWidth: '25mm' }}>Uhrzeit</th>
              <th style={thStyle}>Std</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 16 }, (_, i) => i + 16).map(day => {
              const c = renderDayCell(day);
              return (
                <tr key={day}>
                  <td style={tdStyle}>{c.tag}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'pre-line' }}>{c.uhrzeit}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{c.std}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Gesamtstunden */}
      <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: 'bold', marginBottom: '3mm' }}>
        Gesamt: {totalStunden.toFixed(1).replace('.', ',')} Std
      </div>

      {/* USt-Hinweis */}
      <p style={{ fontSize: '8px', marginBottom: '3mm', fontStyle: 'italic' }}>
        Die Leistungen sind nach §4 Nr. 16 Buchst. g UstG von der Umsatzsteuer befreit.
      </p>

      {/* Leistungsart Checkboxen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5mm', fontSize: '9px', marginBottom: '3mm' }}>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={false} /> Kombinationsleistung §38 SGB XI
        </label>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={false} /> Entlastungsleistung §45b SGB XI
        </label>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={false} /> Verhinderungspflege §39 SGB XI
        </label>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={false} /> Haushaltshilfe §38 SGB XI
        </label>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={false} /> Deckeln §45b _____ EUR Rest privat
        </label>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={nachweis.ist_privat} /> Privat
        </label>
        <label style={checkboxLabel}>
          <CheckboxPrint checked={nachweis.abweichende_rechnungsadresse} /> Abweichende Adresse
        </label>
      </div>

      {/* Abtretungserklärung */}
      <div style={{ border: '1px solid #999', padding: '2mm 3mm', fontSize: '7.5px', marginBottom: '4mm', lineHeight: '1.5' }}>
        <p style={{ fontWeight: 'bold', marginBottom: '1mm' }}>Abtretungserklärung</p>
        <p>
          Ich trete hiermit den Anspruch auf Erstattung der Kosten für die o.g. Leistungen an die Alltagshilfe Fischer ab.
          Ich bin damit einverstanden, dass die Alltagshilfe Fischer die Abrechnung direkt mit meiner Pflegekasse vornimmt.
          Diese Abtretung gilt für den o.g. Zeitraum.
        </p>
      </div>

      {/* Unterschriften */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6mm', marginTop: '8mm' }}>
        <div style={{ width: '45%' }}>
          <div style={{ borderBottom: '1px solid #333', height: '15mm', display: 'flex', alignItems: 'flex-end', paddingBottom: '1mm' }}>
            {nachweis.unterschrift_gf_name && (
              <span style={{ fontStyle: 'italic', fontSize: '10px' }}>{nachweis.unterschrift_gf_name}</span>
            )}
          </div>
          <p style={{ fontSize: '8px', marginTop: '1mm' }}>Handzeichen (Alltagshilfe Fischer)</p>
        </div>
        <div style={{ width: '45%' }}>
          <div style={{ borderBottom: '1px solid #333', height: '15mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {nachweis.unterschrift_kunde_bild && (
              <img src={nachweis.unterschrift_kunde_bild} alt="Unterschrift" style={{ maxHeight: '14mm', maxWidth: '100%' }} />
            )}
          </div>
          <p style={{ fontSize: '8px', marginTop: '1mm' }}>Unterschrift Leistungsnehmer</p>
        </div>
      </div>

      {/* Fusszeile */}
      <div style={{ borderTop: '1px solid #999', paddingTop: '2mm', fontSize: '7px', display: 'flex', justifyContent: 'space-between', color: '#666', position: 'absolute', bottom: '10mm', left: '15mm', right: '15mm' }}>
        <span>Alltagshilfe Fischer · Hannover</span>
        <span>IK-Nr.: wird ergänzt</span>
        <span>Bankverbindung: wird ergänzt</span>
      </div>
    </div>
  );
}

// Helper: print checkbox
function CheckboxPrint({ checked }: { checked: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: '3mm', height: '3mm', border: '1px solid #333',
      marginRight: '1.5mm', verticalAlign: 'middle', textAlign: 'center', lineHeight: '3mm', fontSize: '8px'
    }}>
      {checked ? '✓' : ''}
    </span>
  );
}

// Style constants
const thStyle: React.CSSProperties = {
  border: '1px solid #999', padding: '1mm 1.5mm', fontWeight: 'bold',
  textAlign: 'center', backgroundColor: '#f0f0f0', fontSize: '8px',
};
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.8mm 1.5mm', height: '4.5mm',
};
const checkboxLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '1mm',
};

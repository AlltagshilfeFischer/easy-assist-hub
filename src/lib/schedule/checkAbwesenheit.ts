export interface AbwesenheitEntry {
  mitarbeiter_id: string;
  von: string | null;
  bis: string | null;
}

/** Prüft ob ein Mitarbeiter am Datum des Termins abwesend (genehmigt) ist. */
export function checkAbwesenheit(
  mitarbeiterId: string | null,
  startAt: string,
  abwesenheiten: AbwesenheitEntry[],
): boolean {
  if (!mitarbeiterId) return false;
  const dateStr = startAt.slice(0, 10); // 'yyyy-MM-dd'
  return abwesenheiten.some(
    a => a.mitarbeiter_id === mitarbeiterId && a.von && a.bis && dateStr >= a.von && dateStr <= a.bis,
  );
}

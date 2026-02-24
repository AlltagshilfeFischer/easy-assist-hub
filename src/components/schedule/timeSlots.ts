// Generate time slots from 06:00 to 21:30 in 15-minute increments
export const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 21 && m > 30) break;
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

export const DURATION_OPTIONS = [
  { value: 30, label: '30 Minuten' },
  { value: 45, label: '45 Minuten' },
  { value: 60, label: '1 Stunde' },
  { value: 90, label: '1,5 Stunden' },
  { value: 120, label: '2 Stunden' },
  { value: 150, label: '2,5 Stunden' },
  { value: 180, label: '3 Stunden' },
  { value: 240, label: '4 Stunden' },
];

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

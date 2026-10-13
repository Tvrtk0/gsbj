/**
 * Today's opening hours from the CMS's free-text working hours, e.g.
 *   { day: 'Utorak - Petak', hours: '09:00 - 17:00' }
 *   { day: 'Subota - Nedjelja', hours: 'Zatvoreno' }
 * Runs in the browser, since the site is static and "today" is the visitor's.
 */

// Monday-first, as the hours are written; index 0 = Ponedjeljak
const DAYS = ['ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja'];

const dayIndex = (name: string) => DAYS.indexOf(name.trim().toLowerCase());

/** Hours for `date`, as written in the CMS ("09:00 - 17:00", "Zatvoreno"), or null if no entry covers it. */
export function hoursForDate(entries: { day: string; hours: string }[], date: Date): string | null {
  const today = (date.getDay() + 6) % 7; // JS weeks start on Sunday
  for (const { day, hours } of entries) {
    const [from, to = from] = day.split(/\s*[-–]\s*/).map(dayIndex);
    if (from < 0 || to < 0) continue;
    const covers = from <= to ? today >= from && today <= to : today >= from || today <= to;
    if (covers) return hours.trim();
  }
  return null;
}

/** True when the hours say the shop is shut that day. */
export const isClosed = (hours: string) => /zatvoren/i.test(hours);

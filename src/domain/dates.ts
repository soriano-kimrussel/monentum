// Day-key helpers. A "day key" is a local calendar date formatted `YYYY-MM-DD`.
// Working in day keys keeps streak math independent of time-of-day and DST shifts.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export function weekdayOf(key: string): number {
  return parseDayKey(key).getDay();
}

/** Inclusive list of day keys from `start` to `end`. */
export function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

export function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDayKey(parseDayKey(key)) === key;
}

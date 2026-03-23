/**
 * Calendar dates from <input type="date"> are YYYY-MM-DD in the user's local calendar.
 * `Date.parse("YYYY-MM-DD")` is UTC midnight, which shifts the day in most timezones.
 * These helpers use the local timezone so stored timestamps match what the user picked.
 */

export function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Current calendar month in local time, as YYYY-MM (for month pickers / filters). */
export function localYearMonthNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Local midnight for the given YYYY-MM-DD string.
 * Returns null if the string is not a valid calendar date.
 */
export function parseLocalDateYmd(ymd: string): number | null {
  const trimmed = ymd.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const dt = new Date(y, month - 1, day, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt.getTime();
}

/** YYYY-MM for grouping/filtering by the user's local calendar month. */
export function yearMonthFromTimestamp(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** YYYY-MM-DD in local time from a timestamp (for <input type="date">). */
export function timestampToLocalYmd(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

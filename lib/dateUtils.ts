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

/** HH:mm in local time (for <input type="time">, step 60). */
export function timestampToLocalHm(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export function localTimeHm(): string {
  return timestampToLocalHm(Date.now());
}

/**
 * Local instant for YYYY-MM-DD + optional HH:mm (24h, from <input type="time">).
 * Empty or missing time uses start of that local day (00:00).
 */
export function parseLocalDateTimeYmdHm(
  ymd: string,
  hm: string | undefined | null,
): number | null {
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

  let hours = 0;
  let minutes = 0;
  const t = (hm ?? "").trim();
  if (t) {
    const tparts = t.split(":");
    const h = Number(tparts[0]);
    const m = Number(tparts[1]);
    if (
      !Number.isInteger(h) ||
      !Number.isInteger(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    ) {
      return null;
    }
    hours = h;
    minutes = m;
  }

  const dt = new Date(y, month - 1, day, hours, minutes, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt.getTime();
}

/**
 * True when the instant is exactly local midnight (00:00:00.000).
 * Used to guess "date only" vs "specific time" for the optional time UI.
 */
export function isLocalMidnight(ts: number): boolean {
  const d = new Date(ts);
  return (
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0
  );
}

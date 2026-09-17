/**
 * Calendar-date helpers. Planner and streak logic works on plain "YYYY-MM-DD" strings so it never
 * depends on the server's timezone; callers turn "now" into a local date with `todayInTimeZone`.
 */
export type ISODate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const WEEKDAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const WEEKDAY_INITIAL = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(value: ISODate): Date {
  if (!isISODate(value)) throw new RangeError(`Invalid ISO date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: ISODate, days: number): ISODate {
  return toISODate(new Date(parseISODate(value).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

/** Dates from `from` (inclusive) up to `toExclusive`. */
export function dateRange(from: ISODate, toExclusive: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let day = from; day < toExclusive; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(value: ISODate): number {
  return (parseISODate(value).getUTCDay() + 6) % 7;
}

export function startOfWeek(value: ISODate): ISODate {
  return addDays(value, -weekdayIndex(value));
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function todayInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    const iso = `${part("year")}-${part("month")}-${part("day")}`;
    if (isISODate(iso)) return iso;
  } catch {
    // Unknown time zone — fall back to UTC below.
  }
  return toISODate(now);
}

/** "18 Oct 2026" */
export function formatDate(value: ISODate): string {
  const date = parseISODate(value);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "18 Oct" */
export function formatDayMonth(value: ISODate): string {
  const date = parseISODate(value);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

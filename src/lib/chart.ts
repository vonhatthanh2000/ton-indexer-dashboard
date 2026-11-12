export interface MonthBucket {
  key: string; // YYYY-MM (UTC)
  label: string; // "Nov 2026"
  count: number;
}

const MAX_MONTHS = 12;
const label = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** UTC months from the first project's month to now, zero-filled, at most the last 12. */
export function projectsPerMonth(createdAt: string[], now = new Date()): MonthBucket[] {
  if (createdAt.length === 0) return [];
  const indexes = createdAt.map((iso) => monthIndex(new Date(iso)));
  const last = Math.max(monthIndex(now), ...indexes);
  const first = Math.max(Math.min(...indexes), last - MAX_MONTHS + 1);
  const counts = new Map<number, number>();
  for (const index of indexes) counts.set(index, (counts.get(index) ?? 0) + 1);
  const buckets: MonthBucket[] = [];
  for (let index = first; index <= last; index += 1) {
    const date = new Date(Date.UTC(Math.floor(index / 12), index % 12, 1));
    buckets.push({ key: date.toISOString().slice(0, 7), label: label.format(date), count: counts.get(index) ?? 0 });
  }
  return buckets;
}

import { nanoToTon } from "./ton";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en");

/** 1240000 → "1.24M"; under 10 000 the exact grouped number. */
export function compactNumber(value: number): string {
  return Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value);
}

export function exactNumber(value: number): string {
  return integer.format(value);
}

export interface TonText {
  short: string;
  exact: string;
}

// Display only: the exact value always comes from nanoToTon (BigInt).
export function formatTon(nano: string): TonText {
  const exact = nanoToTon(nano);
  const amount = Number(exact);
  let short: string;
  if (amount === 0) short = "0";
  else if (Math.abs(amount) >= 1_000_000) short = compact.format(amount);
  else if (Math.abs(amount) >= 1) short = new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount);
  else if (Math.abs(amount) >= 0.0001) short = new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(amount);
  else short = "<0.0001";
  return { short: `${short} TON`, exact: `${exact} TON (${nano} nanoton)` };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(seconds) < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

const timestamp = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "medium" });

export function fullTimestamp(iso: string): string {
  return timestamp.format(new Date(iso));
}

/** Digits grouped by thin spaces for lt values; string in, string out. */
export function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function shorten(value: string, head = 4, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

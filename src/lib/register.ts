import { toRaw } from "./ton";

export const MAX_ADDRESSES = 100;
const MAX_LT = 9223372036854775807n;
const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)$/;

export interface LineProblem {
  line: number; // 1-based textarea line
  message: string;
}

export interface ParsedAddresses {
  /** Raw addresses in the order they will be sent. */
  addresses: string[];
  /** sent index → textarea line (1-based). */
  lineOf: number[];
  problems: LineProblem[];
  /** A problem with the list as a whole (empty, too many). */
  listProblem: string | null;
}

/** Blank lines dropped; each line normalised to raw before the duplicate check. */
export function parseAddressLines(text: string): ParsedAddresses {
  const addresses: string[] = [];
  const lineOf: number[] = [];
  const problems: LineProblem[] = [];
  const seen = new Map<string, number>();
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const value = rawLine.trim();
    if (!value) return;
    let raw: string;
    try {
      raw = toRaw(value);
    } catch {
      problems.push({ line, message: `Line ${line} is not a valid TON address.` });
      return;
    }
    const first = seen.get(raw);
    if (first !== undefined) {
      problems.push({ line, message: `Line ${line} is a duplicate of line ${first}.` });
      return;
    }
    seen.set(raw, line);
    addresses.push(raw);
    lineOf.push(line);
  });
  let listProblem: string | null = null;
  const count = addresses.length + problems.length;
  if (count === 0) listProblem = "Enter at least one address.";
  else if (count > MAX_ADDRESSES) listProblem = `Enter at most ${MAX_ADDRESSES} addresses (you have ${count}).`;
  return { addresses, lineOf, problems, listProblem };
}

export function validateStartLt(value: string): string | null {
  const lt = value.trim();
  if (!CANONICAL_DECIMAL.test(lt)) return "Start lt must be a whole number without leading zeros.";
  if (BigInt(lt) > MAX_LT) return "Start lt is too large.";
  return null;
}

// ---- file import (CSV / JSON) -----------------------------------------------------------------

export const MAX_IMPORT_BYTES = 1024 * 1024;
const ADDRESS_HEADERS = new Set(["address", "addresses", "account", "wallet"]);

export type ImportResult = { addresses: string[] } | { error: string };

/** Splits one CSV line on `delimiter`, honouring double quotes ("" is a literal quote). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 1 ? counts[0].delimiter : ",";
}

/** CSV: the `address` column when the first row names one, otherwise the first column of every row. */
export function addressesFromCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]);
  const header = splitCsvLine(lines[0], delimiter).map((cell) => cell.toLowerCase());
  const column = header.findIndex((cell) => ADDRESS_HEADERS.has(cell));
  const rows = column >= 0 ? lines.slice(1) : lines;
  return rows
    .map((line) => splitCsvLine(line, delimiter)[Math.max(column, 0)] ?? "")
    .filter((value) => value !== "");
}

function addressOf(item: unknown): string | null {
  if (typeof item === "string") return item.trim() || null;
  if (typeof item === "object" && item !== null && typeof (item as { address?: unknown }).address === "string") {
    return (item as { address: string }).address.trim() || null;
  }
  return null;
}

/** JSON: `["EQ…"]`, `[{ "address": "EQ…" }]`, or either of those under `{ "addresses": … }`. */
export function addressesFromJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "That file is not valid JSON." };
  }
  const list =
    Array.isArray(data) ? data
    : typeof data === "object" && data !== null && Array.isArray((data as { addresses?: unknown }).addresses)
      ? (data as { addresses: unknown[] }).addresses
      : null;
  if (list === null) return { error: 'The JSON must be a list of addresses, or { "addresses": [ … ] }.' };
  const addresses: string[] = [];
  for (const item of list) {
    const address = addressOf(item);
    if (address === null) return { error: 'Each JSON item must be an address string or { "address": "…" }.' };
    addresses.push(address);
  }
  return { addresses };
}

/** Reads the addresses out of an imported file's text; validation happens later, line by line. */
export function addressesFromFile(fileName: string, size: number, text: string): ImportResult {
  if (size > MAX_IMPORT_BYTES) return { error: "That file is larger than 1 MB." };
  const extension = fileName.toLowerCase().split(".").pop();
  const body = text.replace(/^﻿/, "");
  let result: ImportResult;
  if (extension === "json") result = addressesFromJson(body);
  else if (extension === "csv" || extension === "txt") result = { addresses: addressesFromCsv(body) };
  else return { error: "Use a .csv, .json or .txt file." };
  if ("addresses" in result && result.addresses.length === 0) return { error: "No addresses found in that file." };
  return result;
}

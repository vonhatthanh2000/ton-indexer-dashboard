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

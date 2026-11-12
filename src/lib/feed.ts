import type { FeedTransaction, Transaction } from "./types";

export const FEED_MAX_ADDRESSES = 20;
export const FEED_PER_ADDRESS = 10;
export const FEED_ROWS = 10;

export const TRANSACTION_FIELDS = `hash lt utime time traceId inMsgOpcode sender value aborted fee outMsgs { destination value opcode }`;

/** One aliased query; addresses travel as variables, never inside the query text. */
export function buildFeedQuery(addresses: string[]): { query: string; variables: Record<string, string> } | null {
  const picked = addresses.slice(0, FEED_MAX_ADDRESSES);
  if (picked.length === 0) return null;
  const declarations = picked.map((_, index) => `$a${index}: String!`).join(", ");
  const fields = picked
    .map((_, index) => `a${index}: transactions(address: $a${index}, limit: ${FEED_PER_ADDRESS}) { ${TRANSACTION_FIELDS} }`)
    .join("\n  ");
  const variables = Object.fromEntries(picked.map((address, index) => [`a${index}`, address]));
  return { query: `query DashboardFeed(${declarations}) {\n  ${fields}\n}`, variables };
}

function compareDesc(a: string, b: string): number {
  const left = BigInt(a);
  const right = BigInt(b);
  return left === right ? 0 : left > right ? -1 : 1;
}

/** Newest first across addresses: utime desc, then lt desc (BigInt). */
export function mergeFeed(
  data: Record<string, Transaction[] | null | undefined>,
  addresses: string[],
  limit = FEED_ROWS,
): FeedTransaction[] {
  const rows: FeedTransaction[] = [];
  addresses.slice(0, FEED_MAX_ADDRESSES).forEach((account, index) => {
    for (const tx of data[`a${index}`] ?? []) rows.push({ ...tx, account });
  });
  rows.sort((a, b) => compareDesc(a.utime, b.utime) || compareDesc(a.lt, b.lt));
  return rows.slice(0, limit);
}

import type { Transaction, TransactionCursor } from "./types";

/** Rows on the dashboard's "Latest transactions" card. */
export const FEED_ROWS = 10;
/** Live refresh of the newest page (the API's worker usually stores new rows within seconds). */
export const LIVE_POLL_MS = 5_000;

export const TRANSACTION_FIELDS = `account hash lt utime time traceId inMsgOpcode sender value aborted fee outMsgs { destination value opcode }`;

/** Every address of a project, newest first; page with `before` = the last row's cursor. */
export const PROJECT_TRANSACTIONS_QUERY = `query DashboardProjectTransactions($id: String!, $limit: Int!, $before: TransactionCursor) {
  projectTransactions(id: $id, limit: $limit, before: $before) { ${TRANSACTION_FIELDS} }
}`;

/** One address, newest first; page with `beforeLt` = the last row's lt. */
export const ADDRESS_TRANSACTIONS_QUERY = `query DashboardTransactions($address: String!, $limit: Int!, $beforeLt: String) {
  transactions(address: $address, limit: $limit, beforeLt: $beforeLt) { ${TRANSACTION_FIELDS} }
}`;

/** The cursor for the page after `page`, or undefined when a short page means there is nothing older. */
export function nextCursor(page: Transaction[], limit: number): TransactionCursor | undefined {
  if (page.length < limit) return undefined;
  const last = page[page.length - 1];
  return { utime: last.utime, lt: last.lt, account: last.account };
}

/** Polls only while the first page alone is loaded, so "Load more" pages are not refetched every 5 s. */
export function livePollInterval(pagesLoaded: number | undefined): number | false {
  return pagesLoaded === 1 ? LIVE_POLL_MS : false;
}

export interface Page<T> {
  rows: T[];
  page: number; // 1-based, clamped
  pageCount: number;
  total: number;
}

export function paginate<T>(rows: T[], page: number, size: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), page: current, pageCount, total: rows.length };
}

export function filterBy<T>(rows: T[], query: string, fields: (row: T) => (string | null | undefined)[]): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => fields(row).some((value) => value?.toLowerCase().includes(needle)));
}

/** Server pages: there is a next page only when this one came back full. */
export function hasNextPage(rowsOnPage: number, limit: number): boolean {
  return rowsOnPage >= limit;
}

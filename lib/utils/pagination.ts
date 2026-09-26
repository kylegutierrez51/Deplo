/*
 * Offset pagination for the list pages. The URL carries a 1-based `?page=`, the reader
 * counts the filtered rows first, clamps the page against that count, then fetches one
 * window with skip/take.
 *
 * Offset rather than cursor because the UI offers numbered jumps ("1 … 8 9 10 … 22"),
 * which need random access, and shows "Showing 81–90 of 214", which needs the count anyway.
 */

export const DEFAULT_PAGE_SIZE = 10;

export type Page<T> = {
  rows: T[];
  total: number;
  /* The page actually served: the requested one, clamped to [1, pageCount] */
  page: number;
  pageCount: number;
  pageSize: number;
};

export type PageItem = number | '...';

type RawParam = string | string[] | undefined;


// parses `?page=x` and returns a page number. If x is negative or not a safe integer, fall back to page 1. If x is positive and a safe integer, return x.
export function parsePage(raw: RawParam): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/*
 * Clamps against pageCount so a page that no longer exists
 * returns the last page rather than an empty table.
 * An empty set still has one page, so `page` is always >= 1 and `skip` never goes negative.
 */
export function pageWindow(page: number, total: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);

  return {
    page: clamped,
    pageCount,
    pageSize,
    skip: (clamped - 1) * pageSize,
    take: pageSize,
  };
}

/*
 * First, last, and the current page with one neighbour either side, e.g. 9 of 22 gives
 * [1, '...', 8, 9, 10, '...', 22]. A gap hiding exactly one page shows that page instead,
 * since an ellipsis would take the same space and say less.
 */
export function pageRange(current: number, pageCount: number): PageItem[] {
  const shown = [...new Set([1, current - 1, current, current + 1, pageCount])]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  for (const page of shown) {
    const previous = items.at(-1);
    if (typeof previous === 'number' && page - previous === 2) items.push(page - 1);
    else if (typeof previous === 'number' && page - previous > 2) items.push('...');
    items.push(page);
  }
  return items;
}
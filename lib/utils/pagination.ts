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
returns list of pages

examples for each condition (in order):
 1. [1, 2, 3, 4, 5]
 2. [1, ..., 4, 5, 6, ..., 9]
 3. [1, ..., 5, 6, 7, 8, 9]
 4. [1, 2, 3, 4, 5, ..., 9]
*/
export function pageRange(current: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    const range: PageItem[] = [];
    for (let i = 1; i <= pageCount; i++) {
      range.push(i);
    }
    return range;
  }

  const left = 1 + 3;
  const right = pageCount - 3;

  if (current > left && current < right) {
    return [1, "...", current - 1, current, current + 1, "...", pageCount];
  }
  else if(current >= right) {
    const range: PageItem[] = [1, "...", current - 1];
    for (let i = current; i <= pageCount; i++) {
      range.push(i);
    }
    return range;
  }
  else { // current <= left
    const range: PageItem[] = [];
    for (let i = 1; i <= current + 1; i++) {
      range.push(i);
    }
    range.push("...", pageCount)
    return range;
  }
}
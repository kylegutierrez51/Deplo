import { pageRange, pageWindow, parsePage } from '@/lib/utils/pagination';

describe('parsePage', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['3', 3],
    ['0', 1],
    ['-3', 1],
    ['abc', 1],
    ['2.5', 1],
    ['1e3', 1],
    ['99999999999999999999', 1],
  ])('reads %p as page %p', (raw, expected) => {
    expect(parsePage(raw)).toBe(expected);
  });

  // Next hands a repeated key over as an array, the same case parseFilters handles.
  it('keeps only the first of a repeated key', () => {
    expect(parsePage(['2', '5'])).toBe(2);
  });
});

describe('pageWindow', () => {
  it('turns a page into skip/take', () => {
    expect(pageWindow(3, 95, 10)).toEqual({ page: 3, pageCount: 10, pageSize: 10, skip: 20, take: 10 });
  });

  it('clamps a page past the end to the last page', () => {
    expect(pageWindow(99, 25, 10)).toMatchObject({ page: 3, pageCount: 3, skip: 20 });
  });

  it('serves one empty page for an empty set rather than a negative skip', () => {
    expect(pageWindow(4, 0, 10)).toMatchObject({ page: 1, pageCount: 1, skip: 0 });
  });

  it('counts a partial last page as a page', () => {
    expect(pageWindow(1, 11, 10).pageCount).toBe(2);
  });

  it('defaults to ten rows a page', () => {
    expect(pageWindow(2, 50)).toMatchObject({ skip: 10, take: 10, pageSize: 10 });
  });
});

describe('pageRange', () => {
  it('shows a single page on its own', () => {
    expect(pageRange(1, 1)).toEqual([1]);
  });

  it('elides both sides of a page in the middle', () => {
    expect(pageRange(9, 22)).toEqual([1, '...', 8, 9, 10, '...', 22]);
  });

  it('elides only the far side at the start', () => {
    expect(pageRange(1, 22)).toEqual([1, 2, '...', 22]);
  });

  it('elides only the far side at the end', () => {
    expect(pageRange(22, 22)).toEqual([1, '...', 21, 22]);
  });

  // An ellipsis standing in for exactly one page takes the same room and hides it.
  it('shows the page rather than an ellipsis when the gap is one page', () => {
    expect(pageRange(4, 22)).toEqual([1, 2, 3, 4, 5, '...', 22]);
    expect(pageRange(19, 22)).toEqual([1, '...', 18, 19, 20, 21, 22]);
  });

  it('lists every page when there are few enough', () => {
    expect(pageRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  /*
   * Six and seven pages are too few for the middle shape, so the start and end shapes
   * meet there. Collapsing them anyway gave [1, '...', 2, 3, 4, 5, 6] for page 3 of 6,
   * an ellipsis hiding nothing, and [1, '...', 3, ...] for page 4, one hiding only page 2.
   */
  it('lists every page up to seven, where collapsing would hide one page or none', () => {
    expect(pageRange(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageRange(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('starts collapsing at eight pages', () => {
    expect(pageRange(4, 8)).toEqual([1, 2, 3, 4, 5, '...', 8]);
    expect(pageRange(5, 8)).toEqual([1, '...', 4, 5, 6, 7, 8]);
  });

  // Collected rather than asserted in the loop, so a failure names every page that produced one.
  it('never uses an ellipsis for fewer than two pages', () => {
    const offenders: string[] = [];

    for (let pageCount = 1; pageCount <= 30; pageCount++) {
      for (let current = 1; current <= pageCount; current++) {
        const items = pageRange(current, pageCount);
        items.forEach((item, i) => {
          if (item !== '...') return;
          const hidden = (items[i + 1] as number) - (items[i - 1] as number) - 1;
          if (hidden < 2) offenders.push(`page ${current} of ${pageCount}: ${JSON.stringify(items)}`);
        });
      }
    }

    expect(offenders).toEqual([]);
  });
});

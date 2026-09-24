import { withParams } from '@/lib/utils/url';

describe('withParams', () => {
  it('adds a param to an empty query', () => {
    expect(withParams('/runs', new URLSearchParams(), { id: 'run-1' })).toBe('/runs?id=run-1');
  });

  it('keeps the params it was not asked to change', () => {
    expect(withParams('/runs', new URLSearchParams('status=failed'), { id: 'run-1' }))
      .toBe('/runs?status=failed&id=run-1');
  });

  it('overwrites a param that is already set', () => {
    expect(withParams('/runs', new URLSearchParams('id=a&mode=edit'), { mode: 'view' }))
      .toBe('/runs?id=a&mode=view');
  });

  it('removes a param updated to null', () => {
    expect(withParams('/runs', new URLSearchParams('status=failed&id=run-1&mode=edit'), { id: null, mode: null }))
      .toBe('/runs?status=failed');
  });

  it('returns the bare path when nothing is left', () => {
    expect(withParams('/runs', new URLSearchParams('id=run-1'), { id: null })).toBe('/runs');
  });

  it('treats a missing query as empty', () => {
    expect(withParams('/runs', null, { mode: 'create' })).toBe('/runs?mode=create');
  });
});

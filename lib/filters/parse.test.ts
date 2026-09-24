import { dateRangeCutoff, hasActiveFilters, invert, parseFilters } from '@/lib/filters/parse';
import { RUN_FILTERS } from '@/lib/filters/options';

const DEFAULTS = { status: 'all', trigger: 'all', environment: 'all', recency: 'most-recent' };

describe('parseFilters', () => {
  it('falls back to each list\'s first option when the params are absent', () => {
    expect(parseFilters({}, RUN_FILTERS)).toEqual(DEFAULTS);
  });

  it('keeps values the options offer', () => {
    expect(parseFilters({ status: 'failed', recency: 'least-recent' }, RUN_FILTERS)).toEqual({
      ...DEFAULTS,
      status: 'failed',
      recency: 'least-recent',
    });
  });

  it('drops a value the options do not offer', () => {
    expect(parseFilters({ status: 'FAILED', trigger: 'cron' }, RUN_FILTERS)).toEqual(DEFAULTS);
  });

  it('reads the first of a repeated key', () => {
    expect(parseFilters({ status: ['running', 'failed'] }, RUN_FILTERS).status).toBe('running');
  });

  it('ignores params that are not filters', () => {
    expect(parseFilters({ id: 'abc', mode: 'edit' }, RUN_FILTERS)).toEqual(DEFAULTS);
  });
});

describe('hasActiveFilters', () => {
  it('is false when every filter is on its default', () => {
    expect(hasActiveFilters(parseFilters({}, RUN_FILTERS), RUN_FILTERS)).toBe(false);
  });

  it('is true when any filter is off its default', () => {
    expect(hasActiveFilters(parseFilters({ recency: 'least-recent' }, RUN_FILTERS), RUN_FILTERS)).toBe(true);
  });
});

describe('invert', () => {
  it('swaps keys and values', () => {
    expect(invert({ QUEUED: 'queued', RUNNING: 'running' } as const)).toEqual({ queued: 'QUEUED', running: 'RUNNING' });
  });
});

describe('dateRangeCutoff', () => {
  const now = new Date('2026-09-22T15:30:00Z');

  it('has no cutoff for all time', () => {
    expect(dateRangeCutoff('all', now)).toBeUndefined();
  });

  it('cuts off at midnight UTC for today', () => {
    expect(dateRangeCutoff('today', now)).toEqual(new Date('2026-09-22T00:00:00Z'));
  });

  it('counts whole days back from now', () => {
    expect(dateRangeCutoff('7days', now)).toEqual(new Date('2026-09-15T15:30:00Z'));
    expect(dateRangeCutoff('90days', now)).toEqual(new Date('2026-06-24T15:30:00Z'));
  });
});

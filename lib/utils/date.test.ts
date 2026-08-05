import { formatDate, getDuration } from '@/lib/utils/date';

/*
 * formatDate goes through toLocaleString('en-US'), so its output depends on the
 * process time zone. test/setup-env.mjs pins TZ=UTC; without that these pass on
 * a developer machine and fail on a CI runner.
 */

const at = (iso: string) => new Date(iso);

describe('formatDate', () => {
  it('renders a 2-digit year and a 24-hour clock', () => {
    expect(formatDate(at('2026-08-03T14:05:09Z'))).toBe('8/3/26, 14:05:09');
  });

  it('uses 24-hour time rather than am/pm past noon', () => {
    const formatted = formatDate(at('2026-01-15T23:59:59Z'));

    expect(formatted).toBe('1/15/26, 23:59:59');
    expect(formatted).not.toMatch(/[AP]M/i);
  });

  it('renders midnight as 00, not 24', () => {
    expect(formatDate(at('2026-01-15T00:00:00Z'))).toBe('1/15/26, 00:00:00');
  });

  it('does not zero-pad the month or day', () => {
    expect(formatDate(at('2026-03-05T08:00:00Z'))).toBe('3/5/26, 08:00:00');
  });
});

describe('getDuration', () => {
  it.each([
    ['seconds only', '2026-01-01T00:00:00Z', '2026-01-01T00:00:45Z', '45s'],
    ['a whole minute drops the seconds', '2026-01-01T00:00:00Z', '2026-01-01T00:02:00Z', '2m'],
    ['minutes and seconds', '2026-01-01T00:00:00Z', '2026-01-01T00:02:30Z', '2m 30s'],
    ['hours and minutes', '2026-01-01T00:00:00Z', '2026-01-01T03:15:00Z', '3h 15m'],
    ['hours drop the seconds', '2026-01-01T00:00:00Z', '2026-01-01T03:15:45Z', '3h 15m'],
    ['days and hours', '2026-01-01T00:00:00Z', '2026-01-03T05:00:00Z', '2d 5h'],
    ['days drop the minutes', '2026-01-01T00:00:00Z', '2026-01-03T05:42:00Z', '2d 5h'],
  ])('formats %s', (_label, start, end, expected) => {
    expect(getDuration(at(start), at(end))).toBe(expected);
  });

  it('renders a zero-length run as 0s', () => {
    expect(getDuration(at('2026-01-01T00:00:00Z'), at('2026-01-01T00:00:00Z'))).toBe('0s');
  });

  // A run whose finishedAt precedes its startedAt is a clock-skew artifact, not
  // something the UI should render as a negative duration.
  it('clamps a negative interval to 0s', () => {
    expect(getDuration(at('2026-01-01T01:00:00Z'), at('2026-01-01T00:00:00Z'))).toBe('0s');
  });

  it('floors sub-second remainders rather than rounding up', () => {
    expect(getDuration(at('2026-01-01T00:00:00.000Z'), at('2026-01-01T00:00:01.999Z'))).toBe('1s');
  });

  it('rolls exactly 60 seconds over into a minute', () => {
    expect(getDuration(at('2026-01-01T00:00:00Z'), at('2026-01-01T00:01:00Z'))).toBe('1m');
  });

  it('counts a multi-day run in days, not hours', () => {
    expect(getDuration(at('2026-01-01T00:00:00Z'), at('2026-01-11T00:00:00Z'))).toBe('10d 0h');
  });

  describe('with no end parameter', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    // This is the in-flight case: RunDetail renders a running stage's elapsed
    // time by calling getDuration with only a start.
    it('measures against now', () => {
      jest.setSystemTime(at('2026-01-01T00:05:00Z'));

      expect(getDuration(at('2026-01-01T00:00:00Z'))).toBe('5m');
    });

    it('grows as time passes', () => {
      jest.setSystemTime(at('2026-01-01T00:00:10Z'));
      const start = at('2026-01-01T00:00:00Z');
      expect(getDuration(start)).toBe('10s');

      jest.setSystemTime(at('2026-01-01T00:01:40Z'));
      expect(getDuration(start)).toBe('1m 40s');
    });
  });
});

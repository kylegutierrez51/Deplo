import { replayBlocker } from '@/lib/webhooks/replay';

type Event = Parameters<typeof replayBlocker>[0];

const replayable = (over: Partial<Event> = {}): Event => ({
  status: 'PROCESSED',
  eventType: 'PUSH',
  payload: { ref: 'refs/heads/main' },
  webhook: { isActive: true },
  ...over,
});

describe('replayBlocker', () => {
  it('returns null for a processed push with a payload and an active webhook', () => {
    expect(replayBlocker(replayable())).toBeNull();
  });

  it('returns null for a failed pull request event', () => {
    expect(replayBlocker(replayable({ status: 'FAILED', eventType: 'PULL_REQUEST' }))).toBeNull();
  });

  it('blocks an event that is still pending', () => {
    expect(replayBlocker(replayable({ status: 'PENDING' }))).toBe('This event is still being processed.');
  });

  it.each(['PING', 'UNRECOGNIZED'] as const)('blocks a %s event', (eventType) => {
    expect(replayBlocker(replayable({ eventType }))).toBe('Only push and pull request events can be replayed.');
  });

  it('blocks an event whose payload was not kept', () => {
    expect(replayBlocker(replayable({ payload: null }))).toBe(
      'This event was ignored, so its payload was not kept and it cannot be replayed.'
    );
  });

  it('blocks an event whose webhook is gone', () => {
    expect(replayBlocker(replayable({ webhook: null }))).toBe('The webhook this event arrived on no longer exists.');
  });

  it('blocks an event whose webhook is inactive', () => {
    expect(replayBlocker(replayable({ webhook: { isActive: false } }))).toBe(
      'This webhook is inactive. Activate it to replay its events.'
    );
  });

  it('reports PENDING before a missing payload', () => {
    expect(replayBlocker(replayable({ status: 'PENDING', payload: null }))).toBe('This event is still being processed.');
  });

  it('reports a wrong event type before a missing payload', () => {
    expect(replayBlocker(replayable({ eventType: 'PING', payload: null }))).toBe(
      'Only push and pull request events can be replayed.'
    );
  });

  it('reports a missing payload before a missing webhook', () => {
    expect(replayBlocker(replayable({ payload: null, webhook: null }))).toBe(
      'This event was ignored, so its payload was not kept and it cannot be replayed.'
    );
  });

  it('reports a missing webhook before an inactive one', () => {
    expect(replayBlocker(replayable({ webhook: null }))).toBe('The webhook this event arrived on no longer exists.');
  });
});

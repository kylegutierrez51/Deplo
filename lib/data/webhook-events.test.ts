import { getWebhookEvents, getWebhookEventById } from '@/lib/data/webhook-events';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

/*
 * Note this module imports the singleton as '../prisma' rather than
 * '@/lib/prisma' like every other data file. Both resolve to the same file, so
 * the mock intercepts either — these tests are what proves it.
 */
jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

/*
 * groupBy's Prisma signature is a heavily-overloaded generic, so jest-mock-extended
 * cannot surface mockResolvedValue on it through the type system. It is a jest.fn
 * at runtime like everything else on the deep mock; this narrows it to one.
 */
const groupByMock = () => prismaMock.webhookEvent.groupBy as unknown as jest.Mock;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'evt-1',
  pipelineId: 'p1',
  eventType: 'PUSH' as const,
  source: 'github',
  payload: {},
  headers: {},
  status: 'PENDING' as const,
  runId: null,
  receivedAt: new Date('2026-01-01T00:00:00Z'),
  pipeline: { name: 'CI', repoUrl: 'https://github.com/o/r' },
  ...over,
});

/** The seeded shape of a GitHub push payload. */
const pushPayload = {
  after: 'abc123',
  ref: 'refs/heads/main',
  head_commit: { message: 'fix the thing' },
};

describe('getWebhookEvents counts', () => {
  // groupBy only returns statuses that actually occur, so the four buckets are
  // pre-zeroed — otherwise the UI would render undefined for an unused status.
  it('zero-fills every status when there are no events', async () => {
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);
    groupByMock().mockResolvedValue([] as never);

    const { counts } = await getWebhookEvents();

    expect(counts).toEqual({ pending: 0, processed: 0, ignored: 0, failed: 0 });
  });

  it('zero-fills the statuses groupBy did not return', async () => {
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);
    groupByMock().mockResolvedValue([
      { status: 'PROCESSED', _count: 7 },
    ] as never);

    const { counts } = await getWebhookEvents();

    expect(counts).toEqual({ pending: 0, processed: 7, ignored: 0, failed: 0 });
  });

  it('maps every uppercase status key to its lowercase bucket', async () => {
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);
    groupByMock().mockResolvedValue([
      { status: 'PENDING', _count: 1 },
      { status: 'PROCESSED', _count: 2 },
      { status: 'IGNORED', _count: 3 },
      { status: 'FAILED', _count: 4 },
    ] as never);

    const { counts } = await getWebhookEvents();

    expect(counts).toEqual({ pending: 1, processed: 2, ignored: 3, failed: 4 });
  });
});

describe('getWebhookEvents payload extraction', () => {
  const eventsFrom = async (payload: unknown) => {
    prismaMock.webhookEvent.findMany.mockResolvedValue([row({ payload })] as never);
    groupByMock().mockResolvedValue([] as never);
    const { events } = await getWebhookEvents();
    return events[0];
  };

  it('digs the commit, message and ref out of a GitHub push payload', async () => {
    const event = await eventsFrom(pushPayload);

    expect(event).toMatchObject({
      commitSha: 'abc123',
      commitMessage: 'fix the thing',
      branch: 'refs/heads/main',
    });
  });

  // A pull_request payload has none of these keys, and a delivery can be stored
  // before it is understood, so every extraction has to tolerate absence.
  it('yields nulls for a payload without commit fields', async () => {
    const event = await eventsFrom({ action: 'opened' });

    expect(event).toMatchObject({ commitSha: null, commitMessage: null, branch: null });
  });

  it('yields nulls for an empty payload', async () => {
    const event = await eventsFrom({});

    expect(event).toMatchObject({ commitSha: null, commitMessage: null, branch: null });
  });

  it('yields a null message when head_commit is present but empty', async () => {
    const event = await eventsFrom({ after: 'abc', head_commit: {} });

    expect(event).toMatchObject({ commitSha: 'abc', commitMessage: null });
  });
});

describe('getWebhookEvents translation', () => {
  const single = async (over: Record<string, unknown>) => {
    prismaMock.webhookEvent.findMany.mockResolvedValue([row(over)] as never);
    groupByMock().mockResolvedValue([] as never);
    const { events } = await getWebhookEvents();
    return events[0];
  };

  it.each([
    ['PENDING', 'pending'],
    ['PROCESSED', 'processed'],
    ['IGNORED', 'ignored'],
    ['FAILED', 'failed'],
  ])('lowercases status %s', async (prismaStatus, expected) => {
    expect((await single({ status: prismaStatus })).status).toBe(expected);
  });

  // PULL_REQUEST becomes the hyphenated 'pull-request' the Pill variant expects,
  // not 'pull_request'.
  it.each([
    ['PUSH', 'push'],
    ['PULL_REQUEST', 'pull-request'],
  ])('maps event type %s to %s', async (prismaType, expected) => {
    expect((await single({ eventType: prismaType })).eventType).toBe(expected);
  });

  // Webhook.pipelineId is SetNull, so a delivery outliving its pipeline is real.
  it('tolerates a delivery whose pipeline was deleted', async () => {
    expect((await single({ pipeline: null, pipelineId: null })).pipeline).toBeNull();
  });

  it('orders newest first', async () => {
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);
    groupByMock().mockResolvedValue([] as never);

    await getWebhookEvents();

    expect(prismaMock.webhookEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { receivedAt: 'desc' } }),
    );
  });
});

describe('getWebhookEventById', () => {
  it('returns null for an id that does not exist', async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null as never);

    await expect(getWebhookEventById('nope')).resolves.toBeNull();
  });

  // The extraction is duplicated between the two functions, so the detail view
  // is asserted independently rather than assumed to match the list.
  it('performs the same translation as the list query', async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(
      row({ payload: pushPayload, status: 'FAILED', eventType: 'PULL_REQUEST' }) as never,
    );

    const event = await getWebhookEventById('evt-1');

    expect(event).toMatchObject({
      status: 'failed',
      eventType: 'pull-request',
      commitSha: 'abc123',
      commitMessage: 'fix the thing',
      branch: 'refs/heads/main',
    });
  });
});

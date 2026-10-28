import { getWebhookById, getWebhooksPage } from '@/lib/data/webhooks';
import { parseFilters } from '@/lib/filters/parse';
import { WEBHOOK_FILTERS } from '@/lib/filters/options';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

beforeEach(() => {
  resetPrismaMock();
  prismaMock.webhook.findMany.mockResolvedValue([]);
  prismaMock.webhook.count.mockResolvedValue(0);
});

const queryFor = async (params: Record<string, string>) => {
  await getWebhooksPage(parseFilters(params, WEBHOOK_FILTERS));
  return prismaMock.webhook.findMany.mock.calls[0][0];
};

describe('getWebhooksPage filtering', () => {
  it('adds no condition and sorts newest first by default', async () => {
    const query = await queryFor({});

    expect(query?.where).toEqual({});
    expect(query?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('maps active and inactive onto the isActive flag', async () => {
    expect((await queryFor({ active: 'active' }))?.where).toEqual({ isActive: true });

    prismaMock.webhook.findMany.mockClear();
    expect((await queryFor({ active: 'inactive' }))?.where).toEqual({ isActive: false });
  });

  it('sorts oldest first for least-recent', async () => {
    expect((await queryFor({ recency: 'least-recent' }))?.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('sorts by latest delivery, never-delivered last, for delivered-recent', async () => {
    expect((await queryFor({ recency: 'delivered-recent' }))?.orderBy).toEqual([
      { lastDelivery: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' },
    ]);
  });

  it('sorts by oldest delivery, never-delivered first, for delivered-least', async () => {
    expect((await queryFor({ recency: 'delivered-least' }))?.orderBy).toEqual([
      { lastDelivery: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }, { id: 'desc' },
    ]);
  });

  it('falls back to newest registered for an unrecognised sort', async () => {
    expect((await queryFor({ recency: 'nope' }))?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});

describe('the pipeline repo URL', () => {
  const row = (repoUrl: string | null) => ({
    id: 'wh-1', events: ['PUSH'], pipeline: { name: 'deploy-api', repoUrl }, environment: null, createdBy: null,
  });

  it('selects it with the pipeline name and returns it as pipelineRepoUrl on the page', async () => {
    prismaMock.webhook.findMany.mockResolvedValue([row('https://github.com/org/repo')] as never);
    prismaMock.webhook.count.mockResolvedValue(1);

    const { rows } = await getWebhooksPage();

    expect(prismaMock.webhook.findMany.mock.calls[0][0]?.include?.pipeline).toEqual({ select: { name: true, repoUrl: true } });
    expect(rows[0].pipelineRepoUrl).toBe('https://github.com/org/repo');
  });

  it('returns it as pipelineRepoUrl from getWebhookById, null when the pipeline has none', async () => {
    prismaMock.webhook.findUnique.mockResolvedValue(row(null) as never);

    const webhook = await getWebhookById('wh-1');

    expect(prismaMock.webhook.findUnique.mock.calls[0][0]?.include?.pipeline).toEqual({ select: { name: true, repoUrl: true } });
    expect(webhook?.pipelineRepoUrl).toBeNull();
  });
});

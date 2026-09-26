import { getWebhooksPage } from '@/lib/data/webhooks';
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
});

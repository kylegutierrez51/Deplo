import { getRunsPage, countActiveRuns } from '@/lib/data/runs';
import { parseFilters } from '@/lib/filters/parse';
import { RUN_FILTERS } from '@/lib/filters/options';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

beforeEach(() => {
  resetPrismaMock();
  prismaMock.pipelineRun.findMany.mockResolvedValue([]);
  prismaMock.pipelineRun.count.mockResolvedValue(0);
});

/*
 * What reaches Prisma is the contract here: the lowercase URL values have to come out
 * as the UPPERCASE enums, and 'all' has to mean "no condition" rather than a condition
 * nothing matches. Whether Postgres honours the where clause is the integration tier's job.
 */
const queryFor = async (params: Record<string, string>) => {
  await getRunsPage(parseFilters(params, RUN_FILTERS));
  return prismaMock.pipelineRun.findMany.mock.calls[0][0];
};

describe('getRunsPage filtering', () => {
  it('adds no condition and sorts newest first by default', async () => {
    const query = await queryFor({});

    expect(query?.where).toEqual({});
    expect(query?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('translates each filter into its Prisma enum', async () => {
    const query = await queryFor({ status: 'failed', trigger: 'webhook', environment: 'staging' });

    expect(query?.where).toEqual({
      status: 'FAILED',
      trigger: 'WEBHOOK',
      environment: { type: 'STAGING' },
    });
  });

  it('sorts oldest first for least-recent', async () => {
    const query = await queryFor({ recency: 'least-recent' });

    expect(query?.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('queries unfiltered when called with no filters', async () => {
    await getRunsPage();

    expect(prismaMock.pipelineRun.findMany.mock.calls[0][0]?.where).toEqual({});
  });
});

describe('countActiveRuns', () => {
  it('counts running runs regardless of any filter', async () => {
    prismaMock.pipelineRun.count.mockResolvedValue(3);

    await expect(countActiveRuns()).resolves.toBe(3);
    expect(prismaMock.pipelineRun.count).toHaveBeenCalledWith({ where: { status: 'RUNNING' } });
  });
});

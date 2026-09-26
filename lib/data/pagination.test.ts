import { getApprovalsPage } from '@/lib/data/approvals';
import { getAuditsPage } from '@/lib/data/audits';
import { getEnvironmentsPage } from '@/lib/data/environments';
import { getPipelinesPage } from '@/lib/data/pipelines';
import { getRunsPage } from '@/lib/data/runs';
import { getSecretsPage } from '@/lib/data/secrets';
import { getWebhookEventsPage } from '@/lib/data/webhook-events';
import { getWebhooksPage } from '@/lib/data/webhooks';
import { parseFilters } from '@/lib/filters/parse';
import {
  APPROVAL_FILTERS, AUDIT_FILTERS, ENVIRONMENT_FILTERS, PIPELINE_FILTERS,
  RUN_FILTERS, SECRET_FILTERS, WEBHOOK_EVENT_FILTERS, WEBHOOK_FILTERS,
} from '@/lib/filters/options';
import type { Page } from '@/lib/utils/pagination';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

/*
 * Every list reader shares one contract, so it is pinned once here rather than eight
 * times: count the filtered set, clamp the page against it, then fetch that window
 * under the same filter, with `id` breaking createdAt ties so rows cannot swap
 * between pages from one query to the next. The per-reader files cover what each one
 * filters on and how it maps rows.
 */
type Delegate = { count: jest.Mock; findMany: jest.Mock };

const readers: [string, () => Delegate, (page: number) => Promise<Page<unknown>>][] = [
  ['getApprovalsPage', () => prismaMock.stageResult as never, (p) => getApprovalsPage(parseFilters({ environment: 'production' }, APPROVAL_FILTERS), p)],
  ['getAuditsPage', () => prismaMock.auditLog as never, (p) => getAuditsPage(parseFilters({ resource: 'secret' }, AUDIT_FILTERS), p)],
  ['getEnvironmentsPage', () => prismaMock.environment as never, (p) => getEnvironmentsPage(parseFilters({ environment: 'staging' }, ENVIRONMENT_FILTERS), p)],
  ['getPipelinesPage', () => prismaMock.pipeline as never, (p) => getPipelinesPage(parseFilters({ status: 'idle' }, PIPELINE_FILTERS), p)],
  ['getRunsPage', () => prismaMock.pipelineRun as never, (p) => getRunsPage(parseFilters({ status: 'failed' }, RUN_FILTERS), p)],
  ['getSecretsPage', () => prismaMock.secret as never, (p) => getSecretsPage(parseFilters({ environment: 'production' }, SECRET_FILTERS), p)],
  ['getWebhookEventsPage', () => prismaMock.webhookEvent as never, (p) => getWebhookEventsPage(parseFilters({ status: 'failed' }, WEBHOOK_EVENT_FILTERS), p)],
  ['getWebhooksPage', () => prismaMock.webhook as never, (p) => getWebhooksPage(parseFilters({ active: 'active' }, WEBHOOK_FILTERS), p)],
];

beforeEach(() => {
  resetPrismaMock();
  // approvals looks up commit messages, webhook events counts statuses; both are incidental here
  prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);
  // groupBy's overloads hide mockResolvedValue from the types; see webhook-events.test.ts
  (prismaMock.webhookEvent.groupBy as unknown as jest.Mock).mockResolvedValue([]);
});

describe.each(readers)('%s', (_name, delegate, read) => {
  beforeEach(() => {
    delegate().count.mockResolvedValue(25);
    delegate().findMany.mockResolvedValue([]);
  });

  const query = () => delegate().findMany.mock.calls[0][0];

  it('fetches the requested window', async () => {
    const page = await read(2);

    expect(query()).toMatchObject({ skip: 10, take: 10 });
    expect(page).toMatchObject({ total: 25, page: 2, pageCount: 3, pageSize: 10 });
  });

  it('counts under the same filter it fetches with', async () => {
    await read(1);

    expect(delegate().count).toHaveBeenCalledWith({ where: query().where });
    expect(query().where).not.toEqual({});
  });

  it('clamps a page past the end to the last page', async () => {
    const page = await read(99);

    expect(query()).toMatchObject({ skip: 20 });
    expect(page.page).toBe(3);
  });

  it('breaks timestamp ties on id so a row belongs to exactly one page', async () => {
    await read(1);

    expect(query().orderBy.at(-1)).toEqual({ id: expect.stringMatching(/^(asc|desc)$/) });
  });
});

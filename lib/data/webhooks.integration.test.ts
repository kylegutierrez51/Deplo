import { getWebhooksPage } from '@/lib/data/webhooks';
import { parseFilters } from '@/lib/filters/parse';
import { WEBHOOK_FILTERS } from '@/lib/filters/options';
import { makeWebhook } from '@/test/integration/factories';

/*
 * Where Postgres puts NULLs is the database's call, not Prisma's: left to itself it sorts
 * them first when descending. The unit tier only pins the orderBy we send, so whether a
 * never-delivered webhook really lands where the sort promises is only visible here.
 */

const orderFor = async (recency: string) =>
  (await getWebhooksPage(parseFilters({ recency }, WEBHOOK_FILTERS))).rows.map((w) => w.id);

const setup = async () => {
  const older = await makeWebhook({ lastDelivery: new Date('2026-01-01T00:00:00Z') });
  const newer = await makeWebhook({ lastDelivery: new Date('2026-06-01T00:00:00Z') });
  const never = await makeWebhook({ lastDelivery: null });
  return { older, newer, never };
};

describe('sorting webhooks by delivery', () => {
  it('puts the latest delivery first and a never-delivered webhook last', async () => {
    const { older, newer, never } = await setup();

    expect(await orderFor('delivered-recent')).toEqual([newer.id, older.id, never.id]);
  });

  it('puts a never-delivered webhook first, then the oldest delivery', async () => {
    const { older, newer, never } = await setup();

    expect(await orderFor('delivered-least')).toEqual([never.id, older.id, newer.id]);
  });

  it('breaks a tie between never-delivered webhooks by newest registered', async () => {
    const first = await makeWebhook({ createdAt: new Date('2026-01-01T00:00:00Z') });
    const second = await makeWebhook({ createdAt: new Date('2026-02-01T00:00:00Z') });

    expect(await orderFor('delivered-recent')).toEqual([second.id, first.id]);
  });
});

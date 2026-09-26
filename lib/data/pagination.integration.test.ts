import prisma from '@/lib/prisma';
import { getEnvironmentsPage } from '@/lib/data/environments';
import { parseFilters } from '@/lib/filters/parse';
import { ENVIRONMENT_FILTERS } from '@/lib/filters/options';
import { makeEnvironment } from '@/test/integration/factories';

/*
 * The unit tier pins that every list reader asks for `id` after `createdAt`; only Postgres
 * can show why. Rows written in one batch can share a createdAt, and without a unique last
 * sort key the order among them is whatever the plan happens to produce, so the same row
 * can turn up on two pages while another turns up on none. Exercised through one reader,
 * since they all build the orderBy the same way.
 */

const ALL_ENVIRONMENTS = parseFilters({}, ENVIRONMENT_FILTERS);
const SAME_INSTANT = new Date('2026-01-01T00:00:00Z');

const idsOn = async (page: number) =>
  (await getEnvironmentsPage(ALL_ENVIRONMENTS, page, 5)).rows.map((env) => env.id);

beforeEach(async () => {
  for (let i = 0; i < 12; i++) await makeEnvironment();
  await prisma.environment.updateMany({ data: { createdAt: SAME_INSTANT } });
});

it('splits rows sharing a timestamp across pages without repeating or dropping one', async () => {
  const pages = [await idsOn(1), await idsOn(2), await idsOn(3)];

  expect(pages.map((ids) => ids.length)).toEqual([5, 5, 2]);
  expect(new Set(pages.flat()).size).toBe(12);
});

it('gives the same page the same rows on every read', async () => {
  expect(await idsOn(2)).toEqual(await idsOn(2));
});

it('counts and clamps against the real row count', async () => {
  const page = await getEnvironmentsPage(ALL_ENVIRONMENTS, 99, 5);

  expect(page).toMatchObject({ total: 12, page: 3, pageCount: 3 });
  expect(page.rows).toHaveLength(2);
});

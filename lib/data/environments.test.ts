import { getEnvironments, getEnvironmentById } from '@/lib/data/environments';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

/*
 * The data layer's job at this boundary is translation: Prisma's UPPERCASE enums
 * become the lowercase domain unions in lib/types.ts, and the `secrets` relation
 * collapses to a count. That translation is what these assert — the query itself
 * is covered by the integration tier, which runs against real Postgres.
 */

const row = {
  id: 'env-1',
  name: 'Production',
  type: 'PRODUCTION' as const,
  requireApproval: true,
  createdById: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('getEnvironments', () => {
  it('lowercases the Prisma enum into the domain type', async () => {
    prismaMock.environment.findMany.mockResolvedValue([{ ...row, secrets: [] }] as never);

    const [env] = await getEnvironments();

    expect(env.type).toBe('production');
  });

  it('collapses the secrets relation to a count', async () => {
    prismaMock.environment.findMany.mockResolvedValue([
      { ...row, secrets: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
    ] as never);

    const [env] = await getEnvironments();

    expect(env.secrets).toBe(3);
  });

  it('orders newest first', async () => {
    prismaMock.environment.findMany.mockResolvedValue([] as never);

    await getEnvironments();

    expect(prismaMock.environment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('returns an empty list rather than throwing when there are no rows', async () => {
    prismaMock.environment.findMany.mockResolvedValue([] as never);

    await expect(getEnvironments()).resolves.toEqual([]);
  });
});

describe('getEnvironmentById', () => {
  it('returns null for an id that does not exist', async () => {
    prismaMock.environment.findUnique.mockResolvedValue(null as never);

    await expect(getEnvironmentById('nope')).resolves.toBeNull();
  });

  it('flattens the createdBy relation to a name', async () => {
    prismaMock.environment.findUnique.mockResolvedValue({
      ...row, secrets: [], createdBy: { name: 'kyle' },
    } as never);

    const env = await getEnvironmentById('env-1');

    expect(env?.createdBy).toBe('kyle');
  });

  // createdById is SetNull on user delete, so an orphaned environment is a real
  // state the UI has to render.
  it('yields a null creator when the user relation is gone', async () => {
    prismaMock.environment.findUnique.mockResolvedValue({
      ...row, secrets: [], createdBy: null,
    } as never);

    const env = await getEnvironmentById('env-1');

    expect(env?.createdBy).toBeNull();
  });

  it('lowercases the enum here too', async () => {
    prismaMock.environment.findUnique.mockResolvedValue({
      ...row, type: 'DEVELOPMENT', secrets: [], createdBy: null,
    } as never);

    const env = await getEnvironmentById('env-1');

    expect(env?.type).toBe('development');
  });
});

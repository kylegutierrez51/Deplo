import { getAudits, getAuditById } from '@/lib/data/audits';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

/*
 * Translation at the boundary, as with every lib/data reader: the Prisma enums become the
 * display unions in lib/types.ts and the user relation flattens to a name. The audit-specific
 * part is what a row looks like once the things it describes are gone — a deleted user is
 * SetNull on the row, and a deleted resource leaves only the label snapshot behind.
 */

const row = {
  id: 'audit-1',
  userId: 'user-1',
  actor: 'kyle',
  action: 'PIPELINE_UPDATED' as const,
  resourceType: 'PIPELINE_RUN' as const,
  resourceId: 'run-1',
  resourceLabel: 'CI #4',
  resourceMeta: { kind: 'run', pipelineName: 'CI', runNumber: 4 },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  user: { name: 'Kyle G' },
};

describe('getAudits', () => {
  it('translates the action into its display label', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([row] as never);

    const [audit] = await getAudits();

    expect(audit.action).toBe('Pipeline Updated');
  });

  it('lowercases the resource type into the domain type', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([row] as never);

    const [audit] = await getAudits();

    expect(audit.resourceType).toBe('pipeline-run');
  });

  // The relation arrives as an object and must leave as a string: components render
  // `audit.user` directly, and an object there is a React child error.
  it('flattens the user relation to a name', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([row] as never);

    const [audit] = await getAudits();

    expect(audit.user).toBe('Kyle G');
  });

  // userId is ON DELETE SET NULL, so a user deleted after acting leaves an audit with no
  // relation. actor is the display name captured at write time and is what survives.
  it('reports no user for an audit whose user has since been deleted, keeping the actor', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ ...row, userId: null, user: null }] as never);

    const [audit] = await getAudits();

    expect(audit.user).toBeNull();
    expect(audit.actor).toBe('kyle');
  });

  // The whole point of resourceLabel: the pipeline it names may no longer exist to join to.
  it('passes the label snapshot through untouched', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ ...row, resourceLabel: 'CI → Renamed' }] as never);

    const [audit] = await getAudits();

    expect(audit.resourceLabel).toBe('CI → Renamed');
  });

  it('orders newest first and joins only the user name', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    await getAudits();

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });
  });

  it('returns an empty list rather than throwing when there are no rows', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    await expect(getAudits()).resolves.toEqual([]);
  });

  it('passes a well-formed resourceMeta through untouched', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([row] as never);

    const [audit] = await getAudits();

    expect(audit.resourceMeta).toEqual({ kind: 'run', pipelineName: 'CI', runNumber: 4 });
  });

  it('falls back to null when resourceMeta was never written', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ ...row, resourceMeta: null }] as never);

    const [audit] = await getAudits();

    expect(audit.resourceMeta).toBeNull();
  });
});

describe('getAuditById', () => {
  it('returns null for an id that does not exist', async () => {
    prismaMock.auditLog.findUnique.mockResolvedValue(null as never);

    await expect(getAuditById('nope')).resolves.toBeNull();
  });

  it('applies the same translation as the list', async () => {
    prismaMock.auditLog.findUnique.mockResolvedValue({ ...row, action: 'RUN_CANCELLED' } as never);

    await expect(getAuditById('audit-1')).resolves.toEqual({
      ...row,
      action: 'Run Cancelled',
      resourceType: 'pipeline-run',
      user: 'Kyle G',
    });
  });
});

import { AuditAction, ResourceType } from '@/generated/prisma';
import { addAudit } from '@/lib/actions/audits';
import { prismaMock, resetPrismaMock, transactionMock } from '@/test/mocks/prisma';

// audits.ts imports lib/prisma and nothing else from the app: no auth, no cache.
jest.mock('@/lib/prisma');

/*
 * addAudit is one insert, and every "an audit is always written" claim in lib/actions rests
 * on two properties of it rather than on anything in the callers:
 *
 *   - it writes through the client it is handed, so a caller passing `tx` gets the insert
 *     inside its transaction instead of on a second pooled connection that commits alone;
 *   - it lets a failed insert escape, so the transaction rolls back instead of committing
 *     the resource write with no record of it.
 */

const attrs = {
  userId: 'user-1',
  actor: 'kyle',
  action: AuditAction.PIPELINE_CREATED,
  resourceType: ResourceType.PIPELINE,
  resourceId: 'p1',
  resourceLabel: 'CI',
};

beforeEach(() => {
  resetPrismaMock();
});

it('inserts the attributes it is given, unchanged', async () => {
  await addAudit(attrs);

  expect(prismaMock.auditLog.create).toHaveBeenCalledWith({ data: attrs });
});

it('writes through the transaction client it is handed, not the singleton', async () => {
  const tx = transactionMock();

  await addAudit(attrs, tx);

  expect(tx.auditLog.create).toHaveBeenCalledWith({ data: attrs });
  expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
});

// For the callers with no transaction to join — a run trigger audits after the enqueue,
// once the run row is already committed.
it('falls back to the singleton when no client is given', async () => {
  await addAudit(attrs);

  expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
});

// A swallowed error here is what let a pipeline write commit without its audit: the
// transaction callback resolved, so Prisma committed.
it('rejects when the insert fails rather than reporting success', async () => {
  const tx = transactionMock();
  tx.auditLog.create.mockRejectedValue(new Error('insert failed'));

  await expect(addAudit(attrs, tx)).rejects.toThrow('insert failed');
});

// Non-user actors (webhooks, system jobs) carry no userId. The field is required but
// nullable, so "no user" is something a caller states rather than something it forgets.
it('writes an explicit null userId for an actor that is not a user', async () => {
  await addAudit({ ...attrs, userId: null, actor: 'github-webhook' });

  expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({ userId: null, actor: 'github-webhook' });
});

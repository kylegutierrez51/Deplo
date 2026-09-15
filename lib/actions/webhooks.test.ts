import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { addWebhook, updateWebhook, deleteWebhook, regenerateWebhookSecret } from '@/lib/actions/webhooks';
import { decryptSecret } from '@/lib/utils/crypto';
import { prismaMock, resetPrismaMock, runTransactionsInline, transactionMock } from '@/test/mocks/prisma';
import { setSession } from '@/test/mocks/auth';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const idle = { status: 'idle' as const, message: '' };

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set('pipeline_id', 'p1');
  fd.set('webhook_secret', 'whsec_abc123');
  Object.entries(over).forEach(([k, v]) => fd.set(k, v));
  fd.append('branch_filters', 'main');
  fd.append('events', 'push');
  return fd;
};

const writtenData = (fn: { mock: { calls: unknown[][] } }) =>
  (fn.mock.calls[0][0] as { data: Record<string, string | string[]> }).data;

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  setSession();
  runTransactionsInline();
  // Every action reads something back inside its transaction (the row it just wrote, or
  // the prior row for a diff label); an unstubbed read resolves undefined and crashes the
  // destructure before a single case-specific mock matters.
  prismaMock.webhook.create.mockResolvedValue({ id: 'wh-new', pipeline: { name: 'CI' } } as never);
  prismaMock.webhook.findUniqueOrThrow.mockResolvedValue({ pipeline: { name: 'CI' } } as never);
  prismaMock.webhook.update.mockResolvedValue({ pipeline: { name: 'CI' } } as never);
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('addWebhook', () => {
  it('encrypts the signing secret before storing it', async () => {
    await addWebhook(idle, form({ webhook_secret: 'whsec_plain' }));
    const data = writtenData(prismaMock.webhook.create);

    expect(JSON.stringify(data)).not.toContain('whsec_plain');
    expect(decryptSecret({
      encryptedValue: data.encryptedValue as string,
      iv: data.iv as string,
      authTag: data.authTag as string,
    })).toBe('whsec_plain');
  });

  it('collects multi-valued branch filters and events', async () => {
    const fd = form();
    fd.append('branch_filters', 'develop');
    fd.append('events', 'pull-request');

    await addWebhook(idle, fd);

    expect(writtenData(prismaMock.webhook.create)).toMatchObject({
      branchFilters: ['main', 'develop'],
      events: ['PUSH', 'PULL_REQUEST'],
    });
  });

  it('revalidates on success', async () => {
    const result = await addWebhook(idle, form());

    expect(result).toEqual({ status: 'success', message: 'Webhook added' });
    expect(revalidate).toHaveBeenCalledWith('/webhooks');
  });

  // The pipeline was deleted between the form rendering and the submit.
  it('names the missing pipeline on a foreign key failure', async () => {
    prismaMock.webhook.create.mockRejectedValue(prismaError('P2003') as never);

    const result = await addWebhook(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Selected pipeline no longer exists.' });
  });

  it('falls back to a generic message for anything else', async () => {
    prismaMock.webhook.create.mockRejectedValue(new Error('network') as never);

    const result = await addWebhook(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error adding webhook. Please try again.' });
  });
});

// validateAndMapEvents is module-private, and a "use server" file cannot export a
// non-action helper, so it is exercised through the two actions that call it.
describe('event validation', () => {
  it('rejects the submission without writing when an event is not a known member', async () => {
    const fd = form();
    fd.append('events', 'pull_request');

    const result = await addWebhook(idle, fd);

    expect(result).toEqual({
      status: 'error',
      message: 'Error adding trigger event data. Please try again.',
    });
    expect(prismaMock.webhook.create).not.toHaveBeenCalled();
  });

  // An empty list is a valid submission, not a rejected one: null is the only
  // failure signal, so the caller's `if (!events)` must not treat [] as one.
  it('writes an empty array when the form carries no events at all', async () => {
    const fd = form();
    fd.delete('events');

    const result = await addWebhook(idle, fd);

    expect(result.status).toBe('success');
    expect(writtenData(prismaMock.webhook.create)).toMatchObject({ events: [] });
  });

  it('maps every selected event to its uppercase Prisma member', async () => {
    const fd = form();
    fd.append('events', 'pull-request');

    await updateWebhook(idle, fd);

    expect(writtenData(prismaMock.webhook.update)).toMatchObject({
      events: ['PUSH', 'PULL_REQUEST'],
    });
  });
});

describe('updateWebhook', () => {
  // Rotation is deliberately a separate action, so editing metadata must never
  // re-sign or discard the stored secret.
  it('leaves the stored secret untouched', async () => {
    await updateWebhook(idle, form({ id: 'wh-1' }));
    const data = writtenData(prismaMock.webhook.update);

    expect(data).not.toHaveProperty('encryptedValue');
    expect(data).not.toHaveProperty('iv');
    expect(data).not.toHaveProperty('authTag');
  });

  it('updates only the metadata, by id', async () => {
    await updateWebhook(idle, form({ id: 'wh-1', pipeline_id: 'p2' }));

    expect(prismaMock.webhook.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wh-1' },
      data: { pipelineId: 'p2', branchFilters: ['main'], events: ['PUSH'] },
    }));
  });

  it('names the missing pipeline on a foreign key failure', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2003') as never);

    const result = await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(result).toEqual({ status: 'error', message: 'Selected pipeline no longer exists.' });
  });

  it('reports a webhook deleted from under the edit', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(result).toEqual({ status: 'error', message: 'This webhook no longer exists.' });
  });

  it('falls back to a generic message for anything else', async () => {
    prismaMock.webhook.update.mockRejectedValue(new Error('network') as never);

    const result = await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(result).toEqual({ status: 'error', message: 'Error updating webhook. Please try again.' });
  });
});

describe('regenerateWebhookSecret', () => {
  // The plaintext is shown to the user exactly once, so it has to come back out
  // of the action — it can never be recovered from the row afterwards.
  it('returns the new plaintext secret once', async () => {
    const result = await regenerateWebhookSecret('wh-1');

    expect(result.status).toBe('success');
    expect(result.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
  });

  it('stores the encrypted form of exactly the secret it returned', async () => {
    const result = await regenerateWebhookSecret('wh-1');
    const data = writtenData(prismaMock.webhook.update);

    expect(decryptSecret({
      encryptedValue: data.encryptedValue as string,
      iv: data.iv as string,
      authTag: data.authTag as string,
    })).toBe(result.secret);
  });

  it('rotates only the secret columns', async () => {
    await regenerateWebhookSecret('wh-1');

    expect(prismaMock.webhook.update).toHaveBeenCalledWith({
      where: { id: 'wh-1' },
      data: {
        encryptedValue: expect.any(String), iv: expect.any(String), authTag: expect.any(String),
      },
    });
  });

  it('produces a different secret every time', async () => {
    const first = await regenerateWebhookSecret('wh-1');
    const second = await regenerateWebhookSecret('wh-1');

    expect(first.secret).not.toBe(second.secret);
  });

  it('reports a deleted webhook rather than a generic failure', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await regenerateWebhookSecret('wh-1');

    expect(result).toEqual({ status: 'error', message: 'This webhook no longer exists.' });
  });

  it('falls back to the generic message for an unrecognised error', async () => {
    prismaMock.webhook.update.mockRejectedValue(new Error('network') as never);

    const result = await regenerateWebhookSecret('wh-1');

    expect(result).toEqual({ status: 'error', message: 'Error regenerating webhook. Please try again.' });
  });

  it('does not leak a secret alongside an error', async () => {
    prismaMock.webhook.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await regenerateWebhookSecret('wh-1');

    expect(result.secret).toBeUndefined();
  });
});

describe('deleteWebhook', () => {
  it('deletes and revalidates', async () => {
    prismaMock.webhook.delete.mockResolvedValue({ id: 'wh-1' } as never);

    const result = await deleteWebhook('wh-1');

    expect(result.status).toBe('success');
    expect(revalidate).toHaveBeenCalledWith('/webhooks');
  });

  it('reports the row being already gone rather than a generic failure', async () => {
    prismaMock.webhook.delete.mockRejectedValue(prismaError('P2025') as never);

    const result = await deleteWebhook('wh-1');

    expect(result).toEqual({ status: 'error', message: 'This webhook no longer exists.' });
  });

  it('returns the generic message for an unrecognised error', async () => {
    prismaMock.webhook.delete.mockRejectedValue(new Error('network') as never);

    const result = await deleteWebhook('wh-1');

    expect(result).toEqual({ status: 'error', message: 'Error deleting webhook. Please try again.' });
  });
});

/*
 * A mock can't prove the rollback itself (that's audits.integration.test.ts), but it can
 * prove the precondition a shared mock is blind to: that the audit goes to the same
 * transaction client as the write, not to the singleton on a connection of its own.
 */
describe('audit trail', () => {
  const attributed = { userId: 'user-1', actor: 'kyle' };

  let tx: ReturnType<typeof transactionMock>;

  beforeEach(() => {
    tx = transactionMock();
    runTransactionsInline(tx);
  });

  const cases = [
    {
      name: 'addWebhook',
      arrange: () => tx.webhook.create.mockResolvedValue({ id: 'wh-new', pipeline: { name: 'CI' } } as never),
      act: () => addWebhook(idle, form()),
      written: () => tx.webhook.create,
      audit: { action: 'WEBHOOK_CREATED', resourceType: 'WEBHOOK', resourceId: 'wh-new', resourceLabel: 'CI' },
    },
    {
      name: 'updateWebhook',
      arrange: () => {
        tx.webhook.findUniqueOrThrow.mockResolvedValue({ pipeline: { name: 'CI' } } as never);
        tx.webhook.update.mockResolvedValue({ pipeline: { name: 'Other' } } as never);
      },
      act: () => updateWebhook(idle, form({ id: 'wh-1', pipeline_id: 'p2' })),
      written: () => tx.webhook.update,
      audit: { action: 'WEBHOOK_UPDATED', resourceType: 'WEBHOOK', resourceId: 'wh-1', resourceLabel: 'CI → Other' },
    },
    {
      name: 'deleteWebhook',
      arrange: () => tx.webhook.delete.mockResolvedValue({ pipeline: { name: 'CI' } } as never),
      act: () => deleteWebhook('wh-1'),
      written: () => tx.webhook.delete,
      audit: { action: 'WEBHOOK_DELETED', resourceType: 'WEBHOOK', resourceId: 'wh-1', resourceLabel: 'CI' },
    },
  ];

  describe.each(cases)('$name', ({ arrange, act, written, audit }) => {
    beforeEach(() => { arrange(); });

    it('sends the write and its audit to the same transaction', async () => {
      await act();

      expect(written()).toHaveBeenCalledTimes(1);
      expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('records what happened, to what, and by whom', async () => {
      await act();

      expect(tx.auditLog.create.mock.calls[0][0].data).toEqual({ ...audit, ...attributed });
    });

    // The rejection has to escape the callback for Prisma to roll back; a success
    // message here would mean it was swallowed and the write committed without it.
    it('reports failure and does not revalidate when the audit cannot be written', async () => {
      tx.auditLog.create.mockRejectedValue(new Error('audit insert failed'));

      const result = await act();

      expect(result.status).toBe('error');
      expect(revalidate).not.toHaveBeenCalled();
    });
  });

  // Webhook.pipeline is optional — onDelete: SetNull leaves a webhook pointing at no
  // pipeline — so the label has to degrade to null rather than throw on a missing relation.
  it('labels a webhook with no pipeline as null, not a crash', async () => {
    tx.webhook.create.mockResolvedValue({ id: 'wh-new', pipeline: null } as never);

    await addWebhook(idle, form());

    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ resourceLabel: null });
  });

  it('labels a pipeline reassignment from none to one', async () => {
    tx.webhook.findUniqueOrThrow.mockResolvedValue({ pipeline: null } as never);
    tx.webhook.update.mockResolvedValue({ pipeline: { name: 'CI' } } as never);

    await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ resourceLabel: '(none) → CI' });
  });

  it('labels a pipeline unassignment as a diff, not a bare "null"', async () => {
    tx.webhook.findUniqueOrThrow.mockResolvedValue({ pipeline: { name: 'CI' } } as never);
    tx.webhook.update.mockResolvedValue({ pipeline: null } as never);

    await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ resourceLabel: 'CI → (none)' });
  });

  // Staying unassigned across the edit is not a change, so it keeps the plain null the
  // create/delete audits already use rather than announcing a "(none) → (none)" diff.
  it('leaves an unchanged missing pipeline as a plain null, not a diff', async () => {
    tx.webhook.findUniqueOrThrow.mockResolvedValue({ pipeline: null } as never);
    tx.webhook.update.mockResolvedValue({ pipeline: null } as never);

    await updateWebhook(idle, form({ id: 'wh-1' }));

    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ resourceLabel: null });
  });
});

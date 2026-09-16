import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { addSecret, updateSecret, deleteSecret } from '@/lib/actions/secrets';
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
  fd.set('key', 'API_KEY');
  fd.set('value', 'super-secret');
  fd.set('env_id', 'env-1');
  fd.set('notes', 'used by the deploy stage');
  Object.entries(over).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

/** The `data` argument of the single create/update call that was made. */
const writtenData = (fn: { mock: { calls: unknown[][] } }) =>
  (fn.mock.calls[0][0] as { data: Record<string, string> }).data;

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  setSession();
  runTransactionsInline();
  // Every action reads something back inside its transaction before or after the write
  // (the prior row for a diff label, or the row it just wrote); an unstubbed read resolves
  // undefined and crashes the destructure before a single case-specific mock matters.
  prismaMock.secret.create.mockResolvedValue({ id: 'sec-new', environment: { type: 'PRODUCTION' } } as never);
  prismaMock.secret.findUniqueOrThrow.mockResolvedValue({ key: 'API_KEY', environment: { type: 'PRODUCTION' } } as never);
  prismaMock.secret.delete.mockResolvedValue({ id: 'sec-1', key: 'API_KEY', environment: { type: 'PRODUCTION' } } as never);
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('addSecret encryption', () => {
  // The whole point of the Secret model's three columns: the plaintext must not
  // reach the database.
  it('never writes the plaintext value', async () => {
    await addSecret(idle, form({ value: 'super-secret' }));

    expect(JSON.stringify(writtenData(prismaMock.secret.create))).not.toContain('super-secret');
  });

  it('writes the ciphertext, iv and auth tag', async () => {
    await addSecret(idle, form());
    const data = writtenData(prismaMock.secret.create);

    expect(data.encryptedValue).toMatch(/^[0-9a-f]+$/);
    expect(data.iv).toMatch(/^[0-9a-f]{24}$/);
    expect(data.authTag).toMatch(/^[0-9a-f]{32}$/);
  });

  it('writes something the reader can actually decrypt', async () => {
    await addSecret(idle, form({ value: 'round-trip me' }));
    const { encryptedValue, iv, authTag } = writtenData(prismaMock.secret.create);

    expect(decryptSecret({ encryptedValue, iv, authTag })).toBe('round-trip me');
  });

  it('uses a fresh iv for two secrets with the same value', async () => {
    await addSecret(idle, form({ value: 'same' }));
    const first = writtenData(prismaMock.secret.create);

    resetPrismaMock();
    runTransactionsInline();
    prismaMock.secret.create.mockResolvedValue({ id: 'sec-new', environment: { type: 'PRODUCTION' } } as never);
    await addSecret(idle, form({ value: 'same' }));
    const second = writtenData(prismaMock.secret.create);

    expect(first.iv).not.toBe(second.iv);
    expect(first.encryptedValue).not.toBe(second.encryptedValue);
  });

  it('stores the key, environment and notes in the clear', async () => {
    await addSecret(idle, form());
    const data = writtenData(prismaMock.secret.create);

    expect(data).toMatchObject({
      key: 'API_KEY', environmentId: 'env-1', notes: 'used by the deploy stage', createdById: 'user-1',
    });
  });
});

describe('addSecret outcomes', () => {
  it('revalidates on success', async () => {
    const result = await addSecret(idle, form());

    expect(result).toEqual({ status: 'success', message: 'Secret added' });
    expect(revalidate).toHaveBeenCalledWith('/secrets');
  });

  // The environment was deleted between the form rendering and the submit.
  it('names the missing environment on a foreign key failure', async () => {
    prismaMock.secret.create.mockRejectedValue(prismaError('P2003') as never);

    const result = await addSecret(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Selected environment no longer exists.' });
  });

  // @@unique([environmentId, key]) — a duplicate key in the same environment.
  it('names the collision for a duplicate key', async () => {
    prismaMock.secret.create.mockRejectedValue(prismaError('P2002') as never);

    const result = await addSecret(idle, form());

    expect(result).toEqual({
      status: 'error',
      message: 'The key is already registered to the selected environment. Enter a new key or select a different environment.',
    });
  });

  it('falls back to the generic message for an unrecognised error', async () => {
    prismaMock.secret.create.mockRejectedValue(new Error('network') as never);

    const result = await addSecret(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error adding secret. Please try again.' });
  });
});

describe('updateSecret', () => {
  it('re-encrypts on every edit rather than reusing the stored ciphertext', async () => {
    await updateSecret(idle, form({ id: 'sec-1', value: 'rotated' }));
    const { encryptedValue, iv, authTag } = writtenData(prismaMock.secret.update);

    expect(decryptSecret({ encryptedValue, iv, authTag })).toBe('rotated');
  });

  it('updates by id', async () => {
    await updateSecret(idle, form({ id: 'sec-1' }));

    expect(prismaMock.secret.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sec-1' } }),
    );
  });

  it('does not reassign the creator', async () => {
    await updateSecret(idle, form({ id: 'sec-1' }));

    expect(writtenData(prismaMock.secret.update)).not.toHaveProperty('createdById');
  });

  it('names the missing environment on a foreign key failure', async () => {
    prismaMock.secret.update.mockRejectedValue(prismaError('P2003') as never);

    const result = await updateSecret(idle, form({ id: 'sec-1' }));

    expect(result).toEqual({ status: 'error', message: 'Selected environment no longer exists.' });
  });

  // Re-keying onto a key that already exists in the target environment.
  it('names the collision for a duplicate key', async () => {
    prismaMock.secret.update.mockRejectedValue(prismaError('P2002') as never);

    const result = await updateSecret(idle, form({ id: 'sec-1' }));

    expect(result).toEqual({
      status: 'error',
      message: 'The key is already registered to the selected environment. Enter a new key or select a different environment.',
    });
  });

  it('reports a secret deleted from under the edit', async () => {
    prismaMock.secret.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await updateSecret(idle, form({ id: 'sec-1' }));

    expect(result).toEqual({ status: 'error', message: 'This secret no longer exists.' });
  });

  it('falls back to the generic message for an unrecognised error', async () => {
    prismaMock.secret.update.mockRejectedValue(new Error('network') as never);

    const result = await updateSecret(idle, form({ id: 'sec-1' }));

    expect(result).toEqual({ status: 'error', message: 'Error updating secret. Please try again.' });
  });
});

describe('deleteSecret', () => {
  // The confirmation names the key, so the delete has to read it off the deleted
  // row rather than echo the id it was handed. The plaintext value never appears.
  it('deletes and revalidates', async () => {
    prismaMock.secret.delete.mockResolvedValue({ id: 'sec-1', key: 'API_KEY', environment: { type: 'PRODUCTION' } } as never);

    const result = await deleteSecret('sec-1');

    expect(result).toEqual({ status: 'success', message: 'Secret deleted' });
    expect(revalidate).toHaveBeenCalledWith('/secrets');
  });

  it('reports the row being already gone rather than a generic failure', async () => {
    prismaMock.secret.delete.mockRejectedValue(prismaError('P2025') as never);

    const result = await deleteSecret('sec-1');

    expect(result).toEqual({ status: 'error', message: 'This secret no longer exists.' });
  });

  it('returns the generic message for an unrecognised error', async () => {
    prismaMock.secret.delete.mockRejectedValue(new Error('network') as never);

    const result = await deleteSecret('sec-1');

    expect(result).toEqual({ status: 'error', message: 'Error deleting secret. Please try again.' });
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
      name: 'addSecret',
      arrange: () => tx.secret.create.mockResolvedValue({ id: 'sec-new', environment: { type: 'PRODUCTION' } } as never),
      act: () => addSecret(idle, form()),
      written: () => tx.secret.create,
      audit: {
        action: 'SECRET_CREATED', resourceType: 'SECRET', resourceId: 'sec-new', resourceLabel: 'API_KEY (PRODUCTION)',
        resourceMeta: { kind: 'secret', key: 'API_KEY', type: 'production' },
      },
    },
    {
      name: 'updateSecret',
      arrange: () => tx.secret.findUniqueOrThrow.mockResolvedValue({ key: 'API_KEY', environment: { type: 'PRODUCTION' } } as never),
      act: () => updateSecret(idle, form({ id: 'sec-1', key: 'ROTATED_KEY' })),
      written: () => tx.secret.update,
      audit: {
        action: 'SECRET_UPDATED', resourceType: 'SECRET', resourceId: 'sec-1', resourceLabel: 'API_KEY → ROTATED_KEY (PRODUCTION)',
        resourceMeta: { kind: 'secret', key: 'ROTATED_KEY', type: 'production', prevKey: 'API_KEY' },
      },
    },
    {
      name: 'deleteSecret',
      arrange: () => tx.secret.delete.mockResolvedValue({ id: 'sec-1', key: 'API_KEY', environment: { type: 'PRODUCTION' } } as never),
      act: () => deleteSecret('sec-1'),
      written: () => tx.secret.delete,
      audit: {
        action: 'SECRET_DELETED', resourceType: 'SECRET', resourceId: 'sec-1', resourceLabel: 'API_KEY (PRODUCTION)',
        resourceMeta: { kind: 'secret', key: 'API_KEY', type: 'production' },
      },
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

  // The key never leaves the plaintext at rest, but the label is free text derived from
  // it — worth pinning separately from the "never writes the plaintext value" case above,
  // since a label bug would not trip that assertion.
  it('never puts the plaintext value in the audit label', async () => {
    tx.secret.create.mockResolvedValue({ id: 'sec-new', environment: { type: 'PRODUCTION' } } as never);

    await addSecret(idle, form({ value: 'super-secret' }));

    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0].data)).not.toContain('super-secret');
  });
});

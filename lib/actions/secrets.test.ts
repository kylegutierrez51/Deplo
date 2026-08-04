import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { addSecret, updateSecret, deleteSecret } from '@/lib/actions/secrets';
import { decryptSecret } from '@/lib/utils/crypto';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
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

  /*
   * TODO(bug): the P2003 branch is unreachable. This action imports
   * PrismaClientKnownRequestError from '@prisma/client/runtime/library', but the
   * client is generated to generated/prisma and throws that class from its own
   * bundled runtime copy — a different class object — so the `instanceof` guard
   * is always false and the specific message never renders.
   *
   * Verified against a live database in lib/data/secrets.integration.test.ts.
   * Pinned as-is: the user sees the generic message instead.
   */
  it('falls through to the generic message on a foreign key failure', async () => {
    prismaMock.secret.create.mockRejectedValue(prismaError('P2003') as never);

    const result = await addSecret(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error adding secret. Please try again.' });
  });

  // @@unique([environmentId, key]) — a duplicate key in the same environment.
  it('falls back to the generic message for a duplicate key', async () => {
    prismaMock.secret.create.mockRejectedValue(prismaError('P2002') as never);

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

  // Same unreachable P2003 branch as addSecret — see the note there.
  it('falls through to the generic message on a foreign key failure', async () => {
    prismaMock.secret.update.mockRejectedValue(prismaError('P2003') as never);

    const result = await updateSecret(idle, form({ id: 'sec-1' }));

    expect(result).toEqual({ status: 'error', message: 'Error adding secret. Please try again.' });
  });

  // TODO(bug): the generic failure message says "adding" on the update path.
  // Pinned as-is; it is user-visible copy.
  it('reports an update failure as "adding"', async () => {
    prismaMock.secret.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await updateSecret(idle, form({ id: 'sec-1' }));

    expect(result).toEqual({ status: 'error', message: 'Error adding secret. Please try again.' });
  });
});

describe('deleteSecret', () => {
  it('deletes and revalidates', async () => {
    prismaMock.secret.delete.mockResolvedValue({ id: 'sec-1' } as never);

    const result = await deleteSecret('sec-1');

    expect(result.status).toBe('success');
    expect(revalidate).toHaveBeenCalledWith('/secrets');
  });

  it('returns the generic message when the row was already gone', async () => {
    prismaMock.secret.delete.mockRejectedValue(prismaError('P2025') as never);

    const result = await deleteSecret('sec-1');

    expect(result).toEqual({ status: 'error', message: 'Error deleting secret. Please try again.' });
  });
});

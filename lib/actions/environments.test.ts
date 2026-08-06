import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { addEnvironment, updateEnvironment, deleteEnvironment } from '@/lib/actions/environments';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { setSession, signedOut } from '@/test/mocks/auth';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const idle = { status: 'idle' as const, message: '' };

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set('name', 'Production');
  fd.set('type', 'production');
  fd.set('requireApproval', 'true');
  Object.entries(over).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  setSession();
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('addEnvironment', () => {
  // The UI works in lowercase domain types; Prisma's enum is uppercase. This
  // action is one of the places that translation happens inline.
  it('upcases the form type into the Prisma enum', async () => {
    await addEnvironment(idle, form({ type: 'staging' }));

    expect(prismaMock.environment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'STAGING' }),
    });
  });

  it('attributes the row to the signed-in user', async () => {
    setSession('user-7');

    await addEnvironment(idle, form());

    expect(prismaMock.environment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdById: 'user-7' }),
    });
  });

  it('stores a null creator when signed out', async () => {
    signedOut();

    await addEnvironment(idle, form());

    expect(prismaMock.environment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdById: null }),
    });
  });

  // requireApproval arrives as a string and is compared to 'true', so anything
  // else — including 'on', which is what an unconfigured checkbox would send —
  // reads as false.
  it.each([
    ['true', true],
    ['false', false],
    ['on', false],
    ['', false],
  ])('reads requireApproval=%s as %s', async (raw, expected) => {
    await addEnvironment(idle, form({ requireApproval: raw }));

    expect(prismaMock.environment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requireApproval: expected }),
    });
  });

  it('revalidates the environments route on success', async () => {
    const result = await addEnvironment(idle, form());

    expect(result).toEqual({ status: 'success', message: 'Environment added' });
    expect(revalidate).toHaveBeenCalledWith('/environments');
  });

  it('reports a generic failure for an unrecognised error', async () => {
    prismaMock.environment.create.mockRejectedValue(new Error('network') as never);

    const result = await addEnvironment(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error adding environment. Please try again.' });
    expect(revalidate).not.toHaveBeenCalled();
  });

  // Environment.name is unique, so a duplicate is the most likely real failure
  // and it gets its own copy rather than the generic message.
  it('distinguishes a duplicate name from any other failure', async () => {
    prismaMock.environment.create.mockRejectedValue(prismaError('P2002') as never);
    const duplicate = await addEnvironment(idle, form());

    prismaMock.environment.create.mockRejectedValue(new Error('network') as never);
    const unrelated = await addEnvironment(idle, form());

    expect(duplicate).toEqual({ status: 'error', message: 'Environment name already used. Try a new one.' });
    expect(duplicate.message).not.toBe(unrelated.message);
    expect(revalidate).not.toHaveBeenCalled();
  });

  /*
   * Environment.type carries @default(DEVELOPMENT), so an unusable value must be
   * rejected before it reaches Prisma rather than handed over as undefined —
   * Prisma would quietly apply the default and report success. A server action is
   * a POST endpoint, so an absent field is a real request shape, not just a
   * theoretical one: the modal's hidden input is the only thing that normally
   * supplies it.
   */
  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['unrecognised', 'banana'],
  ])('returns an error when type is %s', async (_label, raw) => {
    const fd = form();
    if (raw === undefined) fd.delete('type'); else fd.set('type', raw);

    const result = await addEnvironment(idle, fd);

    expect(result).toEqual({ status: 'error', message: 'Error adding environment. Please choose a valid type.' });
    expect(prismaMock.environment.create).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('accepts a type the form already sent in uppercase', async () => {
    await addEnvironment(idle, form({ type: 'PREVIEW' }));

    expect(prismaMock.environment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'PREVIEW' }),
    });
  });
});

describe('updateEnvironment', () => {
  it('updates by id and revalidates', async () => {
    const result = await updateEnvironment(idle, form({ id: 'env-1', name: 'Renamed' }));

    expect(prismaMock.environment.update).toHaveBeenCalledWith({
      where: { id: 'env-1' },
      data: { name: 'Renamed', type: 'PRODUCTION', requireApproval: true },
    });
    expect(result).toEqual({ status: 'success', message: 'Environment updated' });
    expect(revalidate).toHaveBeenCalledWith('/environments');
  });

  // Unlike addEnvironment, this one does not write createdById — editing an
  // environment must not reassign its author.
  it('does not touch the creator', async () => {
    await updateEnvironment(idle, form({ id: 'env-1' }));

    const [[call]] = prismaMock.environment.update.mock.calls as unknown as [[{ data: object }]];
    expect(call.data).not.toHaveProperty('createdById');
  });

  it('reports an environment deleted from under the edit', async () => {
    prismaMock.environment.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await updateEnvironment(idle, form({ id: 'env-1' }));

    expect(result).toEqual({ status: 'error', message: 'This environment no longer exists.' });
  });

  // Renaming onto another environment's name trips the same unique constraint
  // addEnvironment does.
  it('reports a rename onto a name already in use', async () => {
    prismaMock.environment.update.mockRejectedValue(prismaError('P2002') as never);

    const result = await updateEnvironment(idle, form({ id: 'env-1', name: 'Taken' }));

    expect(result).toEqual({ status: 'error', message: 'Environment name already used. Try a new one.' });
  });

  it('reports a generic failure for an unrecognised error', async () => {
    prismaMock.environment.update.mockRejectedValue(new Error('network') as never);

    const result = await updateEnvironment(idle, form({ id: 'env-1' }));

    expect(result).toEqual({ status: 'error', message: 'Error updating environment. Please try again.' });
  });

  /*
   * The stakes differ from addEnvironment: an undefined field in a Prisma update
   * means "leave this column alone", so handing one over would report success
   * while the type the user thought they were setting never changed.
   */
  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['unrecognised', 'banana'],
  ])('returns an error when type is %s', async (_label, raw) => {
    const fd = form({ id: 'env-1' });
    if (raw === undefined) fd.delete('type'); else fd.set('type', raw);

    const result = await updateEnvironment(idle, fd);

    expect(result).toEqual({ status: 'error', message: 'Error updating environment. Please choose a valid type.' });
    expect(prismaMock.environment.update).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe('deleteEnvironment', () => {
  // The confirmation names the environment, so the delete has to read the name
  // off the deleted row rather than echo the id it was handed.
  it('deletes and revalidates', async () => {
    prismaMock.environment.delete.mockResolvedValue({ id: 'env-1', name: 'Production' } as never);

    const result = await deleteEnvironment('env-1');

    expect(result).toEqual({ status: 'success', message: 'Environment deleted' });
    expect(revalidate).toHaveBeenCalledWith('/environments');
  });

  it('reports the row being already gone rather than a generic failure', async () => {
    prismaMock.environment.delete.mockRejectedValue(prismaError('P2025') as never);

    const result = await deleteEnvironment('env-1');

    expect(result).toEqual({ status: 'error', message: 'This environment no longer exists.' });
  });

  it('returns the generic message for an unrecognised error', async () => {
    prismaMock.environment.delete.mockRejectedValue(new Error('network') as never);

    const result = await deleteEnvironment('env-1');

    expect(result).toEqual({ status: 'error', message: 'Error deleting environment. Please try again.' });
  });
});

import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { addEnvironment, updateEnvironment, deleteEnvironment } from '@/lib/actions/environments';
import { prismaMock, resetPrismaMock, runTransactionsInline, transactionMock } from '@/test/mocks/prisma';
import { setSession, signedOut } from '@/test/mocks/auth';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const idle = { status: 'idle' as const, message: '' };

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set('name', 'production');
  fd.set('type', 'production');
  fd.set('requireApproval', 'true');
  Object.entries(over).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  setSession();
  runTransactionsInline();
  // Every action reads something back inside its transaction (the row it just created, or
  // the prior row for a diff label); an unstubbed read resolves undefined and crashes the
  // destructure before a single case-specific mock matters.
  prismaMock.environment.create.mockResolvedValue({ id: 'env-new', name: 'production', type: 'PRODUCTION' } as never);
  prismaMock.environment.findUniqueOrThrow.mockResolvedValue({ name: 'production', type: 'PRODUCTION' } as never);
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('addEnvironment', () => {
  // The UI works in lowercase domain types; Prisma's enum is uppercase. This
  // action is one of the places that translation happens inline.
  it('upcases the form type into the Prisma enum', async () => {
    await addEnvironment(idle, form({ type: 'staging' }));

    expect(prismaMock.environment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'STAGING' }),
    }));
  });

  it('attributes the row to the signed-in user', async () => {
    setSession('user-7');

    await addEnvironment(idle, form());

    expect(prismaMock.environment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ createdById: 'user-7' }),
    }));
  });

  it('refuses when signed out', async () => {
    signedOut();

    const result = await addEnvironment(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Sign in to add an environment.' });
    expect(prismaMock.environment.create).not.toHaveBeenCalled();
  });

  // The schema accepts only the two explicit values sent by the modal.
  it.each([
    ['true', true],
    ['false', false],
  ])('reads requireApproval=%s as %s', async (raw, expected) => {
    await addEnvironment(idle, form({ requireApproval: raw }));

    expect(prismaMock.environment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requireApproval: expected }),
    }));
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

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/invalid/i);
    expect(prismaMock.environment.create).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('rejects an uppercase type outside the schema enum', async () => {
    expect((await addEnvironment(idle, form({ type: 'PREVIEW' }))).status).toBe('error');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('updateEnvironment', () => {
  it.each([null, '', 'file'])('rejects an invalid update id (%j) before accessing the database', async id => {
    const fd = form({ name: 'production' });
    if (id === 'file') fd.set('id', new File(['env-1'], 'id.txt'));
    else if (id !== null) fd.set('id', id);

    expect((await updateEnvironment(idle, fd)).status).toBe('error');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('updates by id and revalidates', async () => {
    const result = await updateEnvironment(idle, form({ id: 'env-1', name: 'renamed' }));

    expect(prismaMock.environment.update).toHaveBeenCalledWith({
      where: { id: 'env-1' },
      data: { name: 'renamed', type: 'PRODUCTION', requireApproval: true },
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

    const result = await updateEnvironment(idle, form({ id: 'env-1', name: 'taken' }));

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

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/invalid/i);
    expect(prismaMock.environment.update).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe.each([['create', addEnvironment], ['update', updateEnvironment]] as const)('environment Zod validation on %s', (mode, action) => {
  it.each([
    ['name', '', /required/i], ['name', '   ', /required/i],
    ['name', 'Production', /lowercase/i], ['name', 'qa_test', /hyphens/i],
    ['name', 'qa test', /hyphens/i], ['name', 'a'.repeat(51), /50/],
    ['type', 'unknown', /invalid/i], ['requireApproval', 'on', /invalid/i],
    ['requireApproval', '', /invalid/i],
  ])('rejects invalid %s before writing (%s)', async (field, value, message) => {
    const fd = form({ id: 'env-1', name: 'production', [field]: value });
    const result = await action(idle, fd);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(message);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it.each(['name', 'type', 'requireApproval'])('rejects a missing or file-valued %s', async field => {
    const fd = form({ id: 'env-1', name: 'production' });
    fd.delete(field);
    expect((await action(idle, fd)).status).toBe('error');
    fd.set(field, new File(['invalid'], 'input.txt'));
    expect((await action(idle, fd)).status).toBe('error');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it.each(['production', 'staging', 'development', 'preview', 'custom'])('accepts %s with a trimmed 50-character name and false approval', async type => {
    const result = await action(idle, form({ id: 'env-1', name: `  ${'a'.repeat(50)}  `, type, requireApproval: 'false' }));
    expect(result.status).toBe('success');
    const write = mode === 'create' ? prismaMock.environment.create : prismaMock.environment.update;
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'a'.repeat(50), type: type.toUpperCase(), requireApproval: false }),
    }));
  });
});

describe('deleteEnvironment', () => {
  // The confirmation names the environment, so the delete has to read the name
  // off the deleted row rather than echo the id it was handed.
  it('deletes and revalidates', async () => {
    prismaMock.environment.delete.mockResolvedValue({ id: 'env-1', name: 'production', type: 'PRODUCTION' } as never);

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
      name: 'addEnvironment',
      arrange: () => tx.environment.create.mockResolvedValue({ id: 'env-new', name: 'production', type: 'PRODUCTION' } as never),
      act: () => addEnvironment(idle, form()),
      written: () => tx.environment.create,
      audit: {
        action: 'ENVIRONMENT_CREATED', resourceType: 'ENVIRONMENT', resourceId: 'env-new', resourceLabel: 'production (PRODUCTION)',
        resourceMeta: { kind: 'environment', name: 'production', type: 'production' },
      },
    },
    {
      name: 'updateEnvironment',
      arrange: () => tx.environment.findUniqueOrThrow.mockResolvedValue({ name: 'production', type: 'PRODUCTION' } as never),
      act: () => updateEnvironment(idle, form({ id: 'env-1', name: 'prod', type: 'staging' })),
      written: () => tx.environment.update,
      audit: {
        action: 'ENVIRONMENT_UPDATED', resourceType: 'ENVIRONMENT', resourceId: 'env-1', resourceLabel: 'production → prod (production → staging)',
        resourceMeta: { kind: 'environment', name: 'prod', type: 'staging', prevName: 'production', prevType: 'production' },
      },
    },
    {
      name: 'deleteEnvironment',
      arrange: () => tx.environment.delete.mockResolvedValue({ name: 'production', type: 'PRODUCTION' } as never),
      act: () => deleteEnvironment('env-1'),
      written: () => tx.environment.delete,
      audit: {
        action: 'ENVIRONMENT_DELETED', resourceType: 'ENVIRONMENT', resourceId: 'env-1', resourceLabel: 'production (PRODUCTION)',
        resourceMeta: { kind: 'environment', name: 'production', type: 'production' },
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

  // Renaming without changing type (or vice versa) should not manufacture a false diff
  // arrow on the half that did not change.
  it('labels only the field that actually changed', async () => {
    tx.environment.findUniqueOrThrow.mockResolvedValue({ name: 'production', type: 'PRODUCTION' } as never);

    await updateEnvironment(idle, form({ id: 'env-1', name: 'production', type: 'staging' }));

    const { data } = tx.auditLog.create.mock.calls[0][0];

    expect(data).toMatchObject({
      resourceLabel: 'production (production → staging)',
    });
    expect(data.resourceMeta).toEqual({ kind: 'environment', name: 'production', type: 'staging', prevType: 'production' });
  });
});

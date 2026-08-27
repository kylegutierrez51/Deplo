import prisma from '@/lib/prisma';
import { getSecrets, getSecretById } from '@/lib/data/secrets';
import { addSecret } from '@/lib/actions/secrets';
import { addEnvironment } from '@/lib/actions/environments';
import { makeEnvironment, makeUser } from '@/test/integration/factories';
import { setSession } from '@/test/mocks/auth';

jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));

beforeEach(async () => setSession((await makeUser()).id));

/*
 * Proves the write path and the read path agree against a real database, and
 * that the constraints the UI relies on are actually enforced there rather than
 * only assumed.
 */

const secretForm = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set('key', 'API_KEY');
  fd.set('value', 'super-secret');
  fd.set('notes', '');
  Object.entries(over).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

const idle = { status: 'idle' as const, message: '' };

describe('the encrypt/decrypt round trip through Postgres', () => {
  it('reads back exactly what was written', async () => {
    const environment = await makeEnvironment();

    await addSecret(idle, secretForm({ env_id: environment.id, value: 'hunter2' }));
    const stored = await prisma.secret.findFirst();

    expect((await getSecretById(stored!.id))?.value).toBe('hunter2');
  });

  it('stores ciphertext, not the plaintext, in the column', async () => {
    const environment = await makeEnvironment();

    await addSecret(idle, secretForm({ env_id: environment.id, value: 'hunter2' }));
    const stored = await prisma.secret.findFirst();

    expect(stored?.encryptedValue).not.toContain('hunter2');
    expect(Buffer.from(stored!.encryptedValue, 'hex').toString('utf8')).not.toContain('hunter2');
  });

  it('round-trips multibyte values', async () => {
    const environment = await makeEnvironment();

    await addSecret(idle, secretForm({ env_id: environment.id, value: 'pässwörd 秘密 🔐' }));
    const stored = await prisma.secret.findFirst();

    expect((await getSecretById(stored!.id))?.value).toBe('pässwörd 秘密 🔐');
  });

  it('never decrypts on the list path', async () => {
    const environment = await makeEnvironment();
    await addSecret(idle, secretForm({ env_id: environment.id }));

    const [secret] = await getSecrets();

    expect(secret).not.toHaveProperty('value');
  });

  // The `Omit` in the exported Secret type is erased at compile time, so only a
  // real query proves the columns are absent from the object the UI receives.
  it('does not carry the encrypted columns at runtime', async () => {
    const environment = await makeEnvironment();
    await addSecret(idle, secretForm({ env_id: environment.id }));

    const [secret] = await getSecrets();

    expect(secret).not.toHaveProperty('encryptedValue');
    expect(secret).not.toHaveProperty('iv');
    expect(secret).not.toHaveProperty('authTag');
  });

  it('lowercases the environment type read back from the enum column', async () => {
    const environment = await prisma.environment.create({
      data: { name: 'prod', type: 'PRODUCTION', requireApproval: true },
    });
    await addSecret(idle, secretForm({ env_id: environment.id }));

    const [secret] = await getSecrets();

    expect(secret.environment.type).toBe('production');
  });
});

describe('constraints', () => {
  // @@unique([environmentId, key]) — the same key twice in one environment.
  it('rejects a duplicate key within an environment', async () => {
    const environment = await makeEnvironment();

    await addSecret(idle, secretForm({ env_id: environment.id, key: 'API_KEY' }));
    const second = await addSecret(idle, secretForm({ env_id: environment.id, key: 'API_KEY' }));

    expect(second.status).toBe('error');
    expect(await prisma.secret.count()).toBe(1);
  });

  it('allows the same key in two different environments', async () => {
    const first = await makeEnvironment();
    const second = await makeEnvironment();

    await addSecret(idle, secretForm({ env_id: first.id, key: 'API_KEY' }));
    await addSecret(idle, secretForm({ env_id: second.id, key: 'API_KEY' }));

    expect(await prisma.secret.count()).toBe(2);
  });

  /*
   * A real foreign key violation from a real database, translated all the way
   * through to the copy the user sees. The mocked unit test can only prove the
   * branch fires for a hand-built error; this proves the error a live query
   * actually throws is the one the branch matches.
   */
  it('reports a friendly message for a non-existent environment', async () => {
    const result = await addSecret(idle, secretForm({ env_id: 'does-not-exist' }));

    expect(result).toEqual({ status: 'error', message: 'Selected environment no longer exists.' });
    expect(await prisma.secret.count()).toBe(0);
  });

  /*
   * Guards the import that makes the branch above reachable. prisma/schema.prisma
   * sets `output = "../generated/prisma"`, so the generated client bundles its own
   * runtime and throws *its* copy of the class. Importing the identically-named
   * class from '@prisma/client/runtime/library' instead compiles, type-checks and
   * silently never matches — which is exactly how every P2002/P2003/P2025 branch
   * in lib/actions came to be dead code. See test/helpers/prisma-errors.ts.
   */
  it('throws the generated runtime\'s error class, not @prisma/client\'s', async () => {
    const { PrismaClientKnownRequestError: Generated } = await import('@/generated/prisma/runtime/library');
    const { PrismaClientKnownRequestError: FromClientPkg } = await import('@prisma/client/runtime/library');

    const error = await prisma.secret.create({
      data: { key: 'K', environmentId: 'nope', encryptedValue: 'aa', iv: 'bb', authTag: 'cc' },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Generated);
    expect(error).not.toBeInstanceOf(FromClientPkg);
    expect((error as { code: string }).code).toBe('P2003');
  });

  it('cascades secrets away with their environment', async () => {
    const environment = await makeEnvironment();
    await addSecret(idle, secretForm({ env_id: environment.id }));

    await prisma.environment.delete({ where: { id: environment.id } });

    expect(await prisma.secret.count()).toBe(0);
  });

  it('orphans a secret rather than deleting it with its author', async () => {
    const user = await makeUser();
    const environment = await makeEnvironment();
    await prisma.secret.create({
      data: {
        key: 'K', environmentId: environment.id, createdById: user.id,
        encryptedValue: 'aa', iv: 'bb', authTag: 'cc',
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect((await prisma.secret.findFirst())?.createdById).toBeNull();
  });
});

describe('environment name uniqueness', () => {
  const envForm = (name: string) => {
    const fd = new FormData();
    fd.set('name', name);
    fd.set('type', 'staging');
    fd.set('requireApproval', 'false');
    return fd;
  };

  it('rejects a second environment with the same name', async () => {
    await addEnvironment(idle, envForm('Production'));
    const second = await addEnvironment(idle, envForm('Production'));

    expect(second.status).toBe('error');
    expect(await prisma.environment.count()).toBe(1);
  });

  it('writes the upcased enum value to the column', async () => {
    await addEnvironment(idle, envForm('Staging'));

    expect((await prisma.environment.findFirst())?.type).toBe('STAGING');
  });
});

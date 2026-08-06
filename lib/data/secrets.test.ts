import { getSecrets, getSecretById } from '@/lib/data/secrets';
import { encryptSecret } from '@/lib/utils/crypto';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

const encrypted = encryptSecret('super-secret-value');

const row = (over: Record<string, unknown> = {}) => ({
  id: 'sec-1',
  key: 'API_KEY',
  environmentId: 'env-1',
  notes: null,
  createdById: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...encrypted,
  environment: { type: 'PRODUCTION' as const, name: 'Production' },
  ...over,
});

describe('getSecrets', () => {
  it('lowercases the environment type', async () => {
    prismaMock.secret.findMany.mockResolvedValue([row()] as never);

    const [secret] = await getSecrets();

    expect(secret.environment).toEqual({ type: 'production', name: 'Production' });
  });

  it('never decrypts on the list path', async () => {
    prismaMock.secret.findMany.mockResolvedValue([row()] as never);

    const [secret] = await getSecrets();

    expect(secret).not.toHaveProperty('value');
  });

  /*
   * The list path drops the encrypted columns by not selecting them, which is a
   * query-engine behaviour. A mock returns its fixture verbatim and ignores
   * `omit`, so this tier can only prove the query asked for it. That it actually
   * takes effect is pinned in secrets.integration.test.ts.
   */
  it('asks Postgres not to select the encrypted columns', async () => {
    prismaMock.secret.findMany.mockResolvedValue([] as never);

    await getSecrets();

    expect(prismaMock.secret.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        omit: { encryptedValue: true, iv: true, authTag: true },
      }),
    );
  });

  it('orders newest first', async () => {
    prismaMock.secret.findMany.mockResolvedValue([] as never);

    await getSecrets();

    expect(prismaMock.secret.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

describe('getSecretById', () => {
  it('returns null for an id that does not exist', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(null as never);

    await expect(getSecretById('nope')).resolves.toBeNull();
  });

  // This is the one path that is allowed to produce plaintext, and it is what
  // the SecretDetail modal reads.
  it('decrypts the stored value', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(row({ createdBy: { name: 'kyle' } }) as never);

    const secret = await getSecretById('sec-1');

    expect(secret?.value).toBe('super-secret-value');
  });

  it('flattens the creator to a name', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(row({ createdBy: { name: 'kyle' } }) as never);

    expect((await getSecretById('sec-1'))?.createdBy).toBe('kyle');
  });

  it('yields a null creator for an orphaned secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(row({ createdBy: null }) as never);

    expect((await getSecretById('sec-1'))?.createdBy).toBeNull();
  });

  // A row whose ciphertext no longer matches the current ENCRYPTION_KEY, or was
  // tampered with, makes GCM throw. Nothing catches it, so the page fails rather
  // than rendering a wrong value — pinned deliberately.
  it('propagates a decryption failure rather than returning a bad value', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(
      row({ authTag: 'f'.repeat(32), createdBy: null }) as never,
    );

    await expect(getSecretById('sec-1')).rejects.toThrow();
  });
});

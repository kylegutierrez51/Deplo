import { resolveSecrets } from './secrets';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { encryptSecret } from '@/lib/utils/crypto';

jest.mock('@/lib/prisma');

/*
 * The decryption is deliberately not mocked — fixtures go through the real encryptSecret,
 * so these cases would catch a column being read into the wrong field of decryptSecret,
 * which a stubbed return value would happily hide.
 *
 * Two properties matter more than the mapping itself. Resolution happens here rather than
 * at enqueue time because Redis persists to disk and BullMQ keeps completed jobs, so a
 * plaintext value in job.data is a credential readable via HGETALL. And an id that no
 * longer resolves throws, because the alternative — omitting the variable — hands the
 * command an empty $API_KEY and lets it deploy somewhere half-authenticated.
 */

const row = (id: string, key: string, value: string, environmentId = 'env-1') => ({
  id, key, environmentId, ...encryptSecret(value),
});

const found = (...rows: ReturnType<typeof row>[]) =>
  prismaMock.secret.findMany.mockResolvedValue(rows as never);

beforeEach(() => { resetPrismaMock(); });

describe('resolving nothing', () => {
  it.each([
    ['the stage selected no secrets', {}, 'env-1'],
    ['the stage has an entry for another environment only', { 'env-2': ['s1'] }, 'env-1'],
    ['the run has no environment and the stage wanted nothing', { 'env-1': [] }, null],
  ])('returns an empty map when %s', async (_label, secrets, environmentId) => {
    expect(await resolveSecrets(secrets, environmentId)).toEqual({});
  });

  // The one case that must NOT come back empty. A stage asking for secrets on a run with no
  // environment has nothing to resolve against, and answering {} would hand the command an
  // empty $API_KEY — exactly the silent omission the throw below exists to prevent.
  it('throws when the stage wants secrets and the run has no environment', async () => {
    await expect(resolveSecrets({ 'env-1': ['s1'] }, null)).rejects.toThrow(/no environment/);
  });

  // Not merely an optimization: findMany with an empty `in` matches nothing, so without
  // the early return every unsecreted stage would pay a round trip to prove it.
  it('does not query at all when there is nothing to resolve', async () => {
    await resolveSecrets({}, 'env-1');

    expect(prismaMock.secret.findMany).not.toHaveBeenCalled();
  });
});

describe('resolving', () => {
  it('maps each secret key to its decrypted value', async () => {
    found(row('s1', 'API_KEY', 'sk-live-123'), row('s2', 'DB_PASSWORD', 'hunter2'));

    expect(await resolveSecrets({ 'env-1': ['s1', 's2'] }, 'env-1'))
      .toEqual({ API_KEY: 'sk-live-123', DB_PASSWORD: 'hunter2' });
  });

  /*
   * The editor's handleSecretToggle spreads the existing map, so a pipeline edited under
   * one environment and then another keeps entries for both. Resolving the union would
   * hand a production run the staging credentials it happens to still list. The run's own
   * environment is the only slice that counts.
   */
  it('ignores entries left behind by another environment', async () => {
    found(row('s1', 'API_KEY', 'from-env-1'));

    await resolveSecrets({ 'env-1': ['s1'], 'env-2': ['s2', 's3'] }, 'env-1');

    expect(prismaMock.secret.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['s1'] }, environmentId: 'env-1' },
    }));
  });

  // Belt as well as braces: scoping the query by environmentId means a definition naming
  // a secret id from a different environment resolves to nothing and throws below, rather
  // than succeeding because ids are globally unique.
  it('scopes the lookup to the environment, not to ids alone', async () => {
    found(row('s1', 'API_KEY', 'v'));

    await resolveSecrets({ 'env-1': ['s1'] }, 'env-1');

    expect(prismaMock.secret.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ environmentId: 'env-1' }),
    }));
  });

  it('asks for each id once when a stage lists it twice', async () => {
    found(row('s1', 'API_KEY', 'v'));

    await resolveSecrets({ 'env-1': ['s1', 's1'] }, 'env-1');

    expect(prismaMock.secret.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['s1'] } }),
    }));
  });
});

describe('when a secret has gone', () => {
  it('throws rather than omitting the variable', async () => {
    found(row('s1', 'API_KEY', 'v'));

    await expect(resolveSecrets({ 'env-1': ['s1', 's2'] }, 'env-1')).rejects.toThrow();
  });

  // The message ends up in logSnippet, which is the only thing the person looking at the
  // failed stage will see. An id they can search for beats "secret resolution failed".
  it('names the ids it could not resolve', async () => {
    found(row('s1', 'API_KEY', 'v'));

    await expect(resolveSecrets({ 'env-1': ['s1', 's2'] }, 'env-1')).rejects.toThrow(/s2/);
  });
});

import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/utils/crypto';

/*
==============================================================================================
 * Turns the secret ids a stage selected into the environment variables its command runs with.
 *
 * Called immediately before the command is run. The stage job payload carries
 * three ids and nothing else because Redis persists to disk and BullMQ keeps completed
 * jobs by default, so a decrypted value in job.data is a credential sitting in an AOF file
 * and readable with HGETALL. Resolved here, the plaintext exists only in this process's
 * memory and in the child's environment, for the length of one command.
 *
 * A secret id that no longer exists in the prisma query throws.
==============================================================================================
*/
export async function resolveSecrets(
  secretsByEnvironment: Record<string, string[]>,
  environmentId: string | null,
): Promise<Record<string, string>> {

  if (!environmentId) return {};

  const ids = [...new Set(secretsByEnvironment[environmentId] ?? [])];

  if (ids.length === 0) return {};

  const secrets = await prisma.secret.findMany({
    where: { id: { in: ids }, environmentId },
    select: { id: true, key: true, encryptedValue: true, iv: true, authTag: true },
  });

  if (secrets.length !== ids.length) {
    const found = new Set(secrets.map(secret => secret.id));
    const missing = ids.filter(id => !found.has(id));
    throw new Error(
      `secrets not found in environment ${environmentId}: ${missing.join(', ')}`,
    );
  }

  return Object.fromEntries(secrets.map(secret => [secret.key, decryptSecret(secret)]));
}

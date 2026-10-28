import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/utils/crypto';

/*
==============================================================================================
 * Turns the secret ids a stage selected into the environment variables its command runs with.
 *
 * When a stage is enqueued and the worker holds onto it, it is stored in Redis.
 * This stores three things in Redis: (stage id, run id, attempt)
 * 
 * Once BullMQ is ready to execute the stage, a worker takes the job **OUT** of Redis
 * and calls `processStage`, which goes to `attemptStage`. 
 * So we call resolveSecrets() within `attemptStage`, leaving the secrets only within the 
 * worker's memory and in the stage's environment, NOT in Redis.
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

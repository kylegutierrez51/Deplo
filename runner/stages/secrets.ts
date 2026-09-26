import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/utils/crypto';

/*
==============================================================================================
 * Turns the secret ids a stage selected into the environment variables its command runs with.
 *
 * Called immediately before spawn, never at enqueue time. The stage job payload carries
 * three ids and nothing else because Redis persists to disk and BullMQ keeps completed
 * jobs by default, so a decrypted value in job.data is a credential sitting in an AOF file
 * and readable with HGETALL. Resolved here, the plaintext exists only in this process's
 * memory and in the child's environment, for the length of one command.
 *
 * `secretsByEnvironment` is the node's config verbatim: environmentId → secretId[]. Only
 * the run's own environment is resolved. The editor's handleSecretToggle spreads the
 * existing map when the selected environment changes, so a pipeline that has been edited
 * against staging and then production legitimately carries entries for both — and
 * resolving the union would hand a production run its leftover staging credentials.
 *
 * An id that no longer resolves throws. Omitting the variable instead would let the
 * command run with an empty $API_KEY and fail somewhere far away from the cause, or worse,
 * succeed against the wrong target.
==============================================================================================
*/
export async function resolveSecrets(
  secretsByEnvironment: Record<string, string[]>,
  environmentId: string | null,
): Promise<Record<string, string>> {
  // returns an empty map if there is no environment targeted for the run
  if (!environmentId) {
    if (Object.values(secretsByEnvironment).every(ids => ids.length === 0)) return {};
    throw new Error('stage selects secrets but its run targets no environment');
  }

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

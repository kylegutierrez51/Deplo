import { PrismaClientKnownRequestError } from '@/generated/prisma/runtime/library';

/*
 * Builds the error a real Prisma call throws.
 *
 * This must come from '@/generated/prisma/runtime/library', NOT from
 * '@prisma/client/runtime/library'. The schema sets `output = "../generated/prisma"`,
 * so the generated client bundles its own copy of the runtime, and the two
 * PrismaClientKnownRequestError classes are different objects:
 *
 *   err instanceof (from @prisma/client/runtime/library)  // false
 *   err instanceof (from @/generated/prisma/runtime)      // true
 *
 * Verified against a live database — see lib/data/secrets.integration.test.ts.
 *
 * The actions in lib/actions/ reach the class through `Prisma.PrismaClientKnownRequestError`
 * on the generated client, which is the same object. Building errors here from
 * '@prisma/client/runtime/library' instead would make every `instanceof` guard
 * miss, and the unit tests would quietly characterize a fiction of their own
 * making rather than production — which is how those branches were dead for as
 * long as they were.
 */
export const prismaError = (code: string, message = 'boom') =>
  new PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3' });

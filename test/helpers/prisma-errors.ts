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
 * Verified against a live database — see lib/actions/*.integration.test.ts.
 *
 * Every action in lib/actions/ imports the class from '@prisma/client/runtime/library',
 * so their `instanceof` guards never match and all their P2002/P2003/P2025
 * translation is unreachable. Using the real class here is what makes the unit
 * tests characterize production rather than a fiction of their own making.
 */
export const prismaError = (code: string, message = 'boom') =>
  new PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3' });

/**
 * The error the actions' `instanceof` guards *would* match. Only useful for
 * demonstrating the mismatch — a real query never throws one of these.
 */
export { PrismaClientKnownRequestError as UnreachableErrorClass } from '@prisma/client/runtime/library';

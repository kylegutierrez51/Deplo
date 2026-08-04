import prisma from '@/lib/prisma';
import { mockReset, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '@/generated/prisma/client';

/*
 * Typed handle on the manual mock in lib/__mocks__/prisma.ts.
 *
 * Read it back through '@/lib/prisma' rather than importing the __mocks__ file
 * directly: Jest instantiates a manual mock in its own registry slot, so an
 * explicit `import from '@/lib/__mocks__/prisma'` hands back a *different*
 * object than the one injected into lib/data and lib/actions, and every stub
 * set on it is silently ignored.
 *
 * Test files must still opt in, and jest.mock is hoisted above imports so the
 * order of these two lines does not matter:
 *
 *   jest.mock('@/lib/prisma');
 *   import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
 */
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

/** Call in beforeEach — a deep mock accumulates calls and stubs across tests otherwise. */
export function resetPrismaMock() {
  mockReset(prismaMock);
}

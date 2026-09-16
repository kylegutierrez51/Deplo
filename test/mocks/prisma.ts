import prisma from '@/lib/prisma';
import { mockDeep, mockReset, type DeepMockProxy } from 'jest-mock-extended';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';

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

/**
 * Makes $transaction run its callback, which the bare deep mock never does — it resolves
 * undefined without calling it, so every write inside silently never happens.
 *
 * By default the callback gets the mock itself, so existing stubs keep working. Pass a
 * separate `tx` (from `transactionMock()`) when the test is *about* the boundary: with one
 * shared object, a write sent to the singleton instead of `tx` is indistinguishable from a
 * correct one, which is exactly how an audit ends up committing outside its transaction.
 */
export function runTransactionsInline(tx: DeepMockProxy<Prisma.TransactionClient> = prismaMock) {
  prismaMock.$transaction.mockImplementation(
    (async (cb: (client: typeof tx) => unknown) => cb(tx)) as never,
  );
}

/** A transaction client distinct from the singleton. Create one per test. */
export const transactionMock = () => mockDeep<Prisma.TransactionClient>();

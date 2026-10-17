/*
 * lib/prisma.ts keeps its clients on globalThis so a dev reload cannot drop them, and has to
 * cope with more than one copy of the Prisma runtime in the same process: Next bundles
 * generated/prisma once per layer ([app-rsc] for pages, [app-route] for route handlers) and
 * again after every regenerate. Each copy is modelled here as a distinct PrismaClient class;
 * isolateModulesAsync gives a fresh lib/prisma.ts instance, which is what a reload does.
 *
 * The real generated client is replaced so nothing loads the query engine or opens a pool.
 */
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@/generated/prisma/client', () => ({ PrismaClient: mockCurrentCopy() }));

class FakeClient {
  $disconnect = jest.fn(async () => {});
}

let mockCopy: typeof FakeClient = class extends FakeClient {};
const mockCurrentCopy = () => mockCopy;

/** A new copy of the generated runtime, as a second layer or a regenerate produces. */
const newRuntimeCopy = () => { mockCopy = class extends FakeClient {}; };

async function loadPrisma(): Promise<FakeClient> {
  let client!: FakeClient;
  await jest.isolateModulesAsync(async () => {
    client = (await import('./prisma')).default as unknown as FakeClient;
  });
  return client;
}

beforeEach(() => {
  delete (globalThis as { prismaClients?: unknown }).prismaClients;
  newRuntimeCopy();
});

it('reuses the client when only lib/prisma.ts is re-evaluated', async () => {
  const first = await loadPrisma();
  const second = await loadPrisma();

  expect(second).toBe(first);
});

it('gives a second runtime copy its own client', async () => {
  const rsc = await loadPrisma();
  newRuntimeCopy();
  const route = await loadPrisma();

  expect(route).not.toBe(rsc);
  expect(route).toBeInstanceOf(mockCopy);
});

/*
 * The regression: the route handlers' copy used to treat the pages' client as stale and
 * disconnect it, while the pages' copy was still querying it. Queries in flight during that
 * teardown failed with "Engine is not yet connected".
 */
it("never disconnects another copy's client", async () => {
  const rsc = await loadPrisma();
  newRuntimeCopy();
  await loadPrisma();

  expect(rsc.$disconnect).not.toHaveBeenCalled();
});

it('hands each copy back its own client when they load alternately', async () => {
  const rscCopy = mockCopy;
  const rsc = await loadPrisma();
  newRuntimeCopy();
  const route = await loadPrisma();

  mockCopy = rscCopy;
  expect(await loadPrisma()).toBe(rsc);
  expect(route.$disconnect).not.toHaveBeenCalled();
});

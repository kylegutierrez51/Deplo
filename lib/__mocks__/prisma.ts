import { mockDeep } from 'jest-mock-extended';
import type { PrismaClient } from '@/generated/prisma/client';

/*
 * Manual mock for lib/prisma.ts, picked up automatically by `jest.mock('@/lib/prisma')`
 * with no factory argument — which keeps test files clear of jest.mock hoisting rules.
 *
 * This has to exist rather than being optional: lib/prisma.ts constructs a PrismaPg
 * adapter against process.env.DATABASE_URL at module scope, before the singleton
 * check. So merely importing anything from lib/data or lib/actions opens a real
 * connection unless this stands in.
 *
 * mockDeep proxies arbitrary depth, so prismaMock.pipeline.findMany and
 * prismaMock.$transaction are both jest.fn()s without being declared here.
 *
 * Do not import this file from a test. Go through '@/test/mocks/prisma', which
 * reads the instance Jest actually injected — see the note there.
 */
export default mockDeep<PrismaClient>();

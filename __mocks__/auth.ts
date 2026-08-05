import type { Session } from 'next-auth';

/*
 * Manual mock for auth.ts, used via `jest.mock('@/auth')`.
 *
 * The real module builds a NextAuth instance with PrismaAdapter at import time,
 * which drags in the Prisma client and next-auth's runtime — neither of which a
 * server-action unit test needs. Server actions only ever call `await auth()`
 * and read `session?.user?.id`.
 *
 * Import setSession/signedOut from '@/test/mocks/auth' in tests rather than from
 * here; see the note in that file about manual-mock registry instances.
 */

let session: Session | null = null;

export const auth = jest.fn(async () => session);

export function __setSession(next: Session | null) {
  session = next;
}

export const signIn = jest.fn();
export const signOut = jest.fn();
export const handlers = { GET: jest.fn(), POST: jest.fn() };

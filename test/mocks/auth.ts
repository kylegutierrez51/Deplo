import * as authModule from '@/auth';

/*
 * Typed handle on the manual mock in __mocks__/auth.ts. Read back through
 * '@/auth' for the same reason as the Prisma mock: Jest gives a manual mock its
 * own registry slot, so importing the __mocks__ file directly would hand back a
 * different instance than the one injected into lib/actions.
 *
 * Requires `jest.mock('@/auth')` in the test file.
 */
const mocked = authModule as unknown as typeof authModule & {
  __setSession: (session: { user?: { id?: string; name?: string } } | null) => void;
};

/** Signs a user in for the actions under test. */
export function setSession(userId = 'user-1', name = 'kyle') {
  mocked.__setSession({ user: { id: userId, name } });
}

/** No session at all — what an expired cookie or a logged-out caller looks like. */
export function signedOut() {
  mocked.__setSession(null);
}

/**
 * A session whose user carries no id. NextAuth's jwt callback only sets
 * session.user.id when token.sub is present, so actions guard with
 * `session?.user?.id ?? null` and this shape has to behave like signed out.
 */
export function sessionWithoutUserId() {
  mocked.__setSession({ user: {} });
}

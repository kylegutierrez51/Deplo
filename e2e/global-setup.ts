import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { encode } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

/*
 * The only provider is GitHub OAuth, which cannot be driven in CI. Because
 * auth.config.ts uses `session: { strategy: 'jwt' }`, a session is nothing more
 * than a signed cookie — so this mints one directly and hands it to Playwright
 * as storageState, skipping the OAuth round trip entirely.
 *
 * Two details were verified against the installed next-auth@5.0.0-beta.31
 * rather than assumed:
 *   - the cookie is `authjs.session-token` over http (the __Secure- prefix is
 *     only used when the cookie is marked secure)
 *   - encode() takes a `salt`, and it must equal the cookie name
 *
 * auth.ts's jwt callback copies user.id onto token.sub, and its session callback
 * copies token.sub back onto session.user.id — so `sub` is the only claim the
 * app actually reads.
 */

const COOKIE_NAME = 'authjs.session-token';
const STORAGE_STATE = 'e2e/.auth/user.json';

export const E2E_USER = {
  id: 'e2e-user-00000000000000000000',
  name: 'E2E Runner',
  email: 'e2e@example.com',
};

export default async function globalSetup() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be set for E2E runs.');

  /*
   * Clear anything a previous run left behind. E2E deliberately does not
   * truncate between tests the way the integration tier does — the specs need
   * data to persist across navigations — so without this the pipelines table
   * grows every run until text lookups turn ambiguous and the list page slows.
   *
   * Scoped to the fixtures these specs create, so pointing DATABASE_URL at a
   * database with other data in it does not destroy it.
   */
  await prisma.pipeline.deleteMany({ where: { name: { startsWith: 'e2e-' } } });
  await prisma.environment.deleteMany({ where: { name: { startsWith: 'e2e-' } } });

  // The session points at a real row, because pages join on it.
  await prisma.user.upsert({
    where: { id: E2E_USER.id },
    update: {},
    create: E2E_USER,
  });

  const token = await encode({
    token: { sub: E2E_USER.id, name: E2E_USER.name, email: E2E_USER.email },
    secret,
    salt: COOKIE_NAME,
    maxAge: 60 * 60,
  });

  const state = {
    cookies: [{
      name: COOKIE_NAME,
      value: token,
      domain: '127.0.0.1',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    }],
    origins: [],
  };

  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  writeFileSync(STORAGE_STATE, JSON.stringify(state, null, 2));

  await prisma.$disconnect();
}

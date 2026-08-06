/*
 * Runs before the module registry is created, so anything read at module scope
 * sees these values. Two things depend on that ordering:
 *
 *  - lib/utils/crypto.ts does `Buffer.from(process.env.ENCRYPTION_KEY, 'hex')`
 *    at import time and throws when the variable is unset. A setupFilesAfterEnv
 *    hook would run too late to help.
 *  - lib/utils/date.ts formats with toLocaleString('en-US'), so the output
 *    depends on the machine's zone unless TZ is pinned. Without this, date
 *    assertions pass locally and fail on a UTC CI runner.
 *
 * ENCRYPTION_KEY is defaulted rather than assigned, but in normal use the
 * default never fires: next/jest resolves .env.test ahead of .env, and
 * .env.test carries a key of its own, so the variable is already set by the
 * time this runs. Same in CI, where the workflow exports one into process.env,
 * which outranks every file.
 *
 * What line 28 (??=) still covers is a checkout with no env files at all — .env* is
 * gitignored, and lib/utils/crypto.ts throws at import time on a missing key,
 * so without this line the unit tier could not run until someone wrote one.
 * That tier mocks Prisma and needs no DATABASE_URL, so a key is the only thing
 * standing between a fresh clone and a green `npm test`.
 */

process.env.TZ = 'UTC';

// 32 bytes as hex, the size AES-256-GCM requires. Test-only value.
process.env.ENCRYPTION_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
 * ENCRYPTION_KEY is only defaulted, never overwritten — next/jest loads .env
 * first, and a developer running the suite against their own key should keep it.
 */

process.env.TZ = 'UTC';

// 32 bytes as hex, the size AES-256-GCM requires. Test-only value.
process.env.ENCRYPTION_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

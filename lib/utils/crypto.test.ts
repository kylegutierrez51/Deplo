import { encryptSecret, decryptSecret, generateWebhookSecret } from '@/lib/utils/crypto';

/*
 * This is the only thing standing between the secrets table and plaintext on
 * disk, so the properties that matter are: it round-trips, it never reuses an IV,
 * and tampering is detected rather than silently decrypting to garbage.
 *
 * ENCRYPTION_KEY comes from test/setup-env.mjs, which must run in setupFiles —
 * this module reads the variable at import time and throws when it is missing.
 */

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a value', () => {
    expect(decryptSecret(encryptSecret('hunter2'))).toBe('hunter2');
  });

  it('does not store the plaintext in the ciphertext', () => {
    const { encryptedValue } = encryptSecret('hunter2');

    expect(Buffer.from(encryptedValue, 'hex').toString('utf8')).not.toContain('hunter2');
  });

  it('returns hex-encoded ciphertext, iv and authTag', () => {
    const { encryptedValue, iv, authTag } = encryptSecret('value');

    expect(iv).toMatch(/^[0-9a-f]{24}$/);      // 12 bytes, as GCM wants
    expect(authTag).toMatch(/^[0-9a-f]{32}$/); // 16 bytes
    expect(encryptedValue).toMatch(/^[0-9a-f]*$/);
  });

  // A repeated IV under GCM is catastrophic, so this is the single most
  // important property in the file.
  it('uses a fresh iv for every call', () => {
    const ivs = new Set(Array.from({ length: 50 }, () => encryptSecret('same input').iv));

    expect(ivs.size).toBe(50);
  });

  it('produces different ciphertext for the same plaintext twice', () => {
    expect(encryptSecret('same').encryptedValue).not.toBe(encryptSecret('same').encryptedValue);
  });

  it.each([
    ['an empty string', ''],
    ['multibyte unicode', 'pässwörd — 秘密 🔐'],
    ['a long value', 'x'.repeat(10_000)],
    ['newlines and tabs', 'line1\nline2\tend'],
  ])('round-trips %s', (_label, plaintext) => {
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });
});

describe('decryptSecret tamper detection', () => {
  // GCM's auth tag is the whole point of choosing it over CBC — a modified
  // ciphertext must fail loudly rather than decrypt to plausible garbage.
  it('throws when the ciphertext was modified', () => {
    const encrypted = encryptSecret('hunter2');
    const flipped = encrypted.encryptedValue.startsWith('0')
      ? '1' + encrypted.encryptedValue.slice(1)
      : '0' + encrypted.encryptedValue.slice(1);

    expect(() => decryptSecret({ ...encrypted, encryptedValue: flipped })).toThrow();
  });

  it('throws when the auth tag was modified', () => {
    const encrypted = encryptSecret('hunter2');
    const flipped = encrypted.authTag.startsWith('0')
      ? '1' + encrypted.authTag.slice(1)
      : '0' + encrypted.authTag.slice(1);

    expect(() => decryptSecret({ ...encrypted, authTag: flipped })).toThrow();
  });

  it('throws when the iv does not match the one used to encrypt', () => {
    const encrypted = encryptSecret('hunter2');
    const otherIv = encryptSecret('anything').iv;

    expect(() => decryptSecret({ ...encrypted, iv: otherIv })).toThrow();
  });

  it('throws when the ciphertext of one secret is paired with another auth tag', () => {
    const a = encryptSecret('secret A');
    const b = encryptSecret('secret B');

    expect(() => decryptSecret({ ...a, authTag: b.authTag })).toThrow();
  });
});

describe('generateWebhookSecret', () => {
  it('is prefixed and carries 32 bytes of hex', () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_[0-9a-f]{64}$/);
  });

  it('never repeats', () => {
    const secrets = new Set(Array.from({ length: 100 }, generateWebhookSecret));

    expect(secrets.size).toBe(100);
  });
});

describe('module initialisation', () => {
  // The throw happens at import time, so it can only be observed by re-importing
  // the module in a fresh registry with the variable removed.
  it('throws when ENCRYPTION_KEY is not set', async () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    try {
      await expect(
        jest.isolateModulesAsync(async () => { await import('@/lib/utils/crypto'); }),
      ).rejects.toThrow('ENCRYPTION_KEY is not set');
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });
});

import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "node:crypto";

const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY ?? (() => { throw new Error("ENCRYPTION_KEY is not set"); })(),
  "hex"
);

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encryptedValue = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encryptedValue, iv: iv.toString("hex"), authTag };
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

export function decryptSecret(encryptedData: ReturnType<typeof encryptSecret>): string {
  const { encryptedValue, iv, authTag } = encryptedData;

  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// GitHub signs the raw request body: X-Hub-Signature-256 is "sha256=" + hex HMAC-SHA256.
// rawBody must be the exact bytes received, not re-serialized JSON.
export function verifyWebhookSignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`);
  const received = Buffer.from(signature);

  // timingSafeEqual throws on a length mismatch
  return expected.length === received.length && timingSafeEqual(expected, received);
}

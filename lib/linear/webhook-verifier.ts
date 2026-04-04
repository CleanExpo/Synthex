import * as crypto from 'crypto';

/**
 * Verify a Linear webhook signature.
 * Returns false if secret is unset (fail-closed).
 */
export function verifyLinearWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) return false;
  try {
    const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
    // Both buffers must be same length for timingSafeEqual
    const hashBuf = Buffer.from(hash, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');
    if (hashBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, sigBuf);
  } catch {
    return false;
  }
}

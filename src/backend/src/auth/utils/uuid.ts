import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure, time-ordered UUID v7.
 * Format: 48-bit timestamp | 4-bit version (7) | 12-bit sequence/random | 2-bit variant (2) | 62-bit random
 */
export function generateUuidV7(): string {
  const now = Date.now(); // 48-bit timestamp (millisecond precision)
  const timestampHex = now.toString(16).padStart(12, '0');

  // 10 random bytes
  const randomBytesBuffer = randomBytes(10);

  // Set version 7: high 4 bits of octet 6 must be 0111 (0x7)
  randomBytesBuffer[0] = (randomBytesBuffer[0] & 0x0f) | 0x70;

  // Set variant 2: high 2 bits of octet 8 must be 10 (0x8)
  randomBytesBuffer[2] = (randomBytesBuffer[2] & 0x3f) | 0x80;

  const randomHex = randomBytesBuffer.toString('hex');

  return [
    timestampHex.substring(0, 8),
    timestampHex.substring(8, 12),
    randomHex.substring(0, 4),
    randomHex.substring(4, 8),
    randomHex.substring(8, 20),
  ].join('-');
}

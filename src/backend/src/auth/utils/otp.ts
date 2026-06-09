import { randomInt } from 'crypto';

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

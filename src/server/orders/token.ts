import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function matchesAccessToken(token: string, expectedHash: string): boolean {
  const tokenHash = Buffer.from(hashAccessToken(token), 'hex');
  const storedHash = Buffer.from(expectedHash, 'hex');
  return (
    tokenHash.length === storedHash.length &&
    timingSafeEqual(tokenHash, storedHash)
  );
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

function getEncryptionKey(): Buffer | undefined {
  if (!env.ORDER_TOKEN_ENCRYPTION_KEY) return undefined;
  return Buffer.from(env.ORDER_TOKEN_ENCRYPTION_KEY, 'hex');
}

export function encryptAccessToken(token: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptAccessToken(value: string): string {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('ORDER_TOKEN_ENCRYPTION_KEY is required to decrypt an order token');
  }

  const [ivValue, authTagValue, encryptedValue] = value.split('.');
  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Stored order access token has an invalid encrypted format');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

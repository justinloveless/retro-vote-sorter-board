import { randomBytes, randomUUID } from 'node:crypto';

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateVerificationCode(): string {
  return randomBytes(32).toString('hex');
}

export function generateSessionId(): string {
  return randomUUID();
}

export function generateUserId(): string {
  return randomUUID();
}

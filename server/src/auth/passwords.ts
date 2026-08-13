import bcrypt from 'bcryptjs';

/** Supabase GoTrue default cost is 10. */
const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a Supabase-compatible bcrypt hash.
 * Returns false for empty/missing hashes or unsupported formats.
 * Uses bcryptjs so Docker builds with --ignore-scripts still work on Alpine.
 */
export async function verifyPassword(
  password: string,
  encryptedPassword: string | null | undefined
): Promise<boolean> {
  if (!encryptedPassword || !password) {
    return false;
  }

  // Supabase stores standard bcrypt hashes ($2a$ / $2b$).
  if (!encryptedPassword.startsWith('$2')) {
    return false;
  }

  try {
    return await bcrypt.compare(password, encryptedPassword);
  } catch {
    return false;
  }
}

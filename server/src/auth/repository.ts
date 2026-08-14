import type pg from 'pg';
import type { AuthIdentityRow, AuthUserRow } from './types.js';

type Queryable = Pick<pg.Pool, 'query'>;

export class AuthRepository {
  constructor(private readonly db: Queryable) {}

  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    const result = await this.db.query<AuthUserRow>(
      `SELECT *
       FROM auth.users
       WHERE lower(email) = lower($1)
         AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );
    return result.rows[0] ?? null;
  }

  async findUserById(id: string): Promise<AuthUserRow | null> {
    const result = await this.db.query<AuthUserRow>(
      `SELECT *
       FROM auth.users
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async listIdentitiesForUser(userId: string): Promise<AuthIdentityRow[]> {
    const result = await this.db.query<AuthIdentityRow>(
      `SELECT *
       FROM auth.identities
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows;
  }

  async findIdentity(
    provider: string,
    providerId: string
  ): Promise<AuthIdentityRow | null> {
    const result = await this.db.query<AuthIdentityRow>(
      `SELECT *
       FROM auth.identities
       WHERE provider = $1
         AND provider_id = $2
       LIMIT 1`,
      [provider, providerId]
    );
    return result.rows[0] ?? null;
  }

  async createUser(params: {
    id?: string;
    email: string;
    encryptedPassword: string | null;
    emailConfirmedAt?: Date | null;
    rawAppMetaData?: Record<string, unknown>;
    rawUserMetaData?: Record<string, unknown>;
  }): Promise<AuthUserRow> {
    const result = await this.db.query<AuthUserRow>(
      `INSERT INTO auth.users (
         id,
         email,
         encrypted_password,
         email_confirmed_at,
         raw_app_meta_data,
         raw_user_meta_data
       )
       VALUES (
         COALESCE($1::uuid, gen_random_uuid()),
         $2,
         $3,
         $4,
         $5::jsonb,
         $6::jsonb
       )
       RETURNING *`,
      [
        params.id ?? null,
        params.email,
        params.encryptedPassword,
        params.emailConfirmedAt ?? null,
        JSON.stringify(params.rawAppMetaData ?? { provider: 'email', providers: ['email'] }),
        JSON.stringify(params.rawUserMetaData ?? {}),
      ]
    );
    return result.rows[0];
  }

  async touchLastSignIn(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET last_sign_in_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }

  async updatePassword(userId: string, encryptedPassword: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.users
       SET encrypted_password = $2,
           updated_at = NOW(),
           recovery_token = NULL,
           recovery_sent_at = NULL
       WHERE id = $1`,
      [userId, encryptedPassword]
    );
  }

  async updateUserMetadata(
    userId: string,
    rawUserMetaData: Record<string, unknown>
  ): Promise<AuthUserRow> {
    const result = await this.db.query<AuthUserRow>(
      `UPDATE auth.users
       SET raw_user_meta_data = $2::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId, JSON.stringify(rawUserMetaData)]
    );
    return result.rows[0];
  }

  async mergeAppMetaProviders(userId: string, provider: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (!user) return;

    const current =
      user.raw_app_meta_data && typeof user.raw_app_meta_data === 'object'
        ? { ...user.raw_app_meta_data }
        : {};
    const providers = Array.isArray(current.providers)
      ? current.providers.map(String)
      : [];
    if (!providers.includes(provider)) {
      providers.push(provider);
    }
    current.provider = provider;
    current.providers = providers;

    await this.db.query(
      `UPDATE auth.users
       SET raw_app_meta_data = $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, JSON.stringify(current)]
    );
  }

  async createIdentity(params: {
    id?: string;
    userId: string;
    provider: string;
    providerId: string;
    identityData: Record<string, unknown>;
    email?: string | null;
  }): Promise<AuthIdentityRow> {
    const result = await this.db.query<AuthIdentityRow>(
      `INSERT INTO auth.identities (
         id,
         user_id,
         provider,
         provider_id,
         identity_data,
         email,
         last_sign_in_at
       )
       VALUES (
         COALESCE($1::uuid, gen_random_uuid()),
         $2,
         $3,
         $4,
         $5::jsonb,
         $6,
         NOW()
       )
       RETURNING *`,
      [
        params.id ?? null,
        params.userId,
        params.provider,
        params.providerId,
        JSON.stringify(params.identityData),
        params.email ?? null,
      ]
    );
    return result.rows[0];
  }

  async touchIdentity(identityId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.identities
       SET last_sign_in_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [identityId]
    );
  }

  async storeRefreshToken(params: {
    token: string;
    userId: string;
    parent?: string | null;
    sessionId?: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO auth.refresh_tokens (token, user_id, parent, session_id)
       VALUES ($1, $2, $3, $4::uuid)`,
      [params.token, params.userId, params.parent ?? null, params.sessionId ?? null]
    );
  }

  async findRefreshToken(
    token: string
  ): Promise<{ id: string; user_id: string; revoked: boolean; session_id: string | null } | null> {
    const result = await this.db.query<{
      id: string;
      user_id: string;
      revoked: boolean;
      session_id: string | null;
    }>(
      `SELECT id, user_id, revoked, session_id
       FROM auth.refresh_tokens
       WHERE token = $1
       LIMIT 1`,
      [token]
    );
    return result.rows[0] ?? null;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.refresh_tokens
       SET revoked = TRUE,
           updated_at = NOW()
       WHERE token = $1`,
      [token]
    );
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.refresh_tokens
       SET revoked = TRUE,
           updated_at = NOW()
       WHERE user_id = $1
         AND revoked = FALSE`,
      [userId]
    );
  }

  async createVerificationCode(params: {
    userId: string;
    code: string;
    type: string;
    expiresAt: Date;
    redirectTo?: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO auth.verification_codes (user_id, code, type, expires_at, redirect_to)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.userId, params.code, params.type, params.expiresAt, params.redirectTo ?? null]
    );
  }

  async findValidVerificationCode(
    code: string,
    type: string
  ): Promise<{ id: string; user_id: string; redirect_to: string | null } | null> {
    const result = await this.db.query<{
      id: string;
      user_id: string;
      redirect_to: string | null;
    }>(
      `SELECT id, user_id, redirect_to
       FROM auth.verification_codes
       WHERE code = $1
         AND type = $2
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [code, type]
    );
    return result.rows[0] ?? null;
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await this.db.query(
      `UPDATE auth.verification_codes
       SET used_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async ensureProfile(params: {
    userId: string;
    fullName?: string | null;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO public.profiles (id, full_name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [params.userId, params.fullName ?? null]
      );
    } catch {
      // profiles table may not exist until Phase 3 restore
    }
  }
}

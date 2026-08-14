import type pg from 'pg';
import type { AppConfig } from '../config.js';
import { signAccessToken, verifyAccessToken } from './jwt.js';
import { sendMail } from './mail.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { AuthRepository } from './repository.js';
import { serializeUser } from './serialize.js';
import {
  generateRefreshToken,
  generateSessionId,
  generateVerificationCode,
} from './tokens.js';
import type { AuthTokenResponse, AuthUserPublic } from './types.js';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  private readonly repo: AuthRepository;

  constructor(
    private readonly config: AppConfig,
    db: Pick<pg.Pool, 'query'>
  ) {
    this.repo = new AuthRepository(db);
  }

  private requireJwtSecret(): string {
    if (!this.config.JWT_SECRET) {
      throw new AuthError('JWT_SECRET is not configured', 500, 'config_error');
    }
    return this.config.JWT_SECRET;
  }

  private async issueSession(userId: string): Promise<AuthTokenResponse> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AuthError('User not found', 404, 'user_not_found');
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      throw new AuthError('User is banned', 403, 'user_banned');
    }

    const identities = await this.repo.listIdentitiesForUser(user.id);
    const sessionId = generateSessionId();
    const refreshToken = generateRefreshToken();
    const expiresIn = this.config.JWT_ACCESS_TTL_SECONDS;
    const { token, expiresAt } = await signAccessToken({
      secret: this.requireJwtSecret(),
      userId: user.id,
      email: user.email,
      role: user.role || 'authenticated',
      expiresInSeconds: expiresIn,
      sessionId,
      issuer: this.config.JWT_ISSUER,
    });

    await this.repo.storeRefreshToken({
      token: refreshToken,
      userId: user.id,
      sessionId,
    });
    await this.repo.touchLastSignIn(user.id);

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
      refresh_token: refreshToken,
      user: serializeUser(user, identities),
    };
  }

  async signUp(params: {
    email: string;
    password: string;
    data?: Record<string, unknown>;
  }): Promise<AuthTokenResponse> {
    const email = params.email.trim().toLowerCase();
    if (!email || !params.password) {
      throw new AuthError('Email and password are required', 400, 'validation_failed');
    }
    if (params.password.length < 6) {
      throw new AuthError('Password must be at least 6 characters', 400, 'weak_password');
    }

    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      throw new AuthError('User already registered', 400, 'user_already_exists');
    }

    const encryptedPassword = await hashPassword(params.password);
    const user = await this.repo.createUser({
      email,
      encryptedPassword,
      emailConfirmedAt: new Date(),
      rawUserMetaData: params.data ?? {},
      rawAppMetaData: { provider: 'email', providers: ['email'] },
    });

    await this.repo.createIdentity({
      userId: user.id,
      provider: 'email',
      providerId: user.id,
      identityData: {
        sub: user.id,
        email,
        email_verified: true,
      },
      email,
    });

    const fullName =
      typeof params.data?.full_name === 'string' ? params.data.full_name : null;
    await this.repo.ensureProfile({ userId: user.id, fullName });

    return this.issueSession(user.id);
  }

  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthTokenResponse> {
    const email = params.email.trim().toLowerCase();
    const user = await this.repo.findUserByEmail(email);
    if (!user || !user.encrypted_password) {
      throw new AuthError('Invalid login credentials', 400, 'invalid_credentials');
    }

    const ok = await verifyPassword(params.password, user.encrypted_password);
    if (!ok) {
      throw new AuthError('Invalid login credentials', 400, 'invalid_credentials');
    }

    return this.issueSession(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
    if (!refreshToken) {
      throw new AuthError('refresh_token required', 400, 'validation_failed');
    }

    const stored = await this.repo.findRefreshToken(refreshToken);
    if (!stored || stored.revoked) {
      throw new AuthError('Invalid refresh token', 401, 'invalid_grant');
    }

    await this.repo.revokeRefreshToken(refreshToken);

    const user = await this.repo.findUserById(stored.user_id);
    if (!user) {
      throw new AuthError('User not found', 404, 'user_not_found');
    }

    const identities = await this.repo.listIdentitiesForUser(user.id);
    const sessionId = stored.session_id || generateSessionId();
    const newRefresh = generateRefreshToken();
    const expiresIn = this.config.JWT_ACCESS_TTL_SECONDS;
    const { token, expiresAt } = await signAccessToken({
      secret: this.requireJwtSecret(),
      userId: user.id,
      email: user.email,
      role: user.role || 'authenticated',
      expiresInSeconds: expiresIn,
      sessionId,
      issuer: this.config.JWT_ISSUER,
    });

    await this.repo.storeRefreshToken({
      token: newRefresh,
      userId: user.id,
      parent: refreshToken,
      sessionId,
    });
    await this.repo.touchLastSignIn(user.id);

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
      refresh_token: newRefresh,
      user: serializeUser(user, identities),
    };
  }

  async getUser(accessToken: string): Promise<AuthUserPublic> {
    const claims = await verifyAccessToken(accessToken, this.requireJwtSecret());
    const user = await this.repo.findUserById(claims.sub);
    if (!user) {
      throw new AuthError('User not found', 404, 'user_not_found');
    }
    const identities = await this.repo.listIdentitiesForUser(user.id);
    return serializeUser(user, identities);
  }

  async logout(params: {
    accessToken?: string | null;
    refreshToken?: string | null;
    scope?: 'global' | 'local';
  }): Promise<void> {
    if (params.refreshToken) {
      await this.repo.revokeRefreshToken(params.refreshToken);
    }

    if (params.scope === 'global' && params.accessToken) {
      try {
        const claims = await verifyAccessToken(params.accessToken, this.requireJwtSecret());
        await this.repo.revokeAllRefreshTokensForUser(claims.sub);
      } catch {
        // ignore invalid access token on logout
      }
    }
  }

  async updateUser(
    accessToken: string,
    updates: { password?: string; data?: Record<string, unknown> }
  ): Promise<AuthUserPublic> {
    const claims = await verifyAccessToken(accessToken, this.requireJwtSecret());
    const user = await this.repo.findUserById(claims.sub);
    if (!user) {
      throw new AuthError('User not found', 404, 'user_not_found');
    }

    if (updates.password) {
      if (updates.password.length < 6) {
        throw new AuthError('Password must be at least 6 characters', 400, 'weak_password');
      }
      const encrypted = await hashPassword(updates.password);
      await this.repo.updatePassword(user.id, encrypted);
    }

    if (updates.data) {
      const merged = {
        ...(user.raw_user_meta_data ?? {}),
        ...updates.data,
      };
      await this.repo.updateUserMetadata(user.id, merged);
    }

    const fresh = await this.repo.findUserById(user.id);
    const identities = await this.repo.listIdentitiesForUser(user.id);
    return serializeUser(fresh!, identities);
  }

  async recover(email: string, redirectTo?: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.repo.findUserByEmail(normalized);
    // Always succeed to avoid account enumeration
    if (!user) {
      return;
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.repo.createVerificationCode({
      userId: user.id,
      code,
      type: 'recovery',
      expiresAt,
      redirectTo: redirectTo ?? null,
    });

    // Issue short-lived recovery session tokens for FE ResetPassword parity
    const session = await this.issueSession(user.id);
    const target =
      redirectTo ||
      `${this.config.PUBLIC_SITE_URL || 'http://localhost:8081'}/reset-password`;
    const url = new URL(target);
    // Prefer hash fragment like Supabase
    url.hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(session.expires_in),
      token_type: 'bearer',
      type: 'recovery',
    }).toString();

    // Also store code for alternate confirm endpoint
    await sendMail(this.config, {
      to: normalized,
      subject: 'Reset your Retroscope password',
      text: `Reset your password using this link:\n\n${url.toString()}\n\nOr use code: ${code}\n\nThis link expires in 1 hour.`,
      html: `<p>Reset your password:</p><p><a href="${url.toString()}">Reset password</a></p><p>Or use code: <code>${code}</code></p>`,
    });
  }

  async confirmRecovery(code: string, newPassword: string): Promise<AuthTokenResponse> {
    const row = await this.repo.findValidVerificationCode(code, 'recovery');
    if (!row) {
      throw new AuthError('Invalid or expired recovery code', 400, 'otp_expired');
    }
    if (newPassword.length < 6) {
      throw new AuthError('Password must be at least 6 characters', 400, 'weak_password');
    }

    const encrypted = await hashPassword(newPassword);
    await this.repo.updatePassword(row.user_id, encrypted);
    await this.repo.markVerificationCodeUsed(row.id);
    await this.repo.revokeAllRefreshTokensForUser(row.user_id);
    return this.issueSession(row.user_id);
  }

  getGoogleAuthorizeUrl(redirectTo?: string): string {
    if (!this.config.GOOGLE_CLIENT_ID || !this.config.OAUTH_GOOGLE_REDIRECT_URI) {
      throw new AuthError('Google OAuth is not configured', 500, 'oauth_not_configured');
    }

    const state = Buffer.from(
      JSON.stringify({
        redirect_to: redirectTo || this.config.PUBLIC_SITE_URL || '/',
        nonce: generateVerificationCode().slice(0, 16),
      })
    ).toString('base64url');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.config.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', this.config.OAUTH_GOOGLE_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async handleGoogleCallback(params: {
    code: string;
    state?: string;
  }): Promise<{ redirectUrl: string }> {
    if (!this.config.GOOGLE_CLIENT_ID || !this.config.GOOGLE_CLIENT_SECRET) {
      throw new AuthError('Google OAuth is not configured', 500, 'oauth_not_configured');
    }
    if (!this.config.OAUTH_GOOGLE_REDIRECT_URI) {
      throw new AuthError('OAUTH_GOOGLE_REDIRECT_URI is not configured', 500, 'oauth_not_configured');
    }

    let redirectTo = this.config.PUBLIC_SITE_URL || '/';
    if (params.state) {
      try {
        const parsed = JSON.parse(
          Buffer.from(params.state, 'base64url').toString('utf8')
        ) as { redirect_to?: string };
        if (parsed.redirect_to) {
          redirectTo = parsed.redirect_to;
        }
      } catch {
        // keep default
      }
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: this.config.GOOGLE_CLIENT_ID,
        client_secret: this.config.GOOGLE_CLIENT_SECRET,
        redirect_uri: this.config.OAUTH_GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new AuthError(`Google token exchange failed: ${body}`, 400, 'oauth_error');
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      id_token?: string;
    };

    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userInfoRes.ok) {
      throw new AuthError('Failed to fetch Google user info', 400, 'oauth_error');
    }

    const profile = (await userInfoRes.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
      given_name?: string;
      family_name?: string;
    };

    if (!profile.sub) {
      throw new AuthError('Google profile missing sub', 400, 'oauth_error');
    }

    const email = profile.email?.toLowerCase() ?? null;
    const emailVerified = Boolean(profile.email_verified);

    let identity = await this.repo.findIdentity('google', profile.sub);
    let userId: string;

    if (identity) {
      userId = identity.user_id;
      await this.repo.touchIdentity(identity.id);
    } else if (email && emailVerified) {
      const existingUser = await this.repo.findUserByEmail(email);
      if (existingUser) {
        userId = existingUser.id;
        await this.repo.createIdentity({
          userId,
          provider: 'google',
          providerId: profile.sub,
          identityData: { ...profile },
          email,
        });
        await this.repo.mergeAppMetaProviders(userId, 'google');
      } else {
        const user = await this.repo.createUser({
          email: email,
          encryptedPassword: null,
          emailConfirmedAt: new Date(),
          rawUserMetaData: {
            full_name: profile.name,
            avatar_url: profile.picture,
            name: profile.name,
            picture: profile.picture,
          },
          rawAppMetaData: { provider: 'google', providers: ['google'] },
        });
        userId = user.id;
        await this.repo.createIdentity({
          userId,
          provider: 'google',
          providerId: profile.sub,
          identityData: { ...profile },
          email,
        });
        await this.repo.ensureProfile({
          userId,
          fullName: profile.name ?? null,
        });
      }
    } else {
      throw new AuthError(
        'Google account email must be verified to sign in',
        400,
        'email_not_confirmed'
      );
    }

    const session = await this.issueSession(userId);
    const url = new URL(redirectTo, this.config.PUBLIC_SITE_URL || 'http://localhost:8081');
    url.hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(session.expires_in),
      token_type: 'bearer',
      provider_token: tokenJson.access_token,
      type: 'signup',
    }).toString();

    return { redirectUrl: url.toString() };
  }
}

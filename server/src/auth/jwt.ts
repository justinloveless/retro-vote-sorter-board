import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  role: string;
  email?: string;
  aud?: string | string[];
  aal?: string;
  session_id?: string;
}

const encoder = new TextEncoder();

function secretKey(secret: string): Uint8Array {
  return encoder.encode(secret);
}

export async function signAccessToken(params: {
  secret: string;
  userId: string;
  email: string | null;
  role?: string;
  expiresInSeconds: number;
  sessionId?: string;
  issuer?: string;
}): Promise<{ token: string; expiresAt: number; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + params.expiresInSeconds;
  const role = params.role ?? 'authenticated';

  const token = await new SignJWT({
    role,
    email: params.email ?? undefined,
    aal: 'aal1',
    session_id: params.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(params.userId)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setIssuer(params.issuer ?? 'retroscope-auth')
    .sign(secretKey(params.secret));

  return { token, expiresAt, expiresIn: params.expiresInSeconds };
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    algorithms: ['HS256'],
  });

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token: missing sub');
  }

  return payload as AccessTokenClaims;
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signAccessToken, verifyAccessToken } from './jwt.js';

const SECRET = 'test-secret-key-with-at-least-32-chars!!';

describe('jwt', () => {
  it('signs PostgREST-compatible claims and verifies them', async () => {
    const { token, expiresIn, expiresAt } = await signAccessToken({
      secret: SECRET,
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'justin.n.loveless@gmail.com',
      expiresInSeconds: 3600,
      sessionId: '22222222-2222-2222-2222-222222222222',
    });

    assert.equal(expiresIn, 3600);
    assert.ok(expiresAt > Math.floor(Date.now() / 1000));

    const claims = await verifyAccessToken(token, SECRET);
    assert.equal(claims.sub, '11111111-1111-1111-1111-111111111111');
    assert.equal(claims.role, 'authenticated');
    assert.equal(claims.email, 'justin.n.loveless@gmail.com');
    assert.equal(claims.aud, 'authenticated');
  });

  it('rejects tampered tokens', async () => {
    const { token } = await signAccessToken({
      secret: SECRET,
      userId: '11111111-1111-1111-1111-111111111111',
      email: null,
      expiresInSeconds: 60,
    });

    await assert.rejects(() => verifyAccessToken(`${token}x`, SECRET));
  });
});

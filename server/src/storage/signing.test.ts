import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeObjectKey, publicObjectUrl } from '../storage/paths.js';
import { buildSignedUrl, signObjectAccess, verifyObjectAccess } from '../storage/signing.js';

describe('storage paths', () => {
  it('normalizes object keys and rejects traversal', () => {
    assert.equal(normalizeObjectKey('/avatars/me.png'), 'avatars/me.png');
    assert.equal(normalizeObjectKey('a/b/c.png'), 'a/b/c.png');
    assert.equal(normalizeObjectKey('../secret'), null);
    assert.equal(normalizeObjectKey('a/../../b'), null);
    assert.equal(normalizeObjectKey(''), null);
  });

  it('builds public object URLs', () => {
    assert.equal(
      publicObjectUrl('https://api.example.com', 'avatars', 'user/me.png'),
      'https://api.example.com/storage/v1/object/public/avatars/user/me.png'
    );
  });
});

describe('storage signing', () => {
  it('signs and verifies object access tokens', () => {
    const secret = 'test-secret-at-least-32-characters!!';
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const token = signObjectAccess(secret, {
      bucket: 'avatars',
      objectKey: 'me.png',
      expiresAt,
    });
    assert.equal(
      verifyObjectAccess(
        secret,
        { bucket: 'avatars', objectKey: 'me.png', expiresAt },
        token
      ),
      true
    );
    assert.equal(
      verifyObjectAccess(
        secret,
        { bucket: 'avatars', objectKey: 'other.png', expiresAt },
        token
      ),
      false
    );
  });

  it('rejects expired signatures', () => {
    const secret = 'test-secret-at-least-32-characters!!';
    const expiresAt = Math.floor(Date.now() / 1000) - 10;
    const token = signObjectAccess(secret, {
      bucket: 'avatars',
      objectKey: 'me.png',
      expiresAt,
    });
    assert.equal(
      verifyObjectAccess(
        secret,
        { bucket: 'avatars', objectKey: 'me.png', expiresAt },
        token
      ),
      false
    );
  });

  it('builds signed URLs with query params', () => {
    const signed = buildSignedUrl(
      'https://api.example.com',
      'test-secret-at-least-32-characters!!',
      'retro-audio',
      'clip.mp3',
      120
    );
    assert.match(signed.signedUrl, /^https:\/\/api\.example\.com\/storage\/v1\/object\/sign\/retro-audio\/clip\.mp3\?token=/);
    assert.ok(signed.expiresAt > Math.floor(Date.now() / 1000));
  });
});

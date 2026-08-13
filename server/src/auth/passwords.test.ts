import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from './passwords.js';

describe('passwords', () => {
  it('hashes and verifies bcrypt passwords', async () => {
    const hash = await hashPassword('Password1234');
    assert.equal(hash.startsWith('$2'), true);
    assert.equal(await verifyPassword('Password1234', hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
  });

  it('verifies a known Supabase-style bcrypt hash', async () => {
    // bcrypt hash for "Password1234" with cost 10
    const hash = await hashPassword('Password1234');
    assert.equal(await verifyPassword('Password1234', hash), true);
  });

  it('rejects missing or non-bcrypt hashes', async () => {
    assert.equal(await verifyPassword('Password1234', null), false);
    assert.equal(await verifyPassword('Password1234', 'argon2$something'), false);
    assert.equal(await verifyPassword('', await hashPassword('x')), false);
  });
});

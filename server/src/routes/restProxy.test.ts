import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { restPathFromRequest } from './restProxy.js';

describe('restPathFromRequest', () => {
  it('strips /rest/v1 prefix for tables', () => {
    assert.equal(restPathFromRequest('/rest/v1/profiles'), 'profiles');
    assert.equal(restPathFromRequest('/rest/v1/profiles?select=*'), 'profiles');
  });

  it('strips prefix for RPC paths', () => {
    assert.equal(
      restPathFromRequest('/rest/v1/rpc/accept_team_invitation'),
      'rpc/accept_team_invitation'
    );
  });

  it('handles root rest path', () => {
    assert.equal(restPathFromRequest('/rest/v1'), '');
    assert.equal(restPathFromRequest('/rest/v1/'), '');
  });
});

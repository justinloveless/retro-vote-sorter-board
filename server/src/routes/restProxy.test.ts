import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { restPathFromRequest, shouldForwardUpstreamHeader } from './restProxy.js';

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

describe('shouldForwardUpstreamHeader', () => {
  it('blocks hop-by-hop and CORS headers from PostgREST', () => {
    assert.equal(shouldForwardUpstreamHeader('Access-Control-Allow-Origin'), false);
    assert.equal(shouldForwardUpstreamHeader('access-control-allow-credentials'), false);
    assert.equal(shouldForwardUpstreamHeader('transfer-encoding'), false);
    assert.equal(shouldForwardUpstreamHeader('content-length'), false);
  });

  it('allows content-type and content-range', () => {
    assert.equal(shouldForwardUpstreamHeader('content-type'), true);
    assert.equal(shouldForwardUpstreamHeader('Content-Range'), true);
    assert.equal(shouldForwardUpstreamHeader('Prefer'), true);
  });
});

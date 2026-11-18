import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diagnose } from '../scripts/elevenlabs_bridge_doctor.mjs';
const health = (fields) => async () => new Response(JSON.stringify({ ok:true, service:'nicholas-elevenlabs-bridge', oauth_configured:false, grant_storage_bound:true, ...fields }), { status:200, headers:{'content-type':'application/json'} });
test('existing production failure is correctly diagnosed without mutating credentials', async () => {
  const r = await diagnose(health({}));
  assert.equal(r.status, 'OAUTH_SECRETS_MISSING');
  assert.equal(r.bridge_reachable, true);
  assert.equal(r.chatgpt_mcp_verified, false);
  assert.equal(r.provider_voice_verified, false);
});
test('public health pass never claims account or voice connected', async () => {
  const r = await diagnose(health({oauth_configured:true}));
  assert.equal(r.status, 'PUBLIC_PREFLIGHT_PASS');
  assert.equal(r.chatgpt_mcp_verified, false);
  assert.equal(r.provider_voice_verified, false);
});
test('missing SQLite grant binding is independently classified', async () => {
  const r = await diagnose(health({oauth_configured:true,grant_storage_bound:false}));
  assert.equal(r.status, 'OAUTH_STORAGE_MISSING');
});
test('404 is not mistaken for a usable OAuth connection', async () => {
  const r = await diagnose(async () => new Response('Not found',{status:404}));
  assert.equal(r.status,'HEALTH_HTTP_ERROR');
});
test('unexpected service is rejected',async () => {
  const r = await diagnose(health({service:'other-service',oauth_configured:true}));
  assert.equal(r.status,'WRONG_SERVICE');
});
test('transport errors are reported without leaking sensitive data', async () => {
  const r = await diagnose(async () => { throw new Error('network failure token-secret'); });
  assert.equal(r.status,'NETWORK_ERROR');
  assert.equal(JSON.stringify(r).includes('token-secret'),false);
});
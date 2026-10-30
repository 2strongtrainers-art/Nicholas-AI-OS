import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleOAuth, isOAuthAccessToken } from '../src/oauth.ts';

const origin = 'https://bridge.example';
const redirect = 'https://chatgpt.com/connector/oauth/callback';
const verifier = 'v'.repeat(43);
const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
const config = { OAUTH_SIGNING_SECRET: 'test-only-signing-secret', CHATGPT_SETUP_CODE: 'test-only-setup-code' };
let mf, dir;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bridge-oauth-'));
  const outfile = join(dir, 'worker.mjs');
  await build({ stdin: { contents: `
    import { handleOAuth, isOAuthAccessToken } from './src/oauth.ts';
    export { OAuthGrantStore } from './src/oauth-grants.ts';
    export default { async fetch(r, env) {
      const origin = new URL(r.url).origin;
      return await handleOAuth(r, env, origin) || new Response(null, {
        status: await isOAuthAccessToken(env, r.headers.get('authorization'), origin) ? 200 : 401
      });
    }};`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'browser', external: ['cloudflare:workers'], outfile });
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "oauth-test", modules: true, modulesRoot: dir, scriptPath: outfile, compatibilityDate: '2026-08-16',
    durableObjects: { OAUTH_GRANTS: { className: 'OAuthGrantStore', useSQLite: true } }, bindings: config }] }));
});
after(async () => { if (mf) await mf.dispose(); if (dir) await rm(dir, { recursive: true, force: true }); });
const params = (extra = {}) => ({ response_type: 'code', client_id: 'test-client', redirect_uri: redirect,
  scope: 'elevenlabs', state: 'state-123', code_challenge: challenge, code_challenge_method: 'S256', ...extra });
const post = (path, body, host = origin) => mf.dispatchFetch(host + path, { method: 'POST', redirect: 'manual', body: new URLSearchParams(body) });
async function code() {
  const r = await post('/oauth/authorize', params({ setup_code: config.CHATGPT_SETUP_CODE }));
  assert.equal(r.status, 302);
  const target = new URL(r.headers.get('location'));
  assert.equal(target.searchParams.get('state'), 'state-123');
  return target.searchParams.get('code');
}
const exchange = (value, extra = {}) => post('/oauth/token', { grant_type: 'authorization_code', client_id: 'test-client',
  redirect_uri: redirect, code_verifier: verifier, code: value, ...extra });
const refresh = (value) => post('/oauth/token', { grant_type: 'refresh_token', client_id: 'test-client', refresh_token: value });
const access = (value, host = origin) => mf.dispatchFetch(host + '/mcp', { headers: { authorization: `Bearer ${value}` } });

test('authorization code is single-use and replay revokes its issued tokens', async () => {
  const c = await code(); const first = await exchange(c); assert.equal(first.status, 200);
  const tokens = await first.json(); assert.equal((await access(tokens.access_token)).status, 200);
  assert.equal((await exchange(c)).status, 400);
  assert.equal((await access(tokens.access_token)).status, 401);
  assert.equal((await refresh(tokens.refresh_token)).status, 400);
});
test('simultaneous code redemption has exactly one winner in SQLite Durable Objects', async () => {
  const c = await code();
  const responses = await Promise.all(Array.from({ length: 12 }, () => exchange(c)));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 400).length, 11);
});
test('refresh rotates once; replay revokes the grant', async () => {
  const first = await (await exchange(await code())).json();
  const next = await refresh(first.refresh_token); assert.equal(next.status, 200);
  const second = await next.json(); assert.notEqual(first.refresh_token, second.refresh_token);
  assert.equal((await access(second.access_token)).status, 200);
  const decode = t => JSON.parse(Buffer.from(t.split('.')[0], 'base64url').toString());
  assert.equal(decode(first.refresh_token).exp, decode(second.refresh_token).exp);
  assert.equal((await refresh(first.refresh_token)).status, 400);
  assert.equal((await access(second.access_token)).status, 401);
});
test('concurrent refresh has exactly one winner', async () => {
  const first = await (await exchange(await code())).json();
  const results = await Promise.all(Array.from({ length: 8 }, () => refresh(first.refresh_token)));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 400).length, 7);
});
test('malformed bearer tokens return false instead of throwing', async () => {
  for (const token of ['payload.!', 'a.a', 'a.b.c', '', 'x'.repeat(9000), '😀.😀']) {
    assert.equal(await isOAuthAccessToken(config, `Bearer ${token}`, origin), false);
    if (/^[\x00-\xff]*$/.test(token)) assert.equal((await access(token)).status, 401);
  }
});
test('PKCE S256 required; missing and plain challenges fail', async () => {
  for (const extra of [{ code_challenge: '' }, { code_challenge_method: 'plain' }, { code_challenge: 'short' }]) {
    assert.equal((await post('/oauth/authorize', params({ setup_code: config.CHATGPT_SETUP_CODE, ...extra }))).status, 400);
  }
});
test('incorrect setup code preserves PKCE in retry form', async () => {
  const r = await post('/oauth/authorize', params({ setup_code: 'wrong' }));
  assert.equal(r.status, 403); const html = await r.text();
  assert.ok(html.includes(`name="code_challenge" value="${challenge}"`));
  assert.ok(html.includes('name="code_challenge_method" value="S256"'));
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
test('verifier, redirect, client, resource must match before code consumption', async () => {
  const c = await code();
  for (const extra of [{ code_verifier: 'z'.repeat(43) }, { redirect_uri: 'https://chatgpt.com/wrong' },
    { client_id: 'other' }, { resource: 'https://other.example/mcp' }]) assert.equal((await exchange(c, extra)).status, 400);
  assert.equal((await exchange(c)).status, 200);
});
test('tokens cannot cross issuer or audience and have no cache', async () => {
  const r = await exchange(await code()); assert.equal(r.headers.get('cache-control'), 'no-store');
  const t = await r.json(); assert.equal((await access(t.access_token, 'https://other.example')).status, 401);
  assert.equal((await access(t.refresh_token)).status, 401);
});
test('missing grant storage fails closed', async () => {
  const r = await handleOAuth(new Request(origin + '/oauth/token', { method: 'POST' }), config, origin);
  assert.equal(r.status, 503);
});
test('grant storage failure issues no tokens', async () => {
  const c = await code();
  const env = { ...config, OAUTH_GRANTS: { idFromName: () => 'id', get: () => ({ fetch: async () => { throw Error('unavailable'); } }) } };
  const r = await handleOAuth(new Request(origin + '/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code',
    client_id: 'test-client', redirect_uri: redirect, code_verifier: verifier, code: c }) }), env, origin);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'temporarily_unavailable');
});
test('malformed token form returns 400', async () => {
  const r = await mf.dispatchFetch(origin + '/oauth/token', { method: 'POST', body: 'broken' }); assert.equal(r.status, 400);
});
test('unsafe callback URLs rejected', async () => {
  for (const uri of ['http://chatgpt.com/callback', 'https://chatgpt.com.evil.example/callback', 'https://u:p@chatgpt.com/callback',
    'https://chatgpt.com/callback#fragment', 'https://chatgpt.com:444/callback', 'http://localhost/callback']) {
    assert.equal((await post('/oauth/authorize', params({ redirect_uri: uri, setup_code: config.CHATGPT_SETUP_CODE }))).status, 400);
  }
});
test('discovery advertises S256 and exact MCP resource', async () => {
  const meta = await (await mf.dispatchFetch(origin + '/.well-known/oauth-authorization-server')).json();
  assert.deepEqual(meta.code_challenge_methods_supported, ['S256']);
  const resource = await (await mf.dispatchFetch(origin + '/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(resource.resource, origin + '/mcp');
});

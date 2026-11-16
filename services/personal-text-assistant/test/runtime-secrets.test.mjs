import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECRET_NAMES, WORKER_NAME, validatedSecrets, wranglerEnvironment,
  runWrangler, installSecrets, main } from '../scripts/runtime-secrets.mjs';

const fixture = () => ({
  CLIENT_TOKEN: 'client-' + 'a'.repeat(30) + '"\\',
  CONTROL_TOKEN: 'control-' + 'b'.repeat(32),
  OPENAI_API_KEY: 'sk-synthetic-provider-key-never-used',
  CONTACTS_JSON: '{}',
  CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare-token-never-used',
  CLOUDFLARE_ACCOUNT_ID: 'synthetic-account',
  UNRELATED_SECRET: 'must-not-be-forwarded',
});
const listed = names => JSON.stringify(names.map(name => ({ name, type: 'secret_text' })));

test('empty contact map is accepted; missing or weak/equal app tokens are rejected', () => {
  assert.equal(validatedSecrets(fixture()).CONTACTS_JSON, '{}');
  for (const name of SECRET_NAMES) {
    const env = fixture(); delete env[name];
    assert.throws(() => validatedSecrets(env));
  }
  for (const value of ['short', 'x'.repeat(513), 'x'.repeat(32) + '\n', ' '.repeat(32)]) {
    assert.throws(() => validatedSecrets({ ...fixture(), CLIENT_TOKEN: value }));
  }
  const env = fixture(); env.CONTROL_TOKEN = env.CLIENT_TOKEN;
  assert.throws(() => validatedSecrets(env), /application_tokens_must_differ/);
});

test('contact configuration accepts only aliases with boolean policy fields', () => {
  const accepted = { pilot_01: { enabled: true, consent: true, auto: false } };
  assert.deepEqual(JSON.parse(validatedSecrets({ ...fixture(), CONTACTS_JSON: JSON.stringify(accepted) }).CONTACTS_JSON), accepted);
  for (const raw of ['not-json', 'null', '[]', '{"id":{"enabled":"true","consent":true}}',
    '{"pilot_01":{"enabled":true,"consent":true,"phone":"private"}}',
    '{"bad alias":{"enabled":true,"consent":true}}']) {
    assert.throws(() => validatedSecrets({ ...fixture(), CONTACTS_JSON: raw }), /contacts_configuration_invalid/);
  }
});

test('bulk serialization sends exactly four strings through stdin, never argv or child env', () => {
  const env = fixture(); const calls = []; let listCount = 0;
  const spawn = (executable, args, options) => {
    calls.push({ executable, args, options });
    if (args.includes('list')) return { status: 0, stdout: listed(listCount++ ? SECRET_NAMES : ['OTHER_SECRET']) };
    return { status: 0, stdout: 'provider diagnostics are never forwarded' };
  };
  installSecrets(env, spawn);
  assert.equal(calls.length, 3);
  assert(calls[0].args.includes('list')); assert(calls[1].args.includes('bulk')); assert(calls[2].args.includes('list'));
  const sent = JSON.parse(calls[1].options.input);
  assert.deepEqual(Object.keys(sent), SECRET_NAMES);
  for (const name of SECRET_NAMES) assert.equal(sent[name], env[name]);
  assert.equal(sent.UNRELATED_SECRET, undefined);
  for (const call of calls) {
    assert.equal(call.args.at(-1), WORKER_NAME);
    assert(!call.args.some(arg => arg.includes(env.CLIENT_TOKEN) || arg.includes(env.OPENAI_API_KEY)));
    for (const name of [...SECRET_NAMES, 'UNRELATED_SECRET']) assert.equal(call.options.env[name], undefined);
    assert.deepEqual(call.options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.equal(call.options.env.WRANGLER_WRITE_LOGS, 'false');
    assert.equal(call.options.env.WRANGLER_SEND_METRICS, 'false');
    assert.equal(call.options.env.WRANGLER_LOG_SANITIZE, 'true');
  }
});

test('absent Worker or failed existing-worker check prevents all secret writes', () => {
  let calls = 0;
  assert.throws(() => installSecrets(fixture(), () => {
    calls++; return { status: 1, stderr: 'Worker not found' };
  }), /wrangler_command_failed/);
  assert.equal(calls, 1);
  calls = 0;
  assert.throws(() => installSecrets(fixture(), () => {
    calls++; return { status: 0, stdout: 'not a verified secret list' };
  }), /worker_secret_list_unverified/);
  assert.equal(calls, 1);
});

test('successful bulk exit is insufficient unless all four encrypted names are confirmed', () => {
  let calls = 0;
  assert.throws(() => installSecrets(fixture(), () => {
    calls++; return { status: 0, stdout: calls === 2 ? '' : listed([]) };
  }), /runtime_secret_names_unverified/);
  assert.equal(calls, 3);
});

test('CLI failures and preflight errors never reflect values or transport details', () => {
  const env = fixture();
  for (const spawn of [
    () => ({ status: 1, stdout: env.OPENAI_API_KEY, stderr: env.CLIENT_TOKEN }),
    () => { throw new Error(env.OPENAI_API_KEY); },
  ]) {
    assert.throws(() => runWrangler(['secret', 'bulk'], env, '{}', spawn), error => {
      assert.equal(error.message, 'wrangler_command_failed'); return true;
    });
  }
  const messages = []; const output = { log: value => messages.push(value), error: value => messages.push(value) };
  assert.equal(main('--check', { ...env, CONTACTS_JSON: env.OPENAI_API_KEY }, output), 1);
  assert(!messages.join('').includes(env.OPENAI_API_KEY));
  assert.equal(main('--check', env, output), 0);
  assert(!messages.join('').includes(env.CLIENT_TOKEN));
});

test('child environment cannot inherit debug logging or Node injection', () => {
  const env = wranglerEnvironment({ ...fixture(), NODE_OPTIONS: '--require /untrusted.cjs',
    WRANGLER_WRITE_LOGS: 'true', WRANGLER_LOG_SANITIZE: 'false', WRANGLER_LOG: 'debug' });
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.WRANGLER_WRITE_LOGS, 'false');
  assert.equal(env.WRANGLER_LOG_SANITIZE, 'true');
  assert.equal(env.WRANGLER_LOG, 'log');
});

test('source keeps all activation gates false and Wrangler exactly pinned', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(config.name, WORKER_NAME);
  for (const name of ['ALLOW_PAID_AI', 'ALLOW_OUTBOUND_SEND', 'AUTO_REPLY_ENABLED']) assert.equal(config.vars[name], 'false');
  assert.equal(pkg.devDependencies.wrangler, '4.163.0');
});

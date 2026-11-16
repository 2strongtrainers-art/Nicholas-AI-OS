import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the production handlers with an in-memory Durable Object base and
// synthetic provider responses. No test can contact a model or send a message.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') return {
      url: 'data:text/javascript,' + encodeURIComponent(
        'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }'),
      shortCircuit: true
    };
    return nextResolve(specifier, context);
  }
});
const { default: worker, TextConversation } = await import('../src/index.mjs');

class Storage {
  values = new Map();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async deleteAll() { this.values.clear(); }
  async setAlarm(at) { this.alarm = at; }
}
function fixture(t, overrides = {}, provider) {
  const storage = new Storage();
  const env = {
    CLIENT_TOKEN: 'test-client-token-'.repeat(3),
    CONTROL_TOKEN: 'test-control-token-'.repeat(3),
    CONTACTS_JSON: JSON.stringify({ pilot_01: { enabled: true, consent: true, auto: true } }),
    OPENAI_API_KEY: 'synthetic-key-never-sent',
    ALLOW_PAID_AI: 'true', ALLOW_OUTBOUND_SEND: 'true', AUTO_REPLY_ENABLED: 'true',
    ...overrides
  };
  const session = new TextConversation({ storage }, env);
  env.CONVERSATIONS = { getByName(id) { assert.equal(id, 'pilot_01'); return session; } };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (...args) => {
    calls += 1;
    assert.equal(args[0], 'https://api.openai.com/v1/responses');
    assert.equal(JSON.parse(args[1].body).store, false);
    assert.equal(args[1].redirect, 'error');
    if (!provider) throw new Error('Unexpected provider request in a no-network test');
    return provider(...args);
  });
  async function post(path, body, token = env.CLIENT_TOKEN) {
    const response = await worker.fetch(new Request('https://texting.example' + path, {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }), env);
    return { status: response.status, body: await response.json() };
  }
  return { env, storage, session, post, calls: () => calls };
}
function replyResponse() {
  return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text',
    text: JSON.stringify({ action: 'reply', reply: 'Thanks for checking in.' }) }] }] });
}
function delayedProvider() {
  let start, finish;
  const started = new Promise(resolve => { start = resolve; });
  const response = new Promise(resolve => { finish = resolve; });
  return { started, finish: () => finish(replyResponse()), provider: () => { start(); return response; } };
}
const event = (message = 'How is your day?', event_id = 'synthetic-event-0001') => ({
  contact_id: 'pilot_01', event_id, message
});

test('unauthorized, unapproved, malformed and disabled requests never call a provider', async t => {
  const f = fixture(t, { ALLOW_PAID_AI: 'false' });
  assert.equal((await f.post('/reply', event(), 'incorrect-token')).status, 401);
  assert.equal((await f.post('/control', { contact_id: 'pilot_01', command: 'pause' })).status, 401);
  assert.equal((await f.post('/reply', { ...event(), contact_id: 'other_01' })).body.reason, 'contact_not_approved');
  assert.equal((await f.post('/reply', { ...event(), event_id: 'bad' })).status, 400);
  assert.equal((await f.post('/reply', event('x'.repeat(1201)))).status, 400);
  assert.equal((await f.post('/reply', event())).body.action, 'skip');
  assert.equal(f.calls(), 0);
});

test('STOP persists while paid AI is disabled and still blocks after it is enabled', async t => {
  const f = fixture(t, { ALLOW_PAID_AI: 'false' });
  assert.equal((await f.post('/reply', event('STOP'))).body.reason, 'opt_out');
  f.env.ALLOW_PAID_AI = 'true';
  assert.equal((await f.post('/reply', event('Hello again', 'synthetic-event-0002'))).body.action, 'skip');
  assert.equal((await f.storage.get('state')).optedOut, true);
  assert.equal(f.calls(), 0);
});

test('malformed contact configuration cannot approve inherited object property names', async t => {
  const f = fixture(t, { CONTACTS_JSON: 'invalid-json' });
  for (const contact_id of ['constructor', 'toString', '__proto__']) {
    const result = await f.post('/reply', { ...event(), contact_id });
    assert.equal(result.body.reason, 'contact_not_approved');
  }
  assert.equal(f.calls(), 0);
});

test('STOP persists while paused and cannot be cleared by resume', async t => {
  const f = fixture(t);
  await f.session.control('pause');
  assert.equal((await f.post('/reply', event('STOP'))).body.reason, 'opt_out');
  assert.equal((await f.session.control('resume')).reason, 'contact_opted_out');
  assert.equal(f.calls(), 0);
});

for (const command of ['pause', 'forget']) {
  test(command + ' cancels an in-flight reply without restoring erased or paused state', async t => {
    const delayed = delayedProvider();
    const f = fixture(t, {}, delayed.provider);
    const request = f.post('/reply', event());
    await delayed.started;
    await f.session.control(command);
    delayed.finish();
    assert.equal((await request).body.action, 'skip');
    const state = await f.storage.get('state');
    if (command === 'forget') assert.equal(state, undefined);
    else { assert.equal(state.paused, true); assert.equal(state.pending, null); }
    assert.equal(f.calls(), 1);
  });
}

test('retention alarm cannot be undone by an in-flight provider response', async t => {
  const delayed = delayedProvider();
  const f = fixture(t, {}, delayed.provider);
  const request = f.post('/reply', event());
  await delayed.started;
  await f.session.alarm();
  delayed.finish();
  assert.equal((await request).body.action, 'skip');
  assert.equal(await f.storage.get('state'), undefined);
});

test('STOP preempts an in-flight reply and clears pending-send authorization', async t => {
  const delayed = delayedProvider();
  const f = fixture(t, {}, delayed.provider);
  const request = f.post('/reply', event());
  await delayed.started;
  const stop = await f.post('/reply', event('STOP', 'synthetic-event-stop'));
  assert.equal(stop.body.reason, 'opt_out');
  delayed.finish();
  assert.equal((await request).body.action, 'skip');
  const state = await f.storage.get('state');
  assert.equal(state.optedOut, true);
  assert.equal(state.pending, null);
});

test('send gates return only a draft, and duplicate requests reserve one provider call', async t => {
  const f = fixture(t, { ALLOW_OUTBOUND_SEND: 'false' }, replyResponse);
  const results = await Promise.all([f.post('/reply', event()), f.post('/reply', event())]);
  assert.deepEqual(results.map(r => r.body.action), ['draft', 'skip']);
  assert.equal(f.calls(), 1);
  assert.equal((await f.storage.get('state')).pending, null);
});

test('only the matching local-send acknowledgment adds a memory turn', async t => {
  const f = fixture(t, {}, replyResponse);
  assert.equal((await f.post('/reply', event())).body.action, 'send');
  assert.equal((await f.post('/ack', event('', 'synthetic-event-other'))).body.action, 'skip');
  assert.equal((await f.storage.get('state')).turns.length, 0);
  assert.equal((await f.post('/ack', event())).body.action, 'acknowledged');
  assert.equal((await f.storage.get('state')).turns.length, 2);
  assert.equal((await f.post('/ack', event())).body.action, 'skip');
});

test('failed model requests still consume the bounded daily reservation', async t => {
  const f = fixture(t, {}, () => new Response('', { status: 503 }));
  for (let i = 0; i < 21; i++) {
    const result = await f.post('/reply', event('Synthetic ordinary message ' + i, 'synthetic-event-' + i));
    assert.equal(result.body.action, 'handoff');
    if (i === 20) assert.equal(result.body.reason, 'daily_limit');
  }
  assert.equal(f.calls(), 20);
});

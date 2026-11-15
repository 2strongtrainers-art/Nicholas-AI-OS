import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validContactId, validEventId, validInbound, contactsFromSecret,
  decideMode, classifyInbound, safeReply,
  MAX_AI_CALLS_PER_CONTACT_DAY, RETENTION_MS
} from '../src/policy.mjs';

test('contact ID validation', () => {
  assert.equal(validContactId('pilot_01'), true);
  for (const id of ['', '../private', '+14155551212', 'a']) assert.equal(validContactId(id), false);
});
test('event IDs are UUID compatible and mandatory', () => {
  assert.equal(validEventId('8e2fb1a0-2d17-4ba2-9809-19026b3f1255'), true);
  assert.equal(validEventId('short'), false);
  assert.equal(validEventId('../arbitrary-input'), false);
});
test('incoming body limits', () => {
  assert.equal(validInbound('Hello'), true);
  assert.equal(validInbound('  '), false);
  assert.equal(validInbound('x'.repeat(1201)), false);
  assert.equal(validInbound('Hi\u0000'), false);
});
test('only consented, enabled contacts appear on allowlist', () => {
  assert.deepEqual(Object.keys(contactsFromSecret('garbage')), []);
  assert.deepEqual(Object.keys(contactsFromSecret('{"pilot_01":{"enabled":true}}')), []);
  const result = contactsFromSecret('{"pilot_01":{"enabled":true,"consent":true,"auto":true},"other":{"enabled":false,"consent":true,"auto":true}}');
  assert.deepEqual(Object.keys(result), ['pilot_01']);
  assert.equal(result.pilot_01.auto, true);
});
test('paid and outbound kill switches fail closed', () => {
  const contact = { auto: true };
  const env = { OPENAI_API_KEY: 'example', ALLOW_PAID_AI: 'true', ALLOW_OUTBOUND_SEND: 'true', AUTO_REPLY_ENABLED: 'true' };
  assert.equal(decideMode({}, contact), 'off');
  assert.equal(decideMode({ ...env, ALLOW_PAID_AI: 'false' }, contact), 'off');
  assert.equal(decideMode({ ...env, ALLOW_OUTBOUND_SEND: 'false' }, contact), 'draft');
  assert.equal(decideMode({ ...env, AUTO_REPLY_ENABLED: 'false' }, contact), 'draft');
  assert.equal(decideMode(env, { auto: false }), 'draft');
  assert.equal(decideMode(env, contact), 'auto');
  assert.equal(decideMode(env, null), 'off');
});
test('opt-out and high-sensitivity topics escalate', () => {
  assert.equal(classifyInbound('STOP'), 'opt_out');
  for (const s of ['My bank needs a wire transfer', 'Here is my verification code', 'I need a doctor', 'My lawyer called', 'I love you', 'There is an emergency'])
    assert.equal(classifyInbound(s), 'sensitive');
  for (const s of ['Email me at test@example.com', 'My address is 125 Oak Street', 'Please call 415-555-1212', 'Today is my birthday'])
    assert.equal(classifyInbound(s), 'sensitive');
  assert.equal(classifyInbound('What time is lunch tomorrow?'), null);
});
test('outbound validation rejects links and risky claims', () => {
  assert.equal(safeReply('  Hello there!  '), 'Hello there!');
  assert.equal(safeReply('AI assistant: Hello'), 'Hello');
  assert.equal(safeReply('Try https://example.com'), null);
  assert.equal(safeReply('I booked the flight'), null);
  assert.equal(safeReply('Please call 415-555-1212'), null);
  assert.equal(safeReply('x'.repeat(321)), null);
});
test('bounded retention and daily AI calls', () => {
  assert.equal(RETENTION_MS, 48 * 60 * 60 * 1000);
  assert.equal(MAX_AI_CALLS_PER_CONTACT_DAY, 20);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_TRANSCRIPTION_BYTES, TRANSCRIPTION_TIMEOUT_MS, transcribeAudio } from '../src/transcription.ts';

const env = { ELEVENLABS_API_KEY: 'test-only-api-key', ALLOW_PAID_AI: 'true' };
const bytes = Buffer.from([82, 73, 70, 70, 0, 1, 2, 3]);
const input = { name: 'review.wav', mime_type: 'audio/wav', content_base64: bytes.toString('base64') };
const transcript = {
  language_code: 'eng', language_probability: 0.99, text: 'Example.',
  words: [{ text: 'Example.', type: 'word', start: 0.04, end: 0.63 }],
};

test('uploads exact audio bytes as multipart and preserves provider word timestamps', async () => {
  let calls = 0;
  const result = await transcribeAudio(env, { ...input, language_code: 'eng', diarize: true }, async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.elevenlabs.io/v1/speech-to-text');
    assert.equal(init.method, 'POST');
    assert.equal(new Headers(init.headers).get('xi-api-key'), env.ELEVENLABS_API_KEY);
    assert.equal(new Headers(init.headers).has('Content-Type'), false, 'fetch must supply the multipart boundary');
    assert.ok(init.signal instanceof AbortSignal);
    assert.ok(TRANSCRIPTION_TIMEOUT_MS > 0 && TRANSCRIPTION_TIMEOUT_MS <= 60_000);
    const form = init.body;
    assert.ok(form instanceof FormData);
    const file = form.get('file');
    assert.equal(file.name, 'review.wav');
    assert.equal(file.type, 'audio/wav');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    assert.equal(form.get('model_id'), 'scribe_v2');
    assert.equal(form.get('timestamps_granularity'), 'word');
    assert.equal(form.get('language_code'), 'eng');
    assert.equal(form.get('diarize'), 'true');
    assert.equal(form.get('tag_audio_events'), 'false');
    assert.equal(form.has('source_url'), false);
    assert.equal(form.has('cloud_storage_url'), false);
    return Response.json(transcript);
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { model_id: 'scribe_v2', ...transcript });
});

test('REST Scribe model selection is explicit and never rewrites the transcript', async () => {
  const result = await transcribeAudio(env, { ...input, model_id: 'scribe_v1' }, async (_url, init) => {
    assert.equal(init.body.get('model_id'), 'scribe_v1');
    assert.equal(init.body.get('diarize'), 'false');
    assert.equal(init.body.has('language_code'), false);
    return Response.json(transcript);
  });
  assert.equal(result.model_id, 'scribe_v1');
  assert.equal(result.text, transcript.text);
});

test('missing credentials and absent or invalid paid-AI permission prevent any provider request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json(transcript); };
  await assert.rejects(transcribeAudio({ ALLOW_PAID_AI: 'true' }, input, fetcher), /ELEVENLABS_API_KEY is not configured/);
  for (const ALLOW_PAID_AI of [undefined, '', 'false', ' false ', 'flase', 'yes', '1']) {
    await assert.rejects(transcribeAudio({ ...env, ALLOW_PAID_AI }, input, fetcher), /explicit ALLOW_PAID_AI=true/);
  }
  assert.equal(calls, 0);
});

test('invalid bytes, paths, unsupported types and legacy URL inputs fail before provider calls', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json(transcript); };
  for (const change of [
    { content_base64: '' }, { content_base64: '???=' }, { content_base64: 'Zg=' },
    { content_base64: 'Zh==' }, { content_base64: 'Zm=8' },
    { content_base64: 'data:audio/wav;base64,' + input.content_base64 },
    { name: '../review.wav' }, { name: '/tmp/review.wav' }, { name: 'review\r\n.wav' },
    { mime_type: 'text/plain' }, { model_id: 'eleven_scribe_v1' }, { language_code: 'english' },
    { input_file_path: '/tmp/review.wav' }, { source_url: 'https://example.invalid/review.wav' },
  ]) await assert.rejects(transcribeAudio(env, { ...input, ...change }, fetcher));
  assert.equal(calls, 0);
});

test('decoded size is bounded even when base64 length rounds into the allowed limit', async () => {
  let calls = 0;
  const content_base64 = Buffer.alloc(MAX_TRANSCRIPTION_BYTES + 1).toString('base64');
  await assert.rejects(transcribeAudio(env, { ...input, content_base64 }, async () => {
    calls++; return Response.json(transcript);
  }), /10 MiB/);
  assert.equal(calls, 0);
});

test('provider error bodies are not exposed and failed calls are never retried', async () => {
  let calls = 0;
  await assert.rejects(transcribeAudio(env, input, async () => {
    calls++; return new Response('private provider detail', { status: 429 });
  }), (error) => {
    assert.match(error.message, /HTTP 429/);
    assert.match(error.message, /no automatic retry/);
    assert.ok(!error.message.includes('private provider detail'));
    assert.ok(!error.message.includes(env.ELEVENLABS_API_KEY));
    return true;
  });
  assert.equal(calls, 1);
});

test('network failure and timeout report bounded failure without forwarding exception details', async () => {
  let calls = 0;
  await assert.rejects(transcribeAudio(env, input, async () => {
    calls++; throw new Error('private network detail');
  }), (error) => {
    assert.match(error.message, /request failed; no automatic retry/);
    assert.ok(!error.message.includes('private network detail'));
    return true;
  });
  await assert.rejects(transcribeAudio(env, input, async () => {
    calls++; throw new DOMException('test timeout', 'TimeoutError');
  }), /timed out after 60 seconds; no automatic retry/);
  assert.equal(calls, 2);
});

test('malformed provider responses cannot be reported as successful word alignment', async () => {
  for (const body of [
    { text: 'Example.' }, { text: 'Example.', words: [] },
    { text: 'Example.', words: [{ text: ' ', type: 'spacing', start: 0, end: 1 }] },
    { text: 'Example.', words: [{ text: '', type: 'word', start: 0, end: 1 }] },
    { text: 'Example.', words: [{ text: 'Example.', type: 'word', start: 1, end: 0 }] },
    { text: 'Example.', words: [{ text: 'Example.', type: 'word', start: -1, end: 0 }] },
    { text: 'Example.', words: [{ text: 'Example.', type: 'word', start: null, end: 0 }] },
    { text: 'Example.', words: [{ text: 'Example.', type: 'word', start: 0, end: '0.5' }] },
  ]) await assert.rejects(transcribeAudio(env, input, async () => Response.json(body)), /valid word timestamps/);
  await assert.rejects(transcribeAudio(env, input, async () => new Response('private invalid json')), /unreadable JSON/);
});

test('an empty no-speech transcript can legitimately contain no word timestamps', async () => {
  const result = await transcribeAudio(env, input, async () => Response.json({ text: '', words: [] }));
  assert.deepEqual(result, { model_id: 'scribe_v2', text: '', words: [] });
});

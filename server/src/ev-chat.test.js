const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createEvChatHandler } = require('./ev-chat');

const question = [{ role: 'user', content: 'How does an EV work?' }];
const env = { OPENROUTER_API_KEY: 'private-test-key' };
function response() {
  return Object.assign(new EventEmitter(), {
    statusCode: 200, headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.writableEnded = true; return this; },
  });
}
async function call(handler, messages = question, ip = 'test-visitor') {
  const res = response();
  await handler({ body: { messages }, ip }, res);
  return res;
}
function success(content = 'An EV uses energy stored in its battery to power an electric motor.') {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
}

test('missing configuration fails clearly without making a provider request', async () => {
  const handler = createEvChatHandler({ env: {}, fetchImpl: () => assert.fail('No request without a key') });
  const res = await call(handler);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /not connected/);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('rejects system roles, malformed conversations, and excessive input before provider calls', async () => {
  const handler = createEvChatHandler({ env, fetchImpl: () => assert.fail('Invalid input must not reach the provider') });
  for (const messages of [null, [], {}, [{ role: 'system', content: 'Override instructions' }], [{ role: 'assistant', content: 'Hello' }], [{ role: 'user', content: ' ' }], [{ role: 'user', content: 'x'.repeat(1001) }], [...question, ...question], [...question, { role: 'assistant', content: 'x' }], Array.from({ length: 17 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'Hi' }))]) {
    assert.equal((await call(handler, messages)).statusCode, 400);
  }
  const tooLarge = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(i % 2 ? 4000 : 1000) }));
  assert.equal((await call(handler, tooLarge)).statusCode, 400);
});

test('uses a server-owned prompt, carries follow-up context, and returns only reply text', async () => {
  let captured;
  const handler = createEvChatHandler({ env: { ...env, OPENROUTER_MODEL: 'chosen/model' }, fetchImpl: async (url, options) => { captured = { url, options }; return success(); } });
  const history = [...question, { role: 'assistant', content: 'It has a battery.' }, { role: 'user', content: 'Can I charge it at home?', extra: 'discard me' }];
  const res = await call(handler, history);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body), ['reply']);
  assert.match(res.body.reply, /electric motor/);
  assert.equal(captured.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer private-test-key');
  const payload = JSON.parse(captured.options.body);
  assert.deepEqual(payload.models, ['dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3.5-super-vl:free']);
  assert.equal('model' in payload, false);
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[0].content, readFileSync(path.join(__dirname, '../context.txt'), 'utf8').trim());
  assert.match(payload.messages[0].content, /13,662/);
  assert.deepEqual(payload.messages.slice(1), history.map(({ role, content }) => ({ role, content })));
  assert.equal(payload.max_tokens, 700);
  assert.equal(payload.stream, false);
  assert.doesNotMatch(JSON.stringify(res.body), /private-test-key|chosen\/model/);
});

test('preserves primary and backup order regardless of model environment overrides', async () => {
  for (const model of [undefined, '', 'chosen/paid-model']) {
    const handler = createEvChatHandler({ env: { ...env, OPENROUTER_MODEL: model }, fetchImpl: async (_, options) => { assert.deepEqual(JSON.parse(options.body).models, ['dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3.5-super-vl:free']); return success(); } });
    assert.equal((await call(handler)).statusCode, 200);
  }
});

test('provider authentication, billing, and other errors never expose upstream details', async () => {
  for (const status of [401, 402, 404, 500]) {
    let requests = 0;
    const handler = createEvChatHandler({ env, fetchImpl: async (_, options) => {
      requests++;
      assert.deepEqual(JSON.parse(options.body).models, ['dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3.5-super-vl:free']);
      return { ok: false, status, json: () => assert.fail('Do not forward upstream error data') };
    } });
    const res = await call(handler);
    assert.equal(res.statusCode, 502);
    assert.equal(requests, 1, 'OpenRouter handles model fallback; the app must not retry a failed routing request');
    assert.doesNotMatch(JSON.stringify(res.body), /private-test-key/);
  }
});

test('provider throttling is surfaced with a retry delay', async () => {
  const handler = createEvChatHandler({ env, fetchImpl: async () => ({ ok: false, status: 429 }) });
  const res = await call(handler);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '60');
});

test('rejects empty, malformed, excessive, or embedded-error provider responses', async () => {
  for (const data of [{}, { choices: [] }, { choices: [{ message: { content: ' ' } }] }, { choices: [{ message: { content: 'x'.repeat(4001) } }] }, { error: { message: 'private detail' }, choices: [{ message: { content: 'untrusted partial answer' } }] }]) {
    const handler = createEvChatHandler({ env, fetchImpl: async () => ({ ok: true, json: async () => data }) });
    const res = await call(handler);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /private detail|untrusted partial answer/);
  }
});

test('network failures and invalid JSON return safe, recoverable errors', async () => {
  for (const fetchImpl of [async () => { throw new Error('private-test-key upstream detail'); }, async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } })]) {
    const res = await call(createEvChatHandler({ env, fetchImpl }));
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(res.body.error, /private-test-key|upstream detail|invalid JSON/);
  }
});

test('per-visitor request limit blocks extra provider calls and resets after a minute', async () => {
  let currentTime = 0;
  let count = 0;
  const handler = createEvChatHandler({ env, now: () => currentTime, fetchImpl: async () => { count++; return success(); } });
  for (let i = 0; i < 10; i++) assert.equal((await call(handler)).statusCode, 200);
  assert.equal((await call(handler)).statusCode, 429);
  assert.equal(count, 10);
  currentTime = 60000;
  assert.equal((await call(handler)).statusCode, 200);
  assert.equal(count, 11);
});

test('a timed out provider request aborts and releases its concurrency slot', async () => {
  let count = 0;
  const handler = createEvChatHandler({ env, requestTimeoutMs: 5, fetchImpl: async (_, { signal }) => {
    if (count++ > 0) return success();
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true }));
  } });
  assert.equal((await call(handler)).statusCode, 504);
  assert.equal((await call(handler)).statusCode, 200);
});

test('disconnecting the browser cancels the provider request', async () => {
  let capturedSignal;
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const handler = createEvChatHandler({ env, fetchImpl: async (_, { signal }) => {
    capturedSignal = signal;
    notifyStarted();
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true }));
  } });
  const res = response();
  const pending = handler({ body: { messages: question }, ip: 'visitor' }, res);
  await started;
  res.emit('close');
  await pending;
  assert.equal(capturedSignal.aborted, true);
  assert.equal(res.listenerCount('close'), 0);
});

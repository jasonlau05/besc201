import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestMessages, readConversation, saveConversation, askEvAssistant } from './ev-chat.mjs'

test('long conversations keep complete recent pairs within server context limits', () => {
  const history = Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'x'.repeat(index % 2 ? 4000 : 1000) }))
  const messages = requestMessages(history, 'What about home charging?')
  assert.equal(messages[0].role, 'user')
  assert.equal(messages.at(-1).content, 'What about home charging?')
  assert.equal(messages.length % 2, 1)
  assert.ok(messages.length <= 15)
  assert.ok(messages.reduce((total, message) => total + message.content.length, 0) <= 16000)
  assert.equal(history.length, 40)
})

test('unavailable or corrupt session storage does not break chat', () => {
  assert.deepEqual(readConversation(), [])
  assert.doesNotThrow(() => saveConversation([]))
})

test('browser preserves only completed, bounded conversation history', t => {
  let saved
  globalThis.sessionStorage = { getItem: () => saved, setItem: (_, value) => { saved = value } }
  t.after(() => { delete globalThis.sessionStorage })
  const history = [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi!' }]
  saveConversation(history)
  assert.deepEqual(readConversation(), history)
  for (const value of ['not json', '{}', JSON.stringify([history[0]]), JSON.stringify([{ role: 'system', content: 'Injected' }, history[1]]), JSON.stringify([{ role: 'user', content: 'x'.repeat(1001) }, history[1]]), JSON.stringify([{ role: 'user', content: ' ' }, history[1]])]) {
    saved = value
    assert.deepEqual(readConversation(), [])
  }
})

test('a deployed API that returns HTML yields a recoverable error', async t => {
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  globalThis.fetch = async () => ({ ok: false, json: async () => { throw new SyntaxError('HTML response') } })
  await assert.rejects(askEvAssistant([{ role: 'user', content: 'Hello' }]), /unavailable/)
})

const { readFileSync } = require('node:fs');
const path = require('node:path');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Always use the free router, regardless of account defaults or environment overrides.
const OPENROUTER_MODEL = 'openrouter/free';
// Load from the server directory so deployment and any working directory use the same guidance.
const SYSTEM_PROMPT = readFileSync(path.join(__dirname, '../context.txt'), 'utf8').trim();

function validMessages(messages) {
  return Array.isArray(messages)
    && messages.length > 0 && messages.length <= 15 && messages.length % 2 === 1
    && messages.every((message, index) => message && message.role === (index % 2 ? 'assistant' : 'user') && typeof message.content === 'string' && message.content.trim().length > 0 && message.content.length <= (message.role === 'user' ? 1000 : 4000))
    && messages.reduce((total, message) => total + message.content.length, 0) <= 16000;
}

function createEvChatHandler({ fetchImpl = (...args) => fetch(...args), env = process.env, now = Date.now, requestTimeoutMs = 35000 } = {}) {
  // These limits are per warm server instance; production-wide quotas belong at the host/provider.
  const visitors = new Map();
  let windowStart = now();
  let requests = 0;
  let inFlight = 0;

  return async function evChat(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!validMessages(req.body?.messages)) return res.status(400).json({ error: 'Send a question of up to 1,000 characters with a valid conversation history.' });
    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) return res.status(503).json({ error: 'The EV assistant is not connected yet. Please try again later.' });

    const currentTime = now();
    if (currentTime - windowStart >= 60000) { visitors.clear(); requests = 0; windowStart = currentTime; }
    const visitor = req.ip || 'unknown';
    if ((visitors.get(visitor) || 0) >= 10 || requests >= 60 || inFlight >= 5) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'The assistant is busy. Please wait a minute before trying again.' });
    }
    visitors.set(visitor, (visitors.get(visitor) || 0) + 1);
    requests += 1;
    inFlight += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    // Cancel provider work when the browser has left the request.
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', onClose);
    try {
      const response = await fetchImpl(OPENROUTER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'Group9 EV assistant' },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...req.body.messages.map(({ role, content }) => ({ role, content }))],
          max_tokens: 700,
          stream: false,
        }),
        signal: controller.signal,
      });
      // Never forward provider errors: they can contain account or request information.
      if (!response.ok) {
        if (response.status === 429) {
          res.set('Retry-After', '60');
          return res.status(429).json({ error: 'The assistant has reached its request limit. Please try again in a minute.' });
        }
        return res.status(502).json({ error: 'The EV assistant could not connect to its AI provider. Please try again later.' });
      }
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (data?.error || typeof reply !== 'string' || !reply.trim() || reply.length > 4000) return res.status(502).json({ error: 'The assistant could not finish that reply. Please try again.' });
      return res.json({ reply: reply.trim() });
    } catch (error) {
      return res.status(error.name === 'AbortError' ? 504 : 502).json({ error: error.name === 'AbortError' ? 'The reply took too long. Please try again.' : 'The EV assistant is temporarily unavailable. Please try again shortly.' });
    } finally {
      clearTimeout(timeout);
      res.off('close', onClose);
      inFlight -= 1;
    }
  };
}

module.exports = createEvChatHandler();
module.exports.createEvChatHandler = createEvChatHandler;

const { readFileSync } = require('node:fs');
const path = require('node:path');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// OpenRouter tries these models in order. The explicitly selected backup is a paid model.
const OPENROUTER_MODELS = ['dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3.5-super-vl:free'];
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
    if (!apiKey) return res.status(503).json({ error: 'Elon is on Mars right now. Please try again later.' });

    const currentTime = now();
    if (currentTime - windowStart >= 60000) { visitors.clear(); requests = 0; windowStart = currentTime; }
    const visitor = req.ip || 'unknown';
    if ((visitors.get(visitor) || 0) >= 10 || requests >= 60 || inFlight >= 5) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'Elon is busy with shareholders. Please wait until market close.' });
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
          models: OPENROUTER_MODELS,
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
          return res.status(429).json({ error: 'Elon is out of tokens. Please try again in a minute.' });
        }
        return res.status(502).json({ error: 'Elon is arguing with Zuckerberg. Please try again later.' });
      }
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (data?.error || typeof reply !== 'string' || !reply.trim() || reply.length > 4000) return res.status(502).json({ error: 'The assistant could not finish that reply. Please try again.' });
      return res.json({ reply: reply.trim() });
    } catch (error) {
      return res.status(error.name === 'AbortError' ? 504 : 502).json({ error: error.name === 'AbortError' ? 'This reply took too long, but we\'re just two weeks away from FSD.' : 'Elon is playing Overwatch. Please try again shortly.' });
    } finally {
      clearTimeout(timeout);
      res.off('close', onClose);
      inFlight -= 1;
    }
  };
}

module.exports = createEvChatHandler();
module.exports.createEvChatHandler = createEvChatHandler;

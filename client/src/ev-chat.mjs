const STORAGE_KEY = 'group9-ev-chat-v1'
export const MAX_QUESTION_LENGTH = 1000

export function readConversation() {
  try {
    const messages = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (!Array.isArray(messages) || messages.length > 40 || messages.length % 2 !== 0) return []
    if (!messages.every((message, index) => message?.role === (index % 2 ? 'assistant' : 'user') && typeof message.content === 'string' && message.content.trim().length > 0 && message.content.length <= (index % 2 ? 4000 : MAX_QUESTION_LENGTH))) return []
    return messages.map(({ role, content }) => ({ role, content }))
  } catch {
    return []
  }
}

export function saveConversation(messages) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))) } catch { /* Chat still works when browser storage is unavailable. */ }
}

export function requestMessages(conversation, question) {
  const messages = [...conversation.slice(-14), { role: 'user', content: question }]
  while (messages.length > 1 && messages.reduce((total, message) => total + message.content.length, 0) > 16000) messages.splice(0, 2)
  return messages
}

export async function askEvAssistant(messages, signal) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'The EV assistant is unavailable right now. Please try again shortly.')
  if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('The assistant returned an empty reply. Please try again.')
  return data.reply
}

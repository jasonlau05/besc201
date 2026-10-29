import { useEffect, useRef, useState } from 'react'
import { askEvAssistant, MAX_QUESTION_LENGTH, readConversation, requestMessages, saveConversation } from './ev-chat.mjs'
import './EvChat.css'

const suggestions = ['How does an EV work?', 'Are EVs better for the environment?', 'Why are Cybertrucks ugly?']

function ChatIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M7 3.5h10A3.5 3.5 0 0 1 20.5 7v8a3.5 3.5 0 0 1-3.5 3.5H9l-5.5 2V7A3.5 3.5 0 0 1 7 3.5Z" /><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" /></svg>
}

export default function EvChat({ open, onOpenChange }) {
  const [messages, setMessages] = useState(readConversation)
  const [draft, setDraft] = useState('')
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const logRef = useRef(null)
  const launcherRef = useRef(null)
  const requestRef = useRef(null)

  useEffect(() => { saveConversation(messages) }, [messages])
  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    if (open) {
      inputRef.current?.focus({ preventScroll: true })
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [open])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, pendingQuestion, loading, error])
  useEffect(() => {
    if (!open) return
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onOpenChange(false)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  function closeChat() {
    onOpenChange(false)
    launcherRef.current?.focus()
  }

  async function sendMessage(question) {
    const content = question.trim()
    if (!content || content.length > MAX_QUESTION_LENGTH || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setPendingQuestion(content)
    setLoading(true)
    setError('')
    setDraft('')
    const timeout = setTimeout(() => controller.abort(), 45000)
    try {
      const reply = await askEvAssistant(requestMessages(messages, content), controller.signal)
      setMessages(previous => [...previous, { role: 'user', content }, { role: 'assistant', content: reply }].slice(-40))
      setPendingQuestion('')
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'Elon took too long, but we\'re just two weeks away from FSD.' : failure instanceof TypeError ? 'You are not connected to the internet. Check your Starlink.' : failure.message)
    } finally {
      clearTimeout(timeout)
      requestRef.current = null
      setLoading(false)
      inputRef.current?.focus({ preventScroll: true })
    }
  }

  function resetChat() {
    setMessages([])
    setPendingQuestion('')
    setError('')
    setDraft('')
    inputRef.current?.focus()
  }

  return <div className="ev-chat">
    {open && <section className="ev-chat-panel" id="ev-chat-panel" role="dialog" aria-modal="false" aria-labelledby="ev-chat-title" aria-describedby="ev-chat-disclosure">
      <header className="ev-chat-header">
        <span className="ev-chat-avatar"><ChatIcon /></span>
        <div className="ev-chat-heading"><h2 id="ev-chat-title">Elon</h2></div>
        <div className="ev-chat-actions">
          <button className="ev-chat-icon-button" onClick={resetChat} disabled={loading || (!messages.length && !pendingQuestion)} aria-label="Start a new conversation" title="New conversation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></svg></button>
          <button className="ev-chat-icon-button" onClick={closeChat} aria-label="Minimize chat" title="Minimize chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>
      </header>

      <div className="ev-chat-log" ref={logRef} role="log" aria-label="Conversation with Elon" aria-live="polite" aria-relevant="additions text">
        <div className="ev-chat-message ev-chat-assistant"><span className="ev-chat-sender">Elon</span><p>Welcome! Ask me about charging, batteries, costs, or environmental impact. I love Teslas, rockets, AI, and creating shareholder value.</p></div>
        {!messages.length && !pendingQuestion && <div className="ev-chat-suggestions" aria-label="Suggested questions">{suggestions.map(question => <button key={question} onClick={() => sendMessage(question)}>{question}<span aria-hidden="true">↗</span></button>)}</div>}
        {messages.map((message, index) => <div className={`ev-chat-message ev-chat-${message.role}`} key={index}><span className="ev-chat-sender">{message.role === 'user' ? 'You' : 'EV assistant'}</span><p>{message.content}</p></div>)}
        {pendingQuestion && <div className="ev-chat-message ev-chat-user"><span className="ev-chat-sender">You</span><p>{pendingQuestion}</p></div>}
        {loading && <div className="ev-chat-thinking" role="status"><span aria-hidden="true"><i /><i /><i /></span>Thinking…</div>}
        {error && <div className="ev-chat-error" role="alert"><p>{error}</p><button onClick={() => sendMessage(pendingQuestion)}>Try again <span aria-hidden="true">↻</span></button></div>}
      </div>

      <form className="ev-chat-composer" onSubmit={event => { event.preventDefault(); sendMessage(draft) }}>
        <label className="ev-chat-sr-only" htmlFor="ev-chat-input">Your question about electric vehicles</label>
        <div className="ev-chat-input-row"><input ref={inputRef} id="ev-chat-input" value={draft} onChange={event => setDraft(event.target.value)} maxLength={MAX_QUESTION_LENGTH} placeholder="Ask about electric vehicles…" autoComplete="off" aria-describedby="ev-chat-disclosure" /><button type="submit" className="ev-chat-send" disabled={loading || !draft.trim()} aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 19 0-14m-6 6 6-6 6 6" /></svg></button></div>
        <p id="ev-chat-disclosure">AI can make mistakes. Powered by OpenRouter.</p>
      </form>
    </section>}
    <button className={`ev-chat-launcher${open ? ' is-open' : ''}`} ref={launcherRef} onClick={() => open ? closeChat() : onOpenChange(true)} aria-label={open ? 'Minimize EV assistant' : 'Open EV assistant'} aria-expanded={open} aria-controls="ev-chat-panel" title={open ? 'Minimize EV assistant' : 'Ask about EVs'}>{open ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg> : <ChatIcon />}</button>
  </div>
}

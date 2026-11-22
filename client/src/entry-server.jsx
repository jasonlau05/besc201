import { StrictMode } from 'react'
import { prerenderToNodeStream } from 'react-dom/static'
import App from './App'

// Wait for lazy components too, so the saved HTML has complete Suspense boundaries.
export async function render(path) {
  const errors = []
  const { prelude } = await prerenderToNodeStream(
    <StrictMode><App initialPath={path} /></StrictMode>,
    { onError: error => errors.push(error), signal: AbortSignal.timeout(30000) },
  )
  if (errors.length) throw new AggregateError(errors, `Unable to prerender ${path}`)
  let html = ''
  prelude.setEncoding('utf8')
  for await (const chunk of prelude) html += chunk
  return html
}

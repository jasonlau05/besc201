import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './palette.css'
import './index.css'
import App from './App.jsx'

const root = document.getElementById('root')
const app = (
  <StrictMode>
    <App initialPath={window.location.pathname} />
  </StrictMode>
)
if (root.dataset.prerendered === 'true') hydrateRoot(root, app)
else createRoot(root).render(app)

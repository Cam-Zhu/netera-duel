import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/era-themes.css'

const container = document.getElementById('root')
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// dist/index.html ships with the home screen already rendered into #root
// (scripts/prerender.mjs). On "/" that markup is exactly what App is about to
// render, so hydrate it — attaching handlers to the existing DOM instead of
// rebuilding it. Anywhere else it's the wrong screen: the edge function
// strips it for /d/* in production, but a local `vite preview` or an
// installed PWA's cached shell can still hand us the home markup on a duel
// URL, so clear it before mounting rather than flashing "Set a word" at a
// guesser. In `vite dev` #root is empty and this is a plain mount.
if (window.location.pathname === '/' && container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}

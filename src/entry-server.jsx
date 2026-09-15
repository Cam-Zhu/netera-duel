import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import SetWord from './screens/SetWord'

// Build-time prerender of the home screen, run by scripts/prerender.mjs and
// baked into dist/index.html so crawlers that don't execute JS (Google's
// first pass, Bing, most AI crawlers) see real content instead of an empty
// <div id="root">.
//
// This must produce exactly the tree App.jsx mounts for the home route with
// solo=false — the client hydrates on top of it (see main.jsx), and a
// mismatch makes React throw the markup away and re-render from scratch. App
// itself can't be rendered here: it reads window.location at mount, and
// there's no window in the build. The callbacks are inert placeholders; the
// real ones are wired up on hydration.
export function render() {
  return renderToString(
    <StrictMode>
      <SetWord onCreated={() => {}} onPlaySolo={() => {}} />
    </StrictMode>
  )
}

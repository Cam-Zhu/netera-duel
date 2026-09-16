import { useEffect, useState } from 'react'
import SetWord from './screens/SetWord'
import Guess from './screens/Guess'
import ShareLink from './screens/ShareLink'
import SoloPlay from './screens/SoloPlay'
import { isOwnDuel } from './lib/localIdentity'
import { track } from './lib/plausible'

// No router dependency — the app only ever has three shapes of URL, so a
// tiny pathname parser plus the History API covers it. /solo is a real URL
// (not just a home-screen toggle) so off-site posts can link straight to it
// — a "guess this word yourself" CTA — without a click through the home
// screen.
function parseRoute(pathname) {
  const duel = pathname.match(/^\/d\/([^/]+)\/?$/)
  if (duel) return { name: 'duel', slug: duel[1] }
  if (/^\/solo\/?$/.test(pathname)) return { name: 'solo' }
  return { name: 'home' }
}

// Whether this page load landed straight on /solo (a shared link) rather
// than getting there via the home screen's button. Read once, before any
// navigation, so the analytics event can tell the two apart.
const landedOnSolo = parseRoute(window.location.pathname).name === 'solo'

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// Must match the <title> in index.html — that's what a crawler sees before
// JS runs, and what the tab shows on first paint, so the two shouldn't differ.
const HOME_TITLE = 'NetEra Duel — word duels from 25 years of internet slang'
const SOLO_TITLE = 'Solo play · NetEra Duel'

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const route = parseRoute(pathname)

  // Only the home and solo routes own the tab title. On /d/<slug> the edge
  // function (netlify/edge-functions/og.js) has already written a
  // personalised one — "Cam's challenged you to a word duel" — and
  // overwriting it from here would throw that away.
  useEffect(() => {
    if (route.name === 'home') document.title = HOME_TITLE
    if (route.name === 'solo') document.title = SOLO_TITLE
  }, [route.name])

  // The home button tracks its own click below; this covers arriving by URL.
  useEffect(() => {
    if (landedOnSolo) track('Solo Mode Opened', { method: 'link' })
  }, [])

  if (route.name === 'solo') {
    return <SoloPlay onExit={() => navigate('/')} />
  }

  if (route.name === 'home') {
    return (
      <SetWord
        onCreated={(slug) => navigate(`/d/${slug}`)}
        onPlaySolo={() => {
          track('Solo Mode Opened', { method: 'home' })
          navigate('/solo')
        }}
      />
    )
  }

  // key={slug} so switching between two duel links (e.g. via browser history)
  // resets DuelRoute's local turn-back state instead of carrying it over.
  return <DuelRoute key={route.slug} slug={route.slug} />
}

function DuelRoute({ slug }) {
  // Set once the guesser finishes their own duel — swaps the screen from
  // "play" into "pick another word", per claude.md's core loop step 4.
  const [turnBack, setTurnBack] = useState(null)

  if (isOwnDuel(slug)) {
    return <ShareLink slug={slug} onHome={() => navigate('/')} />
  }

  if (turnBack) {
    return (
      <SetWord
        threadId={turnBack.threadId}
        parentDuelId={turnBack.parentDuelId}
        turnBack
        onCreated={(newSlug) => navigate(`/d/${newSlug}`)}
      />
    )
  }

  return (
    <Guess
      slug={slug}
      onFinished={(_slug, _status, threadId, parentDuelId) => setTurnBack({ threadId, parentDuelId })}
    />
  )
}

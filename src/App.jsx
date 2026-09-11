import { useEffect, useState } from 'react'
import SetWord from './screens/SetWord'
import Guess from './screens/Guess'
import ShareLink from './screens/ShareLink'
import { isOwnDuel } from './lib/localIdentity'

// No router dependency — the app only ever has two shapes of URL, so a tiny
// pathname parser plus the History API covers it.
function parseRoute(pathname) {
  const match = pathname.match(/^\/d\/([^/]+)\/?$/)
  return match ? { name: 'duel', slug: match[1] } : { name: 'home' }
}

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const route = parseRoute(pathname)

  if (route.name === 'home') {
    return <SetWord onCreated={(slug) => navigate(`/d/${slug}`)} />
  }

  // key={slug} so switching between two duel links (e.g. via browser history)
  // resets DuelRoute's local turn-back state instead of carrying it over.
  return <DuelRoute key={route.slug} slug={route.slug} />
}

function DuelRoute({ slug }) {
  // Set once the guesser finishes their own duel — swaps the screen from
  // "play" into "set your word back", per claude.md's core loop step 4.
  const [turnBack, setTurnBack] = useState(null)

  if (isOwnDuel(slug)) {
    return <ShareLink slug={slug} />
  }

  if (turnBack) {
    return (
      <SetWord
        threadId={turnBack.threadId}
        turnBack
        onCreated={(newSlug) => navigate(`/d/${newSlug}`)}
      />
    )
  }

  return (
    <Guess
      slug={slug}
      onFinished={(_slug, _status, threadId) => setTurnBack({ threadId })}
    />
  )
}

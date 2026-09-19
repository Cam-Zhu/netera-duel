import { useEffect, useState } from 'react'
import ShareCard from '../components/ShareCard'
import ShareResult from '../components/ShareResult'
import EraSkinProvider from '../components/EraSkinProvider'
import HeadToHead from '../components/HeadToHead'
import { fetchDuelForSetter, fetchThread } from '../lib/duelsApi'
import { getSetterToken } from '../lib/localIdentity'
import { getEraByBand } from '../lib/wordbank'

// The setter's own view of a duel they created — reachable only because their
// browser remembers the setter_token locally, never from the shared link.
export default function ShareLink({ slug, onHome }) {
  const [duel, setDuel] = useState(null)
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const setterToken = getSetterToken(slug)
    if (!setterToken) return

    fetchDuelForSetter(setterToken).then((d) => {
      setDuel(d)
      setLoading(false)
      if (d) fetchThread(d.thread_id).then(setThread)
    })
  }, [slug])

  // The "not found" branch is the one place someone can get properly stranded —
  // their own duel link, but no setter_token in this browser and so nothing to
  // show and no link to leave by. It gets the same way out as the duel itself.
  if (loading) return <p>Loading…</p>
  if (!duel) {
    return (
      <>
        <p>Couldn't find that duel.</p>
        <BackHome onHome={onHome} />
      </>
    )
  }

  const era = getEraByBand(duel.era_band)

  return (
    <EraSkinProvider eraId={era?.id}>
      <h1>Your duel</h1>
      <p>
        You set <strong>{duel.secret_word.toUpperCase()}</strong> from {era?.name}.
      </p>
      {duel.hint && (
        <p>
          Hint: <strong>{duel.hint}</strong>
        </p>
      )}
      {duel.setter_name && (
        <p>
          From: <strong>{duel.setter_name}</strong>
        </p>
      )}

      {duel.status === 'pending' && (
        <>
          <p>Waiting for your friend to play. Send them this link:</p>
          <ShareCard slug={slug} />
        </>
      )}

      {duel.status !== 'pending' && (
        <p>
          {duel.status === 'won' && `They solved it in ${duel.guess_count} guesses!`}
          {duel.status === 'lost' && `They didn't crack it within 6 guesses.`}
          {duel.status === 'expired' && `This one went unanswered.`}
        </p>
      )}

      <HeadToHead thread={thread} slug={slug} role="setter" />

      {(duel.status === 'won' || duel.status === 'lost') && (
        <ShareResult
          role="setter"
          status={duel.status}
          guessCount={duel.guess_count}
          eraName={duel.hide_era_band ? null : era?.name}
          slug={slug}
        />
      )}

      <BackHome onHome={onHome} />
    </EraSkinProvider>
  )
}

// Same label, arrow and class as SoloPlay's exit, so leaving a screen looks the
// same wherever you do it.
function BackHome({ onHome }) {
  if (!onHome) return null
  return (
    <button type="button" className="button-secondary" onClick={onHome}>
      ← Back home
    </button>
  )
}

import { useEffect, useState } from 'react'
import ShareCard from '../components/ShareCard'
import EraSkinProvider from '../components/EraSkinProvider'
import { fetchDuelForSetter, fetchThread } from '../lib/duelsApi'
import { getSetterToken } from '../lib/localIdentity'
import { getEraByBand } from '../lib/wordbank'

// The setter's own view of a duel they created — reachable only because their
// browser remembers the setter_token locally, never from the shared link.
export default function ShareLink({ slug }) {
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

  if (loading) return <p>Loading…</p>
  if (!duel) return <p>Couldn't find that duel.</p>

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

      {thread && thread.length > 1 && (
        <div>
          <h2>Head to head</h2>
          <ul>
            {thread.map((t) => (
              <li key={t.slug}>
                {t.slug === slug ? 'This duel' : 'Turn-back'} — {t.status} in {t.guess_count} guesses
              </li>
            ))}
          </ul>
        </div>
      )}
    </EraSkinProvider>
  )
}

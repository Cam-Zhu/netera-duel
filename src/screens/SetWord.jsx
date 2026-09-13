import { useState } from 'react'
import EraPicker from '../components/EraPicker'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import { getEraById, getWordsForEra, getRandomEra, getRandomWord } from '../lib/wordbank'
import { createDuel } from '../lib/duelsApi'
import { track } from '../lib/plausible'

export default function SetWord({ onCreated, threadId, turnBack, onPlaySolo }) {
  const [eraId, setEraId] = useState(null)
  const [word, setWord] = useState(null)
  const [hint, setHint] = useState('')
  const [hideEraBand, setHideEraBand] = useState(false)
  const [setterName, setSetterName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const era = eraId ? getEraById(eraId) : null
  const words = era ? getWordsForEra(era.id) : []

  function pickRandomEra() {
    const random = getRandomEra()
    setEraId(random.id)
    setWord(getRandomWord(random.id))
    track('Era Selected', { era: random.name, method: 'random' })
  }

  function selectEra(id) {
    setEraId(id)
    setWord(null)
    track('Era Selected', { era: getEraById(id).name, method: 'browse' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!era || !word) return
    setSubmitting(true)
    setError(null)
    try {
      const { slug } = await createDuel({
        eraBand: era.order,
        secretWord: word.word,
        hint,
        hideEraBand,
        setterName,
        threadId,
      })
      onCreated(slug)
    } catch (err) {
      if (err.message === 'DUEL_LIMIT_REACHED') {
        setError("You've hit the 20 free duels for this device — more slots are coming soon.")
      } else {
        setError('Something went wrong creating your duel. Try again.')
        console.error(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EraSkinProvider eraId={era?.id}>
      <HowToPlay />
      <form onSubmit={handleSubmit}>
        <h1>{turnBack ? 'Set your word back' : 'Set a word'}</h1>

      {!era && (
        <>
          <EraPicker selectedEraId={eraId} onSelect={selectEra} />
          <button type="button" className="button-secondary" onClick={pickRandomEra}>
            🎲 Random era
          </button>
          {onPlaySolo && !turnBack && (
            <button type="button" className="button-secondary" onClick={onPlaySolo}>
              I'm just playing alone
            </button>
          )}
        </>
      )}

      {era && !word && (
        <>
          <h2>{era.name}</h2>
          <div className="word-list">
            {words.map((w) => (
              <button
                type="button"
                key={w.word}
                className="word-list__option"
                onClick={() => setWord(w)}
              >
                <strong>{w.word}</strong>
                <span>{w.meaning}</span>
              </button>
            ))}
          </div>
          <button type="button" className="button-secondary" onClick={() => setWord(getRandomWord(era.id))}>
            🎲 Random word from this era
          </button>
          <button type="button" className="button-secondary" onClick={() => setEraId(null)}>
            ← Change era
          </button>
        </>
      )}

      {era && word && (
        <>
          <p>
            You picked <strong>{word.word}</strong> from {era.name}.
          </p>

          <label>
            Hint (optional)
            <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={80} />
          </label>

          <label>
            Your name (optional)
            <input value={setterName} onChange={(e) => setSetterName(e.target.value)} maxLength={40} />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={hideEraBand}
              onChange={(e) => setHideEraBand(e.target.checked)}
            />
            Hide the era from your friend (harder mode)
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Get shareable link'}
          </button>
          <button type="button" className="button-secondary" onClick={() => setWord(null)}>
            ← Pick a different word
          </button>
        </>
      )}
      </form>
    </EraSkinProvider>
  )
}

import { useEffect, useState } from 'react'
import HintBanner from '../components/HintBanner'
import GuessGrid from '../components/GuessGrid'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import { fetchDuelForGuesser, submitGuess } from '../lib/duelsApi'
import { getEraByBand } from '../lib/wordbank'
import { track } from '../lib/plausible'

export default function Guess({ slug, onFinished }) {
  const [duel, setDuel] = useState(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDuelForGuesser(slug).then(setDuel)
  }, [slug])

  if (!duel) return <p>Loading…</p>

  const pastGuesses = duel.guesses.map((g) => ({ guess: g.guess, feedback: g.feedback }))
  const era = duel.hide_era_band ? null : getEraByBand(duel.era_band)
  const finished = duel.status !== 'pending'

  async function handleSubmit(e) {
    e.preventDefault()
    if (input.length !== duel.word_length) {
      setError(`Word is ${duel.word_length} letters long.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitGuess(slug, input)
      setDuel((prev) => ({
        ...prev,
        guesses: [...prev.guesses, { guess: input.toLowerCase(), feedback: result.feedback }],
        status: result.status,
        guess_count: result.guess_count,
      }))
      setInput('')
    } catch (err) {
      setError('Could not submit that guess — try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EraSkinProvider eraId={era?.id}>
      <HowToPlay />
      <h1>Word duel</h1>
      <HintBanner eraName={era?.name} eraRange={era?.range} hint={duel.hint} />

      <GuessGrid
        wordLength={duel.word_length}
        pastGuesses={pastGuesses}
        currentInput={finished ? '' : input}
      />

      {!finished && (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            maxLength={duel.word_length}
            onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
            autoFocus
            autoCapitalize="characters"
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="button-primary" disabled={submitting}>
            Guess
          </button>
        </form>
      )}

      {finished && (
        <>
          <p>
            {duel.status === 'won' && `Solved it in ${duel.guess_count}!`}
            {duel.status === 'lost' && `Out of guesses — the word was hidden, better luck next duel.`}
          </p>
          <button
            className="button-primary"
            onClick={() => {
              track('Turn-Back Started')
              onFinished(slug, duel.status, duel.thread_id)
            }}
          >
            Set your word back
          </button>
        </>
      )}
    </EraSkinProvider>
  )
}

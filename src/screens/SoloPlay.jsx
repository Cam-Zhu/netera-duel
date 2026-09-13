import { useState } from 'react'
import EraPicker from '../components/EraPicker'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import HintBanner from '../components/HintBanner'
import GuessGrid from '../components/GuessGrid'
import { getEraById, getRandomWord, getRandomEra } from '../lib/wordbank'
import { computeFeedback } from '../lib/gridLogic'
import { track } from '../lib/plausible'

const MAX_GUESSES = 6

// No duel row, no slug, no server round-trip — a solo round has no opponent
// to keep the word secret from, so it's just era + word bank + client-side
// feedback (computeFeedback in gridLogic.js), same rules as a duel.
export default function SoloPlay({ onExit }) {
  const [eraId, setEraId] = useState(null)
  const [word, setWord] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('pending')

  const era = eraId ? getEraById(eraId) : null
  const finished = status !== 'pending'

  function startEra(id, method) {
    setEraId(id)
    setWord(getRandomWord(id))
    setGuesses([])
    setInput('')
    setError(null)
    setStatus('pending')
    track('Solo Game Started', { era: getEraById(id).name, method })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (input.length !== word.word.length) {
      setError(`Word is ${word.word.length} characters long.`)
      return
    }
    setError(null)

    const feedback = computeFeedback(word.word, input)
    const nextGuesses = [...guesses, { guess: input.toLowerCase(), feedback }]
    setGuesses(nextGuesses)
    setInput('')

    const won = input.toLowerCase() === word.word.toLowerCase()
    const nextStatus = won ? 'won' : nextGuesses.length >= MAX_GUESSES ? 'lost' : 'pending'
    setStatus(nextStatus)
    if (nextStatus !== 'pending') {
      track('Solo Game Finished', { result: nextStatus, guess_count: nextGuesses.length, era: era.name })
    }
  }

  return (
    <EraSkinProvider eraId={era?.id}>
      <HowToPlay />
      <h1>Solo play</h1>

      {!era && (
        <>
          <p>Pick an era to guess a word from.</p>
          <EraPicker selectedEraId={eraId} onSelect={(id) => startEra(id, 'browse')} />
          <button type="button" className="button-secondary" onClick={() => startEra(getRandomEra().id, 'random')}>
            🎲 Random era
          </button>
          <button type="button" className="button-secondary" onClick={onExit}>
            ← Back home
          </button>
        </>
      )}

      {era && word && (
        <>
          <HintBanner eraName={era.name} eraRange={era.range} hint={word.meaning} />

          <GuessGrid
            wordLength={word.word.length}
            pastGuesses={guesses}
            currentInput={finished ? '' : input}
          />

          {!finished && (
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={input}
                maxLength={word.word.length}
                onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                autoFocus
                autoCapitalize="characters"
              />
              {error && <p className="error-text">{error}</p>}
              <button type="submit" className="button-primary">
                Guess
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  track('Solo Game Given Up', { era: era.name, guess_count: guesses.length })
                  onExit()
                }}
              >
                I give up
              </button>
            </form>
          )}

          {finished && (
            <>
              <p>
                {status === 'won' && `Solved it in ${guesses.length}!`}
                {status === 'lost' && `Out of guesses — the word was "${word.word}".`}
              </p>
              <button type="button" className="button-primary" onClick={() => startEra(era.id, 'replay')}>
                Play again
              </button>
              <button type="button" className="button-secondary" onClick={() => setEraId(null)}>
                ← Change era
              </button>
              <button type="button" className="button-secondary" onClick={onExit}>
                ← Back home
              </button>
            </>
          )}
        </>
      )}
    </EraSkinProvider>
  )
}

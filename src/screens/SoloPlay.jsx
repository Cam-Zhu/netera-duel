import { useState } from 'react'
import EraPicker from '../components/EraPicker'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import HintBanner from '../components/HintBanner'
import GuessGrid from '../components/GuessGrid'
import Keyboard from '../components/Keyboard'
import { getEraById, getRandomWord, getRandomEra } from '../lib/wordbank'
import { computeFeedback } from '../lib/gridLogic'
import { deriveKeyStates } from '../lib/keyboardLogic'
import { useGuessInput } from '../lib/useGuessInput'
import { track } from '../lib/plausible'

const MAX_GUESSES = 6

// No duel row, no slug, no server round-trip — a solo round has no opponent
// to keep the word secret from, so it's just era + word bank + client-side
// feedback (computeFeedback in gridLogic.js), same rules as a duel.
export default function SoloPlay({ onExit }) {
  const [eraId, setEraId] = useState(null)
  const [word, setWord] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('pending')

  const era = eraId ? getEraById(eraId) : null
  const finished = status !== 'pending'
  const keyStates = deriveKeyStates(guesses)

  const { input, setInput, pressKey, pressBackspace, pressEnter, rejection } = useGuessInput({
    wordLength: word?.word.length ?? 0,
    active: !!word && !finished,
    onSubmit: handleSubmit,
    keyStates,
  })

  function startEra(id, method) {
    setEraId(id)
    setWord(getRandomWord(id))
    setGuesses([])
    setInput('')
    setError(null)
    setStatus('pending')
    track('Solo Game Started', { era: getEraById(id).name, method })
  }

  function handleSubmit(value) {
    if (!word) return
    if (value.length !== word.word.length) {
      setError(`Word is ${word.word.length} characters long.`)
      return
    }
    setError(null)

    const feedback = computeFeedback(word.word, value)
    const nextGuesses = [...guesses, { guess: value.toLowerCase(), feedback }]
    setGuesses(nextGuesses)
    setInput('')

    const won = value.toLowerCase() === word.word.toLowerCase()
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
            <>
              {error && <p className="error-text">{error}</p>}
              {/* Always rendered, even when empty: appearing on demand would
                  shove the keypad down mid-tap. aria-live carries it to
                  screen readers, which get nothing from the shake. */}
              <p className="key-rejected-note" aria-live="polite">
                {rejection ? `You've ruled out ${rejection.key.toUpperCase()}.` : ''}
              </p>
              <Keyboard
                keyStates={keyStates}
                onKey={pressKey}
                onEnter={pressEnter}
                onBackspace={pressBackspace}
                rejection={rejection}
              />
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  track('Solo Game Given Up', { era: era.name, guess_count: guesses.length })
                  setStatus('gave_up')
                }}
              >
                I give up
              </button>
            </>
          )}

          {finished && (
            <>
              {/* Same reveal as a finished duel (Guess.jsx): bold word, no
                  quotes. No meaning line here — the hint banner above is
                  already the meaning in solo. */}
              <p>
                {status === 'won' && `Solved it in ${guesses.length}!`}
                {status === 'lost' && (
                  <>
                    Out of guesses — the word was <strong>{word.word}</strong>.
                  </>
                )}
                {status === 'gave_up' && (
                  <>
                    The word was <strong>{word.word}</strong>.
                  </>
                )}
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

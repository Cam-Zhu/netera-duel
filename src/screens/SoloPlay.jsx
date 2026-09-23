import { useEffect, useRef, useState } from 'react'
import EraPicker from '../components/EraPicker'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import HintBanner from '../components/HintBanner'
import GuessGrid, { celebrationDurationMs, revealDurationMs } from '../components/GuessGrid'
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
  const [status, setStatus] = useState('pending')
  // True while the guess that just landed is still washing into the grid.
  // Every guess holds, not only the last one: the keypad derives its colours
  // from the guess list, so without this it lights up the new letters while
  // the grid is still working through them. On the final guess the hold also
  // keeps the finished copy — which replaces the keypad — from yanking the
  // layout out from under an animation the player is still watching.
  const [revealing, setRevealing] = useState(false)
  const revealTimer = useRef(null)

  const era = eraId ? getEraById(eraId) : null
  const finished = status !== 'pending'
  const showFinished = finished && !revealing
  // The keypad holds off on the guess that's still washing in: it would
  // otherwise colour its keys the instant the guess landed, handing over the
  // answer a second before the grid gets to show it.
  const keyStates = deriveKeyStates(revealing ? guesses.slice(0, -1) : guesses)

  useEffect(() => () => clearTimeout(revealTimer.current), [])

  const { input, setInput, pressKey, pressBackspace, pressEnter, rejection, press, shortfall } = useGuessInput({
    wordLength: word?.word.length ?? 0,
    active: !!word && !finished && !revealing,
    onSubmit: handleSubmit,
    keyStates,
  })

  function startEra(id, method) {
    setEraId(id)
    setWord(getRandomWord(id))
    setGuesses([])
    setInput('')
    setStatus('pending')
    clearTimeout(revealTimer.current)
    setRevealing(false)
    track('Solo Game Started', { era: getEraById(id).name, method })
  }

  function handleSubmit(value) {
    if (!word) return

    const feedback = computeFeedback(word.word, value)
    const nextGuesses = [...guesses, { guess: value.toLowerCase(), feedback }]
    setGuesses(nextGuesses)
    setInput('')

    const won = value.toLowerCase() === word.word.toLowerCase()
    const nextStatus = won ? 'won' : nextGuesses.length >= MAX_GUESSES ? 'lost' : 'pending'
    setStatus(nextStatus)

    // A win has the bounce to get through as well as the wash.
    const hold = won ? celebrationDurationMs(word.word.length) : revealDurationMs(word.word.length)
    setRevealing(true)
    clearTimeout(revealTimer.current)
    revealTimer.current = setTimeout(() => setRevealing(false), hold)

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
            shake={shortfall}
            celebrate={status === 'won'}
          />

          {!showFinished && (
            <>
              {/* Always rendered, even when empty: appearing on demand would
                  shove the keypad down mid-tap. aria-live carries it to
                  screen readers, which get nothing from the shake. Both
                  messages share the one reserved line — only one of them can
                  be true of a given press. */}
              <p className="key-rejected-note" aria-live="polite">
                {rejection && `You've ruled out ${rejection.key.toUpperCase()}.`}
                {!rejection && shortfall && `Word is ${word.word.length} characters long.`}
              </p>
              <Keyboard
                keyStates={keyStates}
                onKey={pressKey}
                onEnter={pressEnter}
                onBackspace={pressBackspace}
                rejection={rejection}
                press={press}
              />
              <button
                type="button"
                className="button-secondary"
                // Still on screen through the reveal, so the layout doesn't
                // shift mid-animation — but the round is already decided by
                // then, and giving up must not overwrite a win.
                onClick={() => {
                  if (finished) return
                  track('Solo Game Given Up', { era: era.name, guess_count: guesses.length })
                  setStatus('gave_up')
                }}
              >
                I give up
              </button>
            </>
          )}

          {showFinished && (
            <>
              {/* Same reveal as a finished duel (Guess.jsx): bold word, no
                  quotes. No meaning line here — the hint banner above is
                  already the meaning in solo. */}
              <p className="result-stamp">
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

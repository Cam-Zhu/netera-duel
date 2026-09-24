import { useEffect, useRef, useState } from 'react'
import EraBanner from '../components/EraBanner'
import EraPicker from '../components/EraPicker'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import HintBanner from '../components/HintBanner'
import WordMeaning from '../components/WordMeaning'
import SoloHistory from '../components/SoloHistory'
import GuessGrid, { celebrationDurationMs, revealDurationMs } from '../components/GuessGrid'
import Keyboard from '../components/Keyboard'
import { getEraById, getRandomEra } from '../lib/wordbank'
import { drawWord, clearDecks } from '../lib/soloDeck'
import { readHistory, recordRound, clearHistory, summarise, lastRun } from '../lib/soloHistory'
import { computeFeedback } from '../lib/gridLogic'
import { deriveKeyStates } from '../lib/keyboardLogic'
import { useGuessInput } from '../lib/useGuessInput'
import { track } from '../lib/plausible'

const MAX_GUESSES = 6

// Worth marking, without stopping play for it: a line on the reveal, never a
// screen of its own. Five and ten, then every twenty-fifth.
function isStreakMilestone(streak) {
  if (streak === 5 || streak === 10) return true
  return streak >= 25 && streak % 25 === 0
}

// A run ends when it breaks — that's what a streak is — so the loss is where
// the run gets reported, rather than at some round count that would cut off a
// player mid-roll and mean nothing to one who lost early.
function runSummary(run) {
  const guesses = `${run.best} ${run.best === 1 ? 'guess' : 'guesses'}`
  return run.length === 1
    ? `That run: one solved, in ${guesses}.`
    : `That run: ${run.length} in a row, best ${guesses}.`
}

// No duel row, no slug, no server round-trip — a solo round has no opponent
// to keep the word secret from, so it's just era + word bank + client-side
// feedback (computeFeedback in gridLogic.js), same rules as a duel. The
// record of it all is device-local too: see soloHistory.js.
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
  // Read once on mount and then kept in step by hand: nothing else on the
  // device writes to it while this screen is open, so re-reading storage on
  // every render would only be ceremony.
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  // Words left in this era's deck *behind* the one being played. Zero means
  // this round is the last of a full pass through the era.
  const [deckLeft, setDeckLeft] = useState(null)

  const era = eraId ? getEraById(eraId) : null
  const finished = status !== 'pending'
  const showFinished = finished && !revealing
  const stats = summarise(history)
  // The keypad holds off on the guess that's still washing in: it would
  // otherwise colour its keys the instant the guess landed, handing over the
  // answer a second before the grid gets to show it.
  const keyStates = deriveKeyStates(revealing ? guesses.slice(0, -1) : guesses)

  useEffect(() => setHistory(readHistory()), [])
  useEffect(() => () => clearTimeout(revealTimer.current), [])

  const { input, setInput, pressKey, pressBackspace, pressEnter, rejection, press, shortfall } = useGuessInput({
    wordLength: word?.word.length ?? 0,
    active: !!word && !finished && !revealing,
    onSubmit: handleSubmit,
    keyStates,
  })

  function startEra(id, method) {
    // Replaying the same era hands over the word just played, so a reshuffle
    // can't open with it (see drawWord).
    const { entry, remaining } = drawWord(id, id === eraId ? word?.word ?? null : null)
    if (!entry) return
    setEraId(id)
    setWord(entry)
    setDeckLeft(remaining)
    setGuesses([])
    setInput('')
    setStatus('pending')
    clearTimeout(revealTimer.current)
    setRevealing(false)
    track('Solo Game Started', { era: getEraById(id).name, method })
  }

  // Every finished round, however it finished, reaches the log through here.
  function finish(result, guessCount) {
    setStatus(result)
    setHistory(recordRound({ era: era.id, word: word.word, result, guessCount }))
    if (deckLeft === 0) track('Solo Era Completed', { era: era.name })
  }

  function handleSubmit(value) {
    if (!word) return

    const feedback = computeFeedback(word.word, value)
    const nextGuesses = [...guesses, { guess: value.toLowerCase(), feedback }]
    setGuesses(nextGuesses)
    setInput('')

    const won = value.toLowerCase() === word.word.toLowerCase()
    const nextStatus = won ? 'won' : nextGuesses.length >= MAX_GUESSES ? 'lost' : 'pending'

    // A win has the bounce to get through as well as the wash.
    const hold = won ? celebrationDurationMs(word.word.length) : revealDurationMs(word.word.length)
    setRevealing(true)
    clearTimeout(revealTimer.current)
    revealTimer.current = setTimeout(() => setRevealing(false), hold)

    if (nextStatus === 'pending') {
      setStatus(nextStatus)
      return
    }

    finish(nextStatus, nextGuesses.length)
    track('Solo Game Finished', {
      result: nextStatus,
      guess_count: nextGuesses.length,
      era: era.name,
      // The streak this round leaves behind: 0 on any loss, so the spread of
      // these says how far runs actually get.
      streak: nextStatus === 'won' ? stats.streak + 1 : 0,
    })
  }

  const run = showFinished && status !== 'won' ? lastRun(history) : null

  if (showHistory) {
    return (
      <EraSkinProvider eraId={era?.id}>
        <SoloHistory
          rows={history}
          onClear={() => {
            // The decks go with it: every number on that screen is derived
            // from the rows, and a half-dealt era left behind would be the
            // one trace of solo play that a "clear" hadn't cleared.
            setHistory(clearHistory())
            clearDecks()
            track('Solo History Cleared')
          }}
          onClose={() => setShowHistory(false)}
        />
      </EraSkinProvider>
    )
  }

  return (
    <EraSkinProvider eraId={era?.id}>
      <HowToPlay variant="solo" />
      <h1>Solo play</h1>

      {!era && (
        <>
          <p>Pick an era to guess a word from.</p>
          {stats.played > 0 && (
            <p className="solo-stats">
              Streak <strong>{stats.streak}</strong> · Best <strong>{stats.bestStreak}</strong> · {stats.solved}/
              {stats.played} solved
            </p>
          )}
          {/* Every era at once, because none is picked yet. The five per-era
              banners each mean "you are in this one", which is a claim this
              screen is not making — and era 5's is the wrong kind of loud to
              sit above a row of five equal choices. */}
          <EraBanner src="/og/banner-solo.jpg" />
          <EraPicker selectedEraId={eraId} onSelect={(id) => startEra(id, 'browse')} />
          <button type="button" className="button-secondary" onClick={() => startEra(getRandomEra().id, 'random')}>
            🎲 Random era
          </button>
          {stats.played > 0 && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setShowHistory(true)
                track('Solo History Opened', { from: 'picker' })
              }}
            >
              Your solo record
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onExit}>
            ← Back home
          </button>
        </>
      )}

      {era && word && (
        <>
          {/* The hint IS the meaning in solo, so once the round is over it
              steps aside: the reveal below carries the meaning from there,
              with the origin and year the banner never had room for. The
              era line stays either way. */}
          <HintBanner eraName={era.name} eraRange={era.range} hint={showFinished ? null : word.meaning} />

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
                  finish('gave_up', guesses.length)
                }}
              >
                I give up
              </button>
            </>
          )}

          {showFinished && (
            <>
              {/* Same reveal as a finished duel (Guess.jsx): bold word, no
                  quotes, then the meaning and where it came from. Solo holds
                  the whole bank entry already, so unlike the duel screen it
                  has no findWord lookup to do. */}
              <div className="word-reveal result-stamp">
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
                <WordMeaning entry={word} />
              </div>

              {status === 'won' && (
                <p className={`solo-streak ${isStreakMilestone(stats.streak) ? 'solo-streak--milestone' : ''}`}>
                  {isStreakMilestone(stats.streak) ? `🔥 ${stats.streak} in a row!` : `Streak: ${stats.streak}`}
                </p>
              )}

              {run && <p className="solo-streak">{runSummary(run)}</p>}

              {/* The deck ran out on this word: a full pass through the era,
                  announced where it was earned. The next draw reshuffles. */}
              {deckLeft === 0 && (
                <p className="solo-streak">That's every word in {era.name} — it reshuffles from here.</p>
              )}

              <button type="button" className="button-primary" onClick={() => startEra(era.id, 'replay')}>
                Play again
              </button>

              {/* A broken run is the natural place to point at the actual
                  game: solo is the practice mode, duels are the product. Once
                  per run, not once per round. */}
              {status !== 'won' && (
                <button type="button" className="button-secondary" onClick={onExit}>
                  ⚔ Put a word to a friend
                </button>
              )}

              <button type="button" className="button-secondary" onClick={() => setEraId(null)}>
                ← Change era
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setShowHistory(true)
                  track('Solo History Opened', { from: 'reveal' })
                }}
              >
                Your solo record
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

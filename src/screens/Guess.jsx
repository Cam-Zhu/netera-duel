import { useEffect, useState } from 'react'
import HintBanner from '../components/HintBanner'
import GuessGrid from '../components/GuessGrid'
import EraSkinProvider from '../components/EraSkinProvider'
import HowToPlay from '../components/HowToPlay'
import HeadToHead from '../components/HeadToHead'
import DuelTaken from '../components/DuelTaken'
import DuelSpectator from '../components/DuelSpectator'
import DuelNotice from '../components/DuelNotice'
import TurnBackGate from '../components/TurnBackGate'
import ShareResult from '../components/ShareResult'
import { fetchDuelForGuesser, fetchDuelSpectator, fetchThread, submitGuess } from '../lib/duelsApi'
import { isOwnDuel } from '../lib/localIdentity'
import { getEraByBand } from '../lib/wordbank'
import { track } from '../lib/plausible'

export default function Guess({ slug, onFinished, onSetOwn }) {
  const [duel, setDuel] = useState(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [thread, setThread] = useState(null)
  // Set when another device has claimed this duel: 'open' if it was already
  // taken on arrival, 'guess' if someone beat this device to the first guess
  // while the grid was on screen.
  const [takenStage, setTakenStage] = useState(null)
  // The read-only row for a taken duel, fetched once takenStage is set:
  // undefined while in flight, the get_duel_spectator row on success, null
  // if it failed or found nothing — in which case the plain taken screen
  // stands in, so a spectator RPC that's down or not yet migrated degrades
  // to the old dead end rather than an error.
  const [spectator, setSpectator] = useState(undefined)
  // Whether the "are you Cam?" question on an unplayed turn-back has been
  // answered yes. Session-local on purpose: it's a nudge, not a claim.
  const [gatePassed, setGatePassed] = useState(false)
  // How the initial fetch went. 'not_found' is the RPC answering with no row
  // (a mistyped, cut-off or deleted link); 'error' is it not answering at all
  // (offline, or the client and DB briefly disagreeing on a function
  // signature mid-deploy). Bumping `attempt` re-runs the fetch.
  const [loadState, setLoadState] = useState('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    fetchDuelForGuesser(slug)
      .then((d) => {
        if (cancelled) return
        if (!d) {
          setLoadState('not_found')
          return
        }
        setDuel(d)
        if (d.taken) setTakenStage('open')
        setLoadState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  const finished = !!duel && duel.status !== 'pending'
  const threadId = duel?.thread_id

  // The tally only matters once this duel is done — and it's the nudge to
  // turn back, so it's fetched the moment the final guess lands, not just on
  // reopening a finished link.
  useEffect(() => {
    if (finished && threadId) fetchThread(threadId).then(setThread)
  }, [finished, threadId])

  // One extra round trip, only on the taken path — the guesser RPC nulls
  // everything for a bystander (migration 0007) and is deliberately left
  // that way; what a spectator may see comes from its own function (0009).
  useEffect(() => {
    if (!takenStage) return
    let cancelled = false
    setSpectator(undefined)
    fetchDuelSpectator(slug)
      .then((s) => {
        if (!cancelled) setSpectator(s)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setSpectator(null)
      })
    return () => {
      cancelled = true
    }
  }, [takenStage, slug])

  if (loadState === 'not_found') {
    return (
      <DuelNotice
        title="Couldn't find that duel"
        primaryLabel="Set your own word"
        onPrimary={onSetOwn}
        shownEvent="Duel Not Found Shown"
      >
        The link might be mistyped or cut off. Ask your friend to send it again, or set your own word.
      </DuelNotice>
    )
  }

  if (loadState === 'error') {
    return (
      <DuelNotice
        title="Something went wrong"
        primaryLabel="Try again"
        onPrimary={() => setAttempt((n) => n + 1)}
        secondaryLabel="Set your own word"
        onSecondary={onSetOwn}
        shownEvent="Duel Load Error Shown"
      >
        We couldn't load this duel. Check your connection and try again.
      </DuelNotice>
    )
  }

  if (!duel) return <p>Loading…</p>

  const era = duel.hide_era_band ? null : getEraByBand(duel.era_band)

  if (takenStage) {
    if (spectator === undefined) return <p>Loading…</p>
    if (spectator) {
      return (
        <DuelSpectator
          duel={spectator}
          era={spectator.hide_era_band ? null : getEraByBand(spectator.era_band)}
          stage={takenStage}
          onSetOwn={onSetOwn}
        />
      )
    }
    return (
      <DuelTaken
        setterName={duel.setter_name}
        eraId={era?.id}
        stage={takenStage}
        onSetOwn={onSetOwn}
      />
    )
  }

  // A turn-back nobody has guessed on yet is meant for whoever set its
  // parent. If this browser holds that parent's setter_token, that's them —
  // straight to the grid. Otherwise ask first (see TurnBackGate). Once a
  // guess is in, the duel is claimed by this device and the question is
  // moot, so a reload mid-game never re-asks.
  const unplayedTurnBack = !!duel.parent_slug && duel.status === 'pending' && duel.guesses.length === 0
  if (unplayedTurnBack && !gatePassed && !isOwnDuel(duel.parent_slug)) {
    return (
      <TurnBackGate
        forName={duel.for_name}
        setterName={duel.setter_name}
        eraId={era?.id}
        onYes={() => setGatePassed(true)}
        onSetOwn={onSetOwn}
      />
    )
  }

  const pastGuesses = duel.guesses.map((g) => ({ guess: g.guess, feedback: g.feedback }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (input.length !== duel.word_length) {
      setError(`Word is ${duel.word_length} characters long.`)
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
      if (err.message === 'DUEL_TAKEN') {
        setTakenStage('guess')
        return
      }
      setError('Could not submit that guess — try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EraSkinProvider eraId={era?.id}>
      <HowToPlay variant="guesser" />
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
            onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
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
          <HeadToHead thread={thread} slug={slug} role="guesser" />
          <button
            className="button-primary"
            onClick={() => {
              track('Turn-Back Started')
              onFinished(slug, duel.status, duel.thread_id, duel.id)
            }}
          >
            Pick another word
          </button>
          <ShareResult role="guesser" status={duel.status} guessCount={duel.guess_count} eraName={era?.name} slug={slug} />
        </>
      )}
    </EraSkinProvider>
  )
}

import { useEffect } from 'react'
import EraSkinProvider from './EraSkinProvider'
import HintBanner from './HintBanner'
import GuessGrid from './GuessGrid'
import { track } from '../lib/plausible'

// What a third person sees on a claimed duel link — the read-only sibling of
// DuelTaken, and its replacement whenever get_duel_spectator answers. Same
// heading / sentence / CTA skeleton as DuelNotice, with the hint banner and
// (on a finished duel) the grid dropped in between.
//
// `duel` is the get_duel_spectator row (migration 0009): the server has
// already decided what a spectator may see, so this component renders what
// it's given and adds nothing. On a finished duel `feedback` is an array of
// colour rows with no letters — on a won duel the last row would be the
// word. While pending there's no grid, no count and no hint: nobody watches
// a live game over the claimer's shoulder.
//
// No head-to-head here in either state: it's two other people's whole
// history, and with `setter_name` optional it would often read "Player 1
// leads Player 2", which tells a stranger nothing.
//
// The guesser has no name anywhere in the schema, so the result reads from
// the setter's side ("Cam's word, solved in 3") rather than naming who
// solved it.
//
// `stage` is how they got here — 'open' or 'guess', as for DuelTaken — and
// is only for analytics.
export default function DuelSpectator({ duel, era, stage, onSetOwn }) {
  const finished = duel.status !== 'pending'
  const state = finished ? 'finished' : 'pending'

  useEffect(() => {
    track('Spectator View Shown', { state, stage })
  }, [state, stage])

  const whose = duel.setter_name ? `${duel.setter_name}'s` : 'this'

  return (
    <EraSkinProvider eraId={era?.id}>
      <h1>{finished ? "This one's been played" : "This one's taken"}</h1>
      <HintBanner eraName={era?.name} eraRange={era?.range} hint={duel.hint} />

      {finished && (
        <GuessGrid
          wordLength={duel.word_length}
          pastGuesses={(duel.feedback ?? []).map((feedback) => ({ feedback }))}
        />
      )}

      <p>
        {finished ? resultLine(duel) : `Someone else got to ${whose} word first and is playing it right now.`}{' '}
        Set your own and challenge them back.
      </p>

      <button
        type="button"
        className="button-primary"
        onClick={() => {
          track('Spectator CTA Tapped', { state })
          onSetOwn()
        }}
      >
        Set your own word
      </button>
    </EraSkinProvider>
  )
}

function resultLine({ setter_name: setterName, status, guess_count: guessCount }) {
  const prefix = setterName ? `${setterName}'s word — ` : ''
  if (status === 'won') return setterName ? `${prefix}solved in ${guessCount}.` : `Solved in ${guessCount}.`
  if (status === 'lost') return setterName ? `${prefix}they didn't get it.` : `They didn't get it.`
  // expired: the claimer started but never finished
  return setterName ? `${prefix}nobody finished it.` : 'Nobody finished it.'
}

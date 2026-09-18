import { useEffect, useState } from 'react'
import { buildHeadToHead, viewerPlayerFor } from '../lib/headToHead'

const MAX_GUESSES = 6
// Past this many rounds the older ones fold away behind a button; the score
// above already summarises them.
const COLLAPSE_ABOVE = 5
const SHOW_RECENT = 3
// Long enough for the slowest mount animation to finish (see tokens.css);
// after this the enter class comes off so expanding older rounds doesn't
// replay it.
const ENTER_MS = 1600

// Round-by-round tally for a thread, worded from the viewer's side. `role`
// says how the viewer relates to `slug` — they either set it or guessed it —
// which is enough to work out which player they are without any identity
// leaving the browser.
//
// One card per round, built like a word-list row: the stripe on its left
// edge carries the outcome. Inside, one row per duel headed by whoever
// GUESSED it, so the pips and the count under a name are that person's.
// Pips are aria-hidden; the sentence from lib/headToHead.js is the reading.
export default function HeadToHead({ thread, slug, role }) {
  if (!thread || thread.length < 2) return null

  const viewer = viewerPlayerFor(thread, slug, role)
  if (!viewer) return null

  // Split so the mount animation starts when the thread arrives, not when
  // this wrapper first rendered null while it was still loading.
  return <Tally thread={thread} slug={slug} viewer={viewer} />
}

function Tally({ thread, slug, viewer }) {
  const { label, rounds, tally } = buildHeadToHead(thread, viewer)
  const opponent = viewer === 1 ? 2 : 1
  const opponentName = label(opponent)
  const opponentHasName = opponentName !== `Player ${opponent}`

  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), ENTER_MS)
    return () => clearTimeout(t)
  }, [])

  const [expanded, setExpanded] = useState(false)
  const collapsible = rounds.length > COLLAPSE_ABOVE && !expanded
  const shown = collapsible ? rounds.slice(-SHOW_RECENT) : rounds
  const hidden = rounds.length - shown.length

  return (
    <section className={entering ? 'h2h h2h--enter' : 'h2h'}>
      <h2>Head to head</h2>
      <p className="h2h__players">
        You're Player {viewer}
        {opponentHasName && ` · ${opponentName} is Player ${opponent}`}
      </p>

      <Score tally={tally} opponentName={opponentName} />

      {collapsible && (
        <button type="button" className="h2h__more" onClick={() => setExpanded(true)}>
          Show {hidden} earlier {hidden === 1 ? 'round' : 'rounds'}
        </button>
      )}
      <ol className="h2h__rounds">
        {shown.map((r, i) => (
          <Round key={r.number} round={r} index={i} viewer={viewer} label={label} currentSlug={slug} />
        ))}
      </ol>
    </section>
  )
}

// Same block as the hint banner: accent rule, small-caps label, then the
// score as a sentence with the figures bold.
function Score({ tally, opponentName }) {
  const { mine, theirs, draws, inPlay } = tally
  const played = mine + theirs + draws

  let sentence
  if (played === 0) sentence = 'Nothing scored yet'
  else if (mine > theirs) sentence = <>You lead <strong>{mine}–{theirs}</strong></>
  else if (theirs > mine) sentence = <>{opponentName} leads <strong>{theirs}–{mine}</strong></>
  else sentence = <>You're level at <strong>{mine}–{theirs}</strong></>

  const notes = []
  if (draws > 0) notes.push(`${draws} drawn`)
  if (inPlay) notes.push(`Round ${inPlay} in play`)

  return (
    <div className="hint-banner h2h__score">
      <span className="hint-banner__era">Score</span>
      <p className="h2h__score-line">{sentence}</p>
      {notes.length > 0 && <p className="h2h__score-note">{notes.join(' · ')}</p>}
    </div>
  )
}

function Round({ round, index, viewer, label, currentSlug }) {
  return (
    <li className={`h2h__round h2h__round--${outcomeClass(round.outcome, viewer)}`} style={{ '--i': index }}>
      <span className="h2h__round-title">{round.title}</span>
      {round.duels.map((d) => (
        <Duel key={d.slug} duel={d} label={label} current={d.slug === currentSlug} />
      ))}
    </li>
  )
}

function Duel({ duel, label, current }) {
  const classes = ['h2h__duel']
  if (current) classes.push('h2h__duel--current')
  if (duel.status === 'expired') classes.push('h2h__duel--expired')

  return (
    <div className={classes.join(' ')}>
      <span className="h2h__duel-label" aria-hidden="true">
        {label(duel.guesser)}
      </span>
      <Pips filled={duel.guessCount ?? 0} lost={duel.status === 'lost'} />
      <span className="h2h__duel-text">{emphasiseCount(duel.text, duel.guessCount)}</span>
    </div>
  )
}

// Six pips always: three filled against three hollow reads as "three of six"
// at a glance, where three alone would not. A loss is five filled and a
// crossed sixth so it can't be mistaken for a solve in six.
function Pips({ filled, lost = false }) {
  const pips = []
  for (let p = 0; p < MAX_GUESSES; p += 1) {
    let cls = 'h2h__pip'
    if (lost && p === MAX_GUESSES - 1) cls += ' h2h__pip--lost'
    else if (p < filled) cls += ' h2h__pip--filled'
    pips.push(<span key={p} className={cls} style={{ '--p': p }} />)
  }
  return (
    <span className="h2h__pips" aria-hidden="true">
      {pips}
    </span>
  )
}

// "You solved Jess's in 3 guesses" → the 3 in bold. The count only appears
// in the sentence once, right after "in ".
function emphasiseCount(text, count) {
  if (count == null) return text
  const needle = ` in ${count} `
  const at = text.indexOf(needle)
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)} in <strong>{count}</strong> {text.slice(at + needle.length)}
    </>
  )
}

function outcomeClass(outcome, viewer) {
  if (outcome === viewer) return 'won'
  if (outcome === 1 || outcome === 2) return 'lost'
  return outcome // 'draw' | 'pending' | 'void'
}

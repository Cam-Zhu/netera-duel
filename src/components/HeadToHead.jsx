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

// Round-by-round tally for a thread, drawn from the viewer's side. `role`
// says how the viewer relates to `slug` — they either set it or guessed it —
// which is enough to work out which player they are without any identity
// leaving the browser.
//
// The visuals are the scoreboard, a spine with each word on its setter's
// side, and a pip row per duel. All of it is aria-hidden; the sentences from
// lib/headToHead.js stay in the DOM as the accessible reading.
export default function HeadToHead({ thread, slug, role }) {
  if (!thread || thread.length < 2) return null

  const viewer = viewerPlayerFor(thread, slug, role)
  if (!viewer) return null

  // Split so the mount animation starts when the thread arrives, not when
  // this wrapper first rendered null while it was still loading.
  return <Tally thread={thread} slug={slug} viewer={viewer} />
}

function Tally({ thread, slug, viewer }) {
  const { label, rounds, score, tally } = buildHeadToHead(thread, viewer)
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

  const notes = []
  if (tally.draws > 0) notes.push(`${tally.draws} drawn`)
  if (tally.inPlay) notes.push(`Round ${tally.inPlay} in play`)

  return (
    <section className={entering ? 'h2h h2h--enter' : 'h2h'}>
      <h2>Head to head</h2>
      <p className="h2h__players">
        You're Player {viewer}
        {opponentHasName && ` · ${opponentName} is Player ${opponent}`}
      </p>

      <Scoreboard mine={tally.mine} theirs={tally.theirs} opponentName={opponentName} />
      {score && <p className="h2h__sr">{score}</p>}
      {notes.length > 0 && <p className="h2h__note">{notes.join(' · ')}</p>}

      {collapsible && (
        <button type="button" className="h2h__more" onClick={() => setExpanded(true)}>
          Show {hidden} earlier {hidden === 1 ? 'round' : 'rounds'}
        </button>
      )}
      <ol className="h2h__spine">
        {shown.map((r, i) => (
          <Round key={r.number} round={r} index={i} viewer={viewer} label={label} currentSlug={slug} />
        ))}
      </ol>
    </section>
  )
}

function Scoreboard({ mine, theirs, opponentName }) {
  const level = mine === theirs
  return (
    <div className={level ? 'h2h__board h2h__board--level' : 'h2h__board'} aria-hidden="true">
      <div className="h2h__side">
        <span className="h2h__side-name">You</span>
        <Numeral value={mine} lead={mine > theirs} />
      </div>
      <span className="h2h__divider" />
      <div className="h2h__side">
        <span className="h2h__side-name">{opponentName}</span>
        <Numeral value={theirs} lead={theirs > mine} />
      </div>
    </div>
  )
}

// The digits are drawn by CSS from --h2h-n (a counter in ::after) so the
// count-up on mount can be a keyframe rather than script.
function Numeral({ value, lead }) {
  return <span className={lead ? 'h2h__num h2h__num--lead' : 'h2h__num'} style={{ '--h2h-n': value }} />
}

function Round({ round, index, viewer, label, currentSlug }) {
  // The round is chronological down the page: first half on row 1 beside the
  // node, second half on row 2. A missing second half becomes a ghost on the
  // side of whoever's turn it is to set — the guesser of the first half.
  const entries = round.duels.map((d, i) => (
    <Entry key={d.slug} duel={d} row={i + 1} viewer={viewer} label={label} current={d.slug === currentSlug} />
  ))
  if (round.duels.length === 1) {
    entries.push(<Ghost key="ghost" side={round.duels[0].setBy === viewer ? 'theirs' : 'mine'} row={2} />)
  }

  return (
    <li className={`h2h__round h2h__round--${outcomeClass(round.outcome, viewer)}`} style={{ '--i': index }}>
      <span className="h2h__node" aria-hidden="true">
        {round.number}
      </span>
      <span className="h2h__sr">{round.title}</span>
      {entries}
    </li>
  )
}

function Entry({ duel, row, viewer, label, current }) {
  const side = duel.setBy === viewer ? 'mine' : 'theirs'
  const classes = ['h2h__entry', `h2h__entry--${side}`]
  if (current) classes.push('h2h__entry--current')
  if (duel.status === 'expired') classes.push('h2h__entry--expired')

  const lost = duel.status === 'lost'
  return (
    <div className={classes.join(' ')} style={{ gridRow: row }}>
      <span className="h2h__entry-name" aria-hidden="true">
        {label(duel.setBy)}
      </span>
      <Pips filled={duel.guessCount ?? 0} lost={lost} />
      <span className="h2h__count" aria-hidden="true">
        {lost ? '✕' : duel.guessCount ?? ''}
      </span>
      <span className="h2h__entry-text">{duel.text}</span>
    </div>
  )
}

function Ghost({ side, row }) {
  return (
    <div className={`h2h__entry h2h__entry--${side} h2h__entry--ghost`} style={{ gridRow: row }} aria-hidden="true">
      <Pips filled={0} />
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

function outcomeClass(outcome, viewer) {
  if (outcome === viewer) return 'won'
  if (outcome === 1 || outcome === 2) return 'lost'
  return outcome // 'draw' | 'pending' | 'void'
}

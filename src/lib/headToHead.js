// Turns get_thread rows into the head-to-head view: each duel labelled by who
// set it and who guessed it, relative to whoever is looking, plus a running
// score. Shared by the setter's "Your duel" page and the guesser's finished
// screen so both sides see the same tally.
//
// Scoring is per ROUND, not per duel. Player 2 has always played one more duel
// than Player 1 (or the same number), so "most solved" or "fewest guesses"
// would be structurally biased. A round is one exchange — duels 1+2, 3+4 and
// so on — inside which each player has guessed exactly once, and fewer guesses
// wins it. Running out of guesses counts as one worse than the maximum, so a
// fail always loses to a solve.

const MAX_GUESSES = 6
const LOST_SCORE = MAX_GUESSES + 1

const other = (player) => (player === 1 ? 2 : 1)

// Which player the viewer is. On the setter's page they set `slug`; on the
// guesser's page they're the one who guessed it.
export function viewerPlayerFor(thread, slug, role) {
  const duel = thread.find((t) => t.slug === slug)
  if (!duel) return null
  return role === 'setter' ? duel.set_by : other(duel.set_by)
}

export function buildHeadToHead(thread, viewer) {
  const names = playerNames(thread)
  const label = (p) => (p === viewer ? 'You' : names[p] ?? `Player ${p}`)
  const possessive = (p) => (p === viewer ? 'yours' : `${label(p)}'s`)

  const rounds = []
  for (let i = 0; i < thread.length; i += 2) {
    const duels = thread.slice(i, i + 2)
    rounds.push({
      number: rounds.length + 1,
      // Alongside the sentence, the raw facts the spine draws from: who set
      // it, whether it's done, and the guess count (null until it is).
      duels: duels.map((d) => ({
        slug: d.slug,
        setBy: d.set_by,
        status: d.status,
        guessCount: d.status === 'won' || d.status === 'lost' ? d.guess_count : null,
        text: describe(d, label, possessive),
      })),
      outcome: roundOutcome(duels),
    })
  }

  const wins = { 1: 0, 2: 0 }
  let draws = 0
  for (const r of rounds) {
    if (r.outcome === 'draw') draws += 1
    else if (r.outcome === 1 || r.outcome === 2) wins[r.outcome] += 1
  }

  const inPlay = rounds.find((r) => r.outcome === 'pending')

  return {
    label,
    rounds: rounds.map((r) => ({ ...r, title: roundTitle(r, label) })),
    score: scoreLine(wins, draws, rounds, viewer, label),
    // The same numbers the sentence is built from, for the scoreboard.
    tally: { mine: wins[viewer], theirs: wins[other(viewer)], draws, inPlay: inPlay?.number ?? null },
  }
}

// A player may type a different name on each duel they set (or none) — use
// the most recent one they gave.
function playerNames(thread) {
  const names = {}
  for (const d of thread) {
    if (d.setter_name) names[d.set_by] = d.setter_name
  }
  return names
}

function describe(d, label, possessive) {
  const guesser = other(d.set_by)
  const who = label(guesser)
  switch (d.status) {
    case 'won':
      return `${who} solved ${possessive(d.set_by)} in ${d.guess_count} ${d.guess_count === 1 ? 'guess' : 'guesses'}`
    case 'lost':
      return `${who} ran out of guesses`
    case 'expired':
      return `${capitalise(possessive(d.set_by))} went unanswered`
    default:
      return who === 'You' ? "You're still guessing" : `Waiting on ${who}`
  }
}

// 1 | 2 — the winner; 'draw'; 'pending' — still being played; or 'void' —
// can never be scored (a duel went unanswered, or the same player set both
// halves after a double turn-back, so the two guessers aren't opponents).
function roundOutcome(duels) {
  if (duels.length < 2 || duels.some((d) => d.status === 'pending')) return 'pending'
  if (duels.some((d) => d.status === 'expired')) return 'void'
  const [a, b] = duels
  if (a.set_by === b.set_by) return 'void'

  const score = (d) => (d.status === 'won' ? d.guess_count : LOST_SCORE)
  if (score(a) === score(b)) return 'draw'
  // The guesser of each duel is the other player from its setter.
  return score(a) < score(b) ? other(a.set_by) : other(b.set_by)
}

function roundTitle(round, label) {
  const base = `Round ${round.number}`
  switch (round.outcome) {
    case 1:
    case 2:
      return `${base} · ${label(round.outcome)} won`
    case 'draw':
      return `${base} · Drawn`
    case 'pending':
      return `${base} · In play`
    default:
      return `${base} · Unscored`
  }
}

function scoreLine(wins, draws, rounds, viewer, label) {
  const mine = wins[viewer]
  const theirs = wins[other(viewer)]
  const played = mine + theirs + draws
  const inPlay = rounds.find((r) => r.outcome === 'pending')

  if (played === 0) return inPlay ? `Round ${inPlay.number} in play` : null

  let line
  if (mine > theirs) line = `You lead ${mine}–${theirs}`
  else if (theirs > mine) line = `${label(other(viewer))} leads ${theirs}–${mine}`
  else line = `Level at ${mine}–${theirs}`

  if (draws > 0) line += ` (${draws} drawn)`
  if (inPlay) line += ` — round ${inPlay.number} in play`
  return line
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

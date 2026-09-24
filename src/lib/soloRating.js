// A verdict on solo play, derived from the same rows as everything else on
// the record screen (see soloHistory.js). Deliberately not a sixth statistic:
// the numbers up there are honest and flat, and none of them answers the
// question the player actually has, which is "am I any good at this".
//
// Two things make someone good, and a rating that ignores either is lying:
// how often they solve, and how fast. Solve rate alone scores a player who
// grinds out 6-guess wins identically to one who hits it in 2.

// Newest-first rows, so the window is the most recent N rounds. A rolling
// window rather than all-time: a lifetime average stops moving after a few
// dozen rounds, at which point the rating is a fossil and there's no reason
// to open it twice.
export const WINDOW = 20

// Below this the average is noise — three unlucky words would read as a
// verdict on the player. Ten is enough to be unflattering with a straight
// face.
export const MIN_ROUNDS = 10

const MAX_GUESSES = 6

// A solve is worth 100 minus 8 a guess, so a 6-guess win still banks 60: it
// was a win, and the grid was doing its job. Losses and give-ups are both 0,
// which means walking away early is worth exactly what playing it out and
// missing is worth — there's nothing to game in either direction.
//
// The 8 is the calibration knob. Raising it widens the gap between a fast
// solver and a slow one; lowering it lets solve rate dominate.
export function scoreRound(row) {
  if (row.result !== 'won') return 0
  const guesses = Math.min(Math.max(row.guessCount ?? MAX_GUESSES, 1), MAX_GUESSES)
  return 100 - 8 * (guesses - 1)
}

// Ten bands, one per ten points, drawn across all five eras so the ladder is
// itself a tour of the history the game is made of. `lead` and `term` are
// split so the term can carry its own weight in the sentence — the full line
// is "Your internet slang knowledge " + lead + " " + term.
//
// The top band is an insult. That's the joke, and it's the right note to end
// a ladder about being extremely online on.
const LADDER = [
  { min: 0, lead: 'is strictly', term: 'n00b', gloss: 'Everyone starts here. Most people leave.' },
  { min: 10, lead: 'just got', term: 'pwned', gloss: 'The word bank is winning, and it is not close.' },
  { min: 20, lead: 'is', term: 'mid', gloss: 'Not bad. Not good. Mid.' },
  { min: 30, lead: 'is deeply', term: 'normie', gloss: 'You know the ones that made it onto the news.' },
  { min: 40, lead: 'is pure', term: 'lurker', gloss: 'Present, reading everything, posting nothing.' },
  { min: 50, lead: 'is solid, if a little', term: 'basic', gloss: 'You were there. You just were not taking notes.' },
  { min: 60, lead: 'is', term: 'based', gloss: 'You know what you know, and you are right about it.' },
  { min: 70, lead: 'is absolutely', term: 'cracked', gloss: 'Suspiciously fast. Suspiciously correct.' },
  { min: 80, lead: 'is straight-up', term: 'goated', gloss: 'Greatest-of-all-time behaviour, frankly.' },
  { min: 90, lead: 'is', term: 'terminally online', gloss: 'This is not a compliment. Go outside.' },
]

export function bandFor(score) {
  // 100 would land past the end of the ladder on its own, so the top band
  // owns 90 through 100 rather than 90 through 99.
  return LADDER[Math.min(LADDER.length - 1, Math.max(0, Math.floor(score / 10)))]
}

// Takes a row set rather than reading storage itself, so it can be handed a
// filtered list the day per-era ratings land — the maths doesn't care which
// rounds it's given, only that they're newest-first.
export function rate(rows) {
  const window = rows.slice(0, WINDOW)

  if (window.length < MIN_ROUNDS) {
    return { unlocked: false, played: window.length, remaining: MIN_ROUNDS - window.length }
  }

  const score = Math.round(window.reduce((sum, row) => sum + scoreRound(row), 0) / window.length)
  return { unlocked: true, score, band: bandFor(score), counted: window.length }
}

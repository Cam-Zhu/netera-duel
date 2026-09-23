// Per-key colour for the on-screen keypad (components/Keyboard.jsx),
// derived from the same guesses the grid is already drawn from — no extra
// state, no server round-trip.
//
// Precedence is green > yellow > grey, and that ordering is load-bearing.
// A letter that IS in the word can still score grey on one of its
// occurrences: guess "zizz" against "rizz" and two z's match, leaving the
// third nothing to pair with, so it comes back grey. Keeping the best state
// a character ever received means such a letter never reads as ruled out.
//
// The same ordering is what will make "grey" safe to act on when the keypad
// starts blocking: a key can only end up grey if every occurrence of it, in
// every guess, came back grey — and compute_feedback always matches as many
// of a letter as the word contains, so that can only happen when the letter
// genuinely isn't there.
//
// Presence only, deliberately. This never tracks how many of a letter are
// left ("you've already found the only z"). That's true but invisible to the
// player, so acting on it would read as a bug rather than a hint.

const RANK = { grey: 0, yellow: 1, green: 2 }

export function deriveKeyStates(pastGuesses) {
  const states = {}

  for (const past of pastGuesses) {
    // Spectator rows carry feedback but no letters (see GuessGrid) — there's
    // nothing to colour a key with, and guessing at it would leak the word.
    if (!past.guess) continue

    for (let i = 0; i < past.guess.length; i++) {
      const char = past.guess[i].toLowerCase()
      const feedback = past.feedback[i]
      if (!(feedback in RANK)) continue

      const current = states[char]
      if (current === undefined || RANK[feedback] > RANK[current]) {
        states[char] = feedback
      }
    }
  }

  return states
}

export function keyStateToClass(state) {
  switch (state) {
    case 'green':
      return 'key--green'
    case 'yellow':
      return 'key--yellow'
    case 'grey':
      return 'key--grey'
    default:
      return ''
  }
}

// For duels, the green/yellow/grey comparison lives server-side (submit_guess
// in the Supabase migration) so the secret word never reaches the client.
// Solo play has no opponent to keep the word secret from, so it runs the
// same algorithm client-side instead — kept in lockstep with compute_feedback
// in supabase/migrations/0001_init.sql.
export function computeFeedback(secret, guess) {
  const secretChars = secret.toLowerCase().split('')
  const guessChars = guess.toLowerCase().split('')
  const len = secretChars.length
  const feedback = Array(len).fill('grey')
  const remaining = [...secretChars]

  for (let i = 0; i < len; i++) {
    if (guessChars[i] === secretChars[i]) {
      feedback[i] = 'green'
      remaining[i] = null
    }
  }

  for (let i = 0; i < len; i++) {
    if (feedback[i] === 'grey') {
      const j = remaining.indexOf(guessChars[i])
      if (j !== -1) {
        feedback[i] = 'yellow'
        remaining[j] = null
      }
    }
  }

  return feedback
}

export function buildBlankRow(length) {
  return Array.from({ length }, () => ({ letter: '', feedback: 'empty' }))
}

export function feedbackToClass(feedback) {
  switch (feedback) {
    case 'green':
      return 'tile-green'
    case 'yellow':
      return 'tile-yellow'
    case 'grey':
      return 'tile-grey'
    case 'typed':
      return 'tile-typed'
    default:
      return 'tile-empty'
  }
}

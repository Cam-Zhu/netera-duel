// The actual green/yellow/grey comparison lives server-side (submit_guess in
// the Supabase migration) so the secret word never reaches the client. These
// helpers are purely for rendering.

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

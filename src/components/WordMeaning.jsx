// The revealed word's meaning, with its origin and year quieter underneath.
// Shared by the finished duel screen and the finished solo round so a word
// explains itself the same way whoever set it.

// The bank's meanings are written as bare phrases ("Be right back"); on a
// finished screen they stand as a sentence of their own, so close them.
function asSentence(text) {
  return /[.!?…]$/.test(text) ? text : `${text}.`
}

// Omitted entirely when the bank doesn't know the word (see findWord) — no
// placeholder, no "meaning unavailable".
export default function WordMeaning({ entry }) {
  if (!entry) return null
  return (
    <div className="word-meaning">
      <p className="word-meaning__meaning">{asSentence(entry.meaning)}</p>
      {(entry.origin || entry.year) && (
        <p className="word-meaning__origin">{[entry.origin, entry.year].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  )
}

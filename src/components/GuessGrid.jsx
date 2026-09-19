import Tile from './Tile'
import { buildBlankRow } from '../lib/gridLogic'

// pastGuesses: [{ guess: 'rizz', feedback: ['green','grey',...] }]
//   `guess` is optional: the spectator view (DuelSpectator) gets colours
//   only from the server, so its rows carry just `feedback` and render as
//   blank coloured tiles — same grid, no letters to leak.
// wordLength: used to size blank rows so the shape of the answer is visible
// before any guess is made (per claude.md word-length convention).
export default function GuessGrid({ wordLength, pastGuesses, maxGuesses = 6, currentInput = '' }) {
  const rows = []

  for (const past of pastGuesses) {
    rows.push(
      past.feedback.map((fb, i) => ({ letter: past.guess?.[i] ?? '', feedback: fb }))
    )
  }

  if (rows.length < maxGuesses) {
    const typedRow = buildBlankRow(wordLength).map((cell, i) => ({
      letter: currentInput[i] ?? '',
      feedback: currentInput[i] ? 'typed' : 'empty',
    }))
    rows.push(typedRow)
  }

  while (rows.length < maxGuesses) {
    rows.push(buildBlankRow(wordLength))
  }

  return (
    <div className="guess-grid">
      {rows.map((row, r) => (
        <div className="guess-row" key={r}>
          {row.map((cell, c) => (
            <Tile key={c} letter={cell.letter} feedback={cell.feedback} />
          ))}
        </div>
      ))}
    </div>
  )
}

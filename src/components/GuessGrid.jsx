import { useEffect, useRef } from 'react'
import Tile from './Tile'
import { buildBlankRow } from '../lib/gridLogic'

// Reveal timings, in ms. They live here rather than in tokens.css because the
// play screens need them too — the finished screen waits for the grid to
// finish before it replaces the keypad (see revealDurationMs below) — and one
// set of numbers in two places drifts. The CSS reads them off the row as
// custom properties.
const REVEAL_MS = 260
const REVEAL_STEP_MS = 55
const BOUNCE_MS = 240
const BOUNCE_STEP_MS = 70

// How long a submitted row takes to finish washing in.
export function revealDurationMs(wordLength) {
  return Math.max(wordLength - 1, 0) * REVEAL_STEP_MS + REVEAL_MS
}

// The same, plus the winning row's bounce, which starts once the wash lands.
export function celebrationDurationMs(wordLength) {
  return revealDurationMs(wordLength) + Math.max(wordLength - 1, 0) * BOUNCE_STEP_MS + BOUNCE_MS
}

// A refused submit shakes the row. Run through the Web Animations API rather
// than a CSS class: the class would have to be torn off and re-added to
// replay, and the only reliable way to do that — remounting the row — would
// remount its tiles too and set every letter popping again.
const SHAKE_FRAMES = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6px)' },
  { transform: 'translateX(6px)' },
  { transform: 'translateX(-4px)' },
  { transform: 'translateX(4px)' },
  { transform: 'translateX(0)' },
]

// pastGuesses: [{ guess: 'rizz', feedback: ['green','grey',...] }]
//   `guess` is optional: the spectator view (DuelSpectator) gets colours
//   only from the server, so its rows carry just `feedback` and render as
//   blank coloured tiles — same grid, no letters to leak.
// wordLength: used to size blank rows so the shape of the answer is visible
// before any guess is made (per claude.md word-length convention).
// shake: a bare nonce from useGuessInput; bumping it shakes the typed row.
// celebrate: the last row is the winning guess, so bounce it once it's washed
//   in. Ignored for a row that was already on the grid at mount.
export default function GuessGrid({
  wordLength,
  pastGuesses,
  maxGuesses = 6,
  currentInput = '',
  shake = null,
  celebrate = false,
}) {
  const typedRowRef = useRef(null)
  const nonce = shake?.nonce ?? null

  // Rows already present on the first render arrived with the page: a duel
  // reopened after the fact, or a spectator's read-only grid. Those are being
  // read, not played, so they don't wash in — only rows submitted from here.
  const settledOnMount = useRef(pastGuesses.length)

  useEffect(() => {
    if (!nonce) return
    const el = typedRowRef.current
    if (!el?.animate) return
    // The rest of the app's motion sits in CSS, where one @media block covers
    // it; this one animation has to ask for itself.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate(SHAKE_FRAMES, { duration: 320, easing: 'ease-in-out' })
  }, [nonce])

  const rows = []

  pastGuesses.forEach((past, i) => {
    rows.push({
      kind: 'past',
      // Keyed by position among the past guesses, so a row that has landed
      // keeps its identity for good. Without this the row that was the typed
      // row would come back as the new guess in the same slot, React would
      // reuse it, and the wash — which plays on mount — would never fire.
      key: `g${i}`,
      reveal: i >= settledOnMount.current,
      win: celebrate && i === pastGuesses.length - 1 && i >= settledOnMount.current,
      cells: past.feedback.map((fb, c) => ({ letter: past.guess?.[c] ?? '', feedback: fb })),
    })
  })

  if (rows.length < maxGuesses) {
    rows.push({
      kind: 'typed',
      key: 'typed',
      cells: buildBlankRow(wordLength).map((cell, i) => ({
        letter: currentInput[i] ?? '',
        feedback: currentInput[i] ? 'typed' : 'empty',
      })),
    })
  }

  while (rows.length < maxGuesses) {
    rows.push({ kind: 'blank', key: `b${rows.length}`, cells: buildBlankRow(wordLength) })
  }

  return (
    <div className="guess-grid">
      {rows.map((row) => (
        <div
          className={[
            'guess-row',
            row.kind === 'typed' ? 'guess-row--typed' : '',
            row.reveal ? 'guess-row--reveal' : '',
            row.win ? 'guess-row--win' : '',
          ].filter(Boolean).join(' ')}
          key={row.key}
          ref={row.kind === 'typed' ? typedRowRef : undefined}
          style={
            row.reveal
              ? {
                  '--rev-ms': `${REVEAL_MS}ms`,
                  '--rev-step': `${REVEAL_STEP_MS}ms`,
                  '--bounce-ms': `${BOUNCE_MS}ms`,
                  '--bounce-step': `${BOUNCE_STEP_MS}ms`,
                  '--bounce-start': `${revealDurationMs(wordLength)}ms`,
                }
              : undefined
          }
        >
          {row.cells.map((cell, c) => (
            <Tile
              // In the typed row the letter is part of the key, so filling a
              // tile mounts a new one and the pop in tokens.css plays — on
              // that tile only, since the others keep their identity. Elsewhere
              // the position is the identity: a settled row never re-animates.
              key={row.kind === 'typed' ? `${c}-${cell.letter}` : c}
              letter={cell.letter}
              feedback={cell.feedback}
              index={row.reveal ? c : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

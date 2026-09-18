import { useState } from 'react'
import { track } from '../lib/plausible'

const MAX_GUESSES = 6

// Spoiler-free result for a group chat: the pip row as emoji, the era if it
// was shown, and the site — never the word, the hint or the /d/ link (the
// duel is claimed, so that link is a dead end for a third person). Same
// copy/share mechanics as ShareCard.
export default function ShareResult({ role, status, guessCount, eraName }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const text = resultText({ role, status, guessCount, eraName })

  async function copyResult() {
    await navigator.clipboard.writeText(text)
    track('Result Shared', { role, result: status, method: 'copy' })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function shareResult() {
    setSharing(true)
    track('Result Shared', { role, result: status, method: 'native_share' })
    try {
      await navigator.share({ text })
    } catch {
      // user cancelled or share failed — nothing to do
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="share-result">
      <pre className="share-result__preview">{text}</pre>
      <div className="share-result__actions">
        <button type="button" className="button-secondary" onClick={copyResult}>
          {copied ? 'Copied!' : 'Copy result'}
        </button>
        {navigator.share && (
          <button type="button" className="button-secondary" onClick={shareResult} disabled={sharing} aria-busy={sharing}>
            {sharing ? 'Opening…' : 'Share result'}
          </button>
        )}
      </div>
    </div>
  )
}

// Circles rather than squares so it reads as the tally's pip row, not the
// grid's per-letter feedback. A loss is five filled and a crossed sixth,
// matching the pips on screen.
export function resultText({ role, status, guessCount, eraName }) {
  const lost = status === 'lost'
  const filled = lost ? MAX_GUESSES - 1 : guessCount
  const pips = '🟢'.repeat(filled) + (lost ? '❌' : '⚪'.repeat(MAX_GUESSES - filled))

  let outcome
  if (role === 'setter') outcome = lost ? "my word — they didn't get it" : `my word, solved in ${guessCount}`
  else outcome = lost ? "didn't get it" : `solved in ${guessCount}`

  const title = eraName ? `Netera Duel · ${eraName}` : 'Netera Duel'
  return `${title}\n${pips}  ${outcome}\n${window.location.host}`
}

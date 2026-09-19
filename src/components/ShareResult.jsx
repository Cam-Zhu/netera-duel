import { useState } from 'react'
import { track } from '../lib/plausible'

const MAX_GUESSES = 6

// Spoiler-free result for a group chat: the pip row as emoji, the era if it
// was shown, and the duel's own link — never the word or the hint. The link
// is safe to post because a third person opening a claimed duel gets the
// spectator view (colours only, migration 0009), and the /d/* edge function
// unfurls a finished duel as a result card. Same copy/share mechanics as
// ShareCard.
export default function ShareResult({ role, status, guessCount, eraName, slug }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const text = resultText({ role, status, guessCount, eraName, slug })

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
// Uses window.location.origin, so a preview deploy shares its own host.
export function resultText({ role, status, guessCount, eraName, slug }) {
  const lost = status === 'lost'
  const filled = lost ? MAX_GUESSES - 1 : guessCount
  const pips = '🟢'.repeat(filled) + (lost ? '❌' : '⚪'.repeat(MAX_GUESSES - filled))

  let outcome
  if (role === 'setter') outcome = lost ? "my word — they didn't get it" : `my word, solved in ${guessCount}`
  else outcome = lost ? "didn't get it" : `solved in ${guessCount}`

  const title = eraName ? `Netera Duel · ${eraName}` : 'Netera Duel'
  const link = slug ? `${window.location.origin}/d/${slug}` : window.location.host
  return `${title}\n${pips}  ${outcome}\n${link}`
}

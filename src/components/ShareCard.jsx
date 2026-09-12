import { useState } from 'react'
import { track } from '../lib/plausible'

export default function ShareCard({ slug }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const url = `${window.location.origin}/d/${slug}`

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    track('Share Link', { method: 'copy' })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function shareLink() {
    setSharing(true)
    track('Share Link', { method: 'native_share' })
    try {
      await navigator.share({ title: 'Netera Duel', text: "You've been challenged to a word duel", url })
    } catch {
      // user cancelled or share failed — nothing to do
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="share-card">
      <p className="share-card__url">{url}</p>
      <button type="button" className="button-primary" onClick={copyLink}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      {navigator.share && (
        <button type="button" className="button-secondary" onClick={shareLink} disabled={sharing} aria-busy={sharing}>
          {sharing ? 'Opening…' : 'Share'}
        </button>
      )}
    </div>
  )
}

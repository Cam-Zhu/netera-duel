import { useState } from 'react'

export default function ShareCard({ slug }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/d/${slug}`

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="share-card">
      <p className="share-card__url">{url}</p>
      <button type="button" className="button-primary" onClick={copyLink}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      {navigator.share && (
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigator.share({ title: 'Netera Duel', text: "You've been challenged to a word duel", url })}
        >
          Share
        </button>
      )}
    </div>
  )
}

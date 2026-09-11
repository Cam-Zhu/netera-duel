import { useState } from 'react'

export default function HowToPlay() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label="How to play"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-card__close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
            <h2>How to play</h2>
            <ol>
              <li>Pick a word from an internet era, browse the list, or tap "🎲 Random era" if you're in a hurry.</li>
              <li>Add an optional hint, then get a shareable link. No account needed.</li>
              <li>Send the link to a friend. They see the era and hint, then guess your word Wordle-style: 6 tries, with green/yellow/grey letter feedback.</li>
              <li>Right after they finish, they set their own word back at you, that's what keeps a duel going.</li>
              <li>Track who's ahead: "You solved theirs in 3, they solved yours in 5."</li>
            </ol>
            <p>GL/HF</p>
          </div>
        </div>
      )}
    </>
  )
}

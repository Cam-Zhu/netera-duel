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
              <li>Pick a word from an internet era, browse the list, or tap the "Random era" button.</li>
              <li>Add an optional hint, you can be as creative or helpful as you like, then get a shareable link.</li>
              <li>Send the link to a friend. They see the era and hint, then try to guess your word: Letters turn green if they are correct and in the right place. Yellow if in the word but not in the right place.</li>
              <li>After they finish, they can set their own word for you to try, completing the duel.</li>
              <li>The app will track who wins, e.g. "You solved theirs in 3, they solved yours in 5."</li>
            </ol>
            <p>Works best in 1-to-1 chats for now, multiplayer coming soon.</p>
            <p>GL HF</p>
          </div>
        </div>
      )}
    </>
  )
}

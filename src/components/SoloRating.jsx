import { useState } from 'react'
import { track } from '../lib/plausible'
import { rate, MIN_ROUNDS } from '../lib/soloRating'

// The verdict behind the % in the corner of the record screen. Built like
// HowToPlay — same fixed corner button, same modal shell — because it's the
// same gesture, and the record screen doesn't render the ? so the corner is
// free.
//
// "NetEra rating" is the second deliberate use of the wordmark capital in
// running text, after the tab title — Cam's call, 24 Sep 2026. The rating is
// the game's own verdict rather than a generic one, and the heading says so.
// Don't "correct" it to Netera.
//
// The button is shown from round one rather than appearing at ten. An icon
// that materialises unannounced is invisible as a goal; a locked one that
// says how far off it is gives the player something to be ten rounds into.
export default function SoloRating({ rows }) {
  const [open, setOpen] = useState(false)
  const rating = rate(rows)
  const label = rating.unlocked ? 'Your NetEra rating' : 'Your NetEra rating (locked)'

  const openModal = () => {
    setOpen(true)
    track(
      'Solo Rating Opened',
      rating.unlocked ? { score: rating.score, term: rating.band.term } : { locked: 'yes', played: rating.played },
    )
  }

  return (
    <>
      <button
        type="button"
        className={`help-button ${rating.unlocked ? '' : 'help-button--locked'}`}
        aria-label={label}
        onClick={openModal}
      >
        %
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card solo-rating" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-card__close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
            <h2>Your NetEra rating</h2>

            {rating.unlocked ? (
              <>
                <p className="solo-rating__score">{rating.score}%</p>
                <p className="solo-rating__verdict">
                  Your internet slang knowledge {rating.band.lead}{' '}
                  <strong className="solo-rating__term">{rating.band.term}</strong>.
                </p>
                <p className="solo-rating__gloss">{rating.band.gloss}</p>
              </>
            ) : (
              <>
                <p className="solo-rating__verdict">
                  Play {MIN_ROUNDS} rounds to unlock your rating —{' '}
                  <strong className="solo-rating__term">
                    {rating.remaining} to go
                  </strong>
                  .
                </p>
                <p className="solo-rating__gloss">
                  {rating.played === 0
                    ? 'Nothing played yet.'
                    : `${rating.played} of ${MIN_ROUNDS} so far. Fewer than that and the number would be noise, not a verdict.`}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

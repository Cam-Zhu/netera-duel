import { useState } from 'react'
import { track } from '../lib/plausible'

// The setter, the guesser and a solo player arrive at very different screens,
// so the modal is worded from whichever side is reading it: the setter needs
// the whole loop (pick, hint, share), the guesser needs how to guess, how to
// turn the duel back, and what they'll see once both sides are done. Solo has
// no opponent and no link, so it gets its own title as well as its own steps,
// or the duel wording reads as a mistake.
function SetterSteps() {
  return (
    <ol>
      <li>Pick a word from an internet era, browse the list, or tap the "Random era" button.</li>
      <li>Add an optional hint, you can be as creative or helpful as you like, then get a shareable link.</li>
      <li>Send the link to a friend. They see the era and hint, then try to guess your word: Letters turn green if they are correct and in the right place. Yellow if in the word but not in the right place.</li>
      <li>After they finish, they can set their own word for you to try, completing the duel.</li>
      <li>The app will track who wins, e.g. "You solved theirs in 3, they solved yours in 5."</li>
    </ol>
  )
}

function GuesserSteps() {
  return (
    <ol>
      <li>A friend has picked a word from an internet era for you to guess. The era and their hint (if they left one) are shown above the grid.</li>
      <li>Tap out a guess on the keypad to fill the row, then hit Enter. You have 6 goes. Letters turn green if they are correct and in the right place, yellow if in the word but in the wrong place, and grey if not in the word at all.</li>
      <li>Keys grey out as you rule letters out, and stop working. If a letter isn't in the word, you can't spend a guess on it twice.</li>
      <li>Once you've finished, tap "Pick another word" to set a word of your own for them to guess. That completes the duel.</li>
      <li>When both of you have played, you'll each see the head-to-head: who solved it in fewer guesses, round by round, and the running score.</li>
    </ol>
  )
}

function SoloSteps() {
  return (
    <ol>
      <li>Pick an internet era from the list, or tap the "Random era" button to be dropped into one.</li>
      <li>A word is dealt to you from that era. Its meaning sits above the grid as your hint, and the tiles show how long it is.</li>
      <li>Tap out a guess on the keypad to fill the row, then hit Enter. You have 6 goes. Letters turn green if they are correct and in the right place, yellow if in the word but in the wrong place, and grey if not in the word at all.</li>
      <li>Keys grey out as you rule letters out, and stop working. Stuck for good? Tap "I give up" to see the word.</li>
      <li>Solving keeps a streak going and a miss ends the run. Your record is kept on this device under "Your solo record", nothing is sent anywhere.</li>
      <li>Each era deals through its whole word list before any word comes round again, so an era can be played out and then reshuffles.</li>
    </ol>
  )
}

export default function HowToPlay({ variant = 'setter' }) {
  const [open, setOpen] = useState(false)
  const title = variant === 'solo' ? 'How to play (solo mode)' : 'How to play'

  const openModal = () => {
    setOpen(true)
    track('How To Play Opened', { variant })
  }

  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label={title}
        onClick={openModal}
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
            <h2>{title}</h2>
            {variant === 'guesser' && <GuesserSteps />}
            {variant === 'solo' && <SoloSteps />}
            {variant === 'setter' && <SetterSteps />}
            <p>GL HF</p>
          </div>
        </div>
      )}
    </>
  )
}

import { useEffect } from 'react'
import EraSkinProvider from './EraSkinProvider'
import { track } from '../lib/plausible'

// Shown to anyone who isn't the device that made the first guess on a duel —
// usually a link dropped in a group chat. Deliberately shows nothing about
// the claimer's game (the server already nulls it out, see migration 0007)
// and no way into the thread: the one exit is setting a fresh word of their
// own, so a bounced visitor becomes a new setter rather than a dead end.
//
// `stage` says how they got here — 'open' (already taken when the link was
// opened) or 'guess' (they typed a guess but someone beat them to it) — for
// analytics only.
export default function DuelTaken({ setterName, eraId, stage, onSetOwn }) {
  useEffect(() => {
    track('Duel Taken Shown', { stage })
  }, [stage])

  const whose = setterName ? `${setterName}'s` : 'this'

  return (
    <EraSkinProvider eraId={eraId}>
      <h1>This one's taken</h1>
      <p>Someone else got to {whose} word first. Set your own and challenge them back.</p>
      <button
        type="button"
        className="button-primary"
        onClick={() => {
          track('Duel Taken CTA Tapped')
          onSetOwn()
        }}
      >
        Set your own word
      </button>
    </EraSkinProvider>
  )
}

import { useEffect } from 'react'
import DuelNotice from './DuelNotice'
import { track } from '../lib/plausible'

// Shown to anyone who isn't the device that made the first guess on a duel —
// usually a link dropped in a group chat. Deliberately shows nothing about
// the claimer's game (the server already nulls it out, see migration 0007)
// and no way into the thread: the one exit is setting a fresh word of their
// own, so a bounced visitor becomes a new setter rather than a dead end.
//
// Since the spectator view (DuelSpectator, migration 0009) this is the
// fallback for when get_duel_spectator fails or returns nothing — Guess.jsx
// tries that first. The event names stay as they were so Plausible keeps
// the pre-spectator baseline to compare against.
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
    <DuelNotice
      eraId={eraId}
      title="This one's taken"
      primaryLabel="Set your own word"
      onPrimary={() => {
        track('Duel Taken CTA Tapped')
        onSetOwn()
      }}
    >
      Someone else got to {whose} word first. Set your own and challenge them back.
    </DuelNotice>
  )
}

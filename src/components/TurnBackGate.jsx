import { useEffect } from 'react'
import DuelNotice from './DuelNotice'
import { track } from '../lib/plausible'

// Asked before the grid on a turn-back duel that nobody has guessed on yet,
// unless this browser holds the setter_token for the duel it answers (which
// proves it's the intended player — see Guess.jsx). A reply duel is meant
// for one person, but until the first guess it's unclaimed and anyone with
// the link could take it (0007), locking that person out and putting a
// stranger's result in the pair's head-to-head. The DB can't tell the
// intended player from a stranger — device ids fragment across browsers,
// so it stays permissive (migration 0010) — and this is the honest ceiling
// without accounts: it stops the accidental jump-in from a group chat, not
// someone who says yes anyway.
//
// `forName` is the parent duel's setter_name and may be absent; `setterName`
// is this duel's setter and may be too.
export default function TurnBackGate({ forName, setterName, eraId, onYes, onSetOwn }) {
  useEffect(() => {
    track('Turn-Back Gate Shown', { named: forName ? 'yes' : 'no' })
  }, [forName])

  let lead
  if (forName) {
    lead = setterName
      ? `${setterName} set it as a reply in their duel with ${forName}.`
      : `It's a reply in someone's duel with ${forName}.`
  } else {
    lead = setterName
      ? `${setterName} set it as a reply to someone's word.`
      : "It's a reply to someone else's word."
  }

  return (
    <DuelNotice
      eraId={eraId}
      title={forName ? `This one's for ${forName}` : 'Is this one yours?'}
      primaryLabel={forName ? `Yes, I'm ${forName}` : "Yes, it's mine"}
      onPrimary={() => {
        track('Turn-Back Gate Passed')
        onYes()
      }}
      secondaryLabel="Set your own word"
      onSecondary={() => {
        track('Turn-Back Gate Declined')
        onSetOwn()
      }}
    >
      {lead} If that's you, go ahead — if not, set your own word and start a duel of your own.
    </DuelNotice>
  )
}

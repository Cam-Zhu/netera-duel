import { useEffect } from 'react'
import EraSkinProvider from './EraSkinProvider'
import { track } from '../lib/plausible'

// The one-message-and-a-way-out layout every dead end on a duel link uses —
// taken, not found, failed to load. Heading, a sentence, a primary action,
// and optionally a secondary one; wrapped in the era skin when the caller has
// an era to hand and the neutral base otherwise. `shownEvent` is tracked once
// on mount for the screens that don't need extra props on the event.
export default function DuelNotice({
  eraId,
  title,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  shownEvent,
}) {
  useEffect(() => {
    if (shownEvent) track(shownEvent)
  }, [shownEvent])

  return (
    <EraSkinProvider eraId={eraId}>
      <h1>{title}</h1>
      <p>{children}</p>
      <button type="button" className="button-primary" onClick={onPrimary}>
        {primaryLabel}
      </button>
      {secondaryLabel && (
        <button type="button" className="button-secondary" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      )}
    </EraSkinProvider>
  )
}

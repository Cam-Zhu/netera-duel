import { buildHeadToHead, viewerPlayerFor } from '../lib/headToHead'

// Round-by-round tally for a thread, worded from the viewer's side ("You solved
// Jess's in 3"). `role` says how the viewer relates to `slug` — they either set
// it or guessed it — which is enough to work out which player they are without
// any identity leaving the browser.
export default function HeadToHead({ thread, slug, role }) {
  if (!thread || thread.length < 2) return null

  const viewer = viewerPlayerFor(thread, slug, role)
  if (!viewer) return null

  const { label, rounds, score } = buildHeadToHead(thread, viewer)
  const opponent = viewer === 1 ? 2 : 1
  const opponentName = label(opponent)
  const opponentHasName = opponentName !== `Player ${opponent}`

  return (
    <section className="h2h">
      <h2>Head to head</h2>
      <p className="h2h__players">
        You're Player {viewer}
        {opponentHasName && ` · ${opponentName} is Player ${opponent}`}
      </p>
      <ol className="h2h__rounds">
        {rounds.map((r) => (
          <li key={r.number} className="h2h__round">
            <div className="h2h__round-title">{r.title}</div>
            <ul className="h2h__duels">
              {r.duels.map((d) => (
                <li key={d.slug} className={d.slug === slug ? 'h2h__duel h2h__duel--current' : 'h2h__duel'}>
                  {d.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {score && <p className="h2h__score">{score}</p>}
    </section>
  )
}

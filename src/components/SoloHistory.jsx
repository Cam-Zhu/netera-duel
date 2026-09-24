import { useState } from 'react'
import { getEras, getEraById } from '../lib/wordbank'
import { summarise } from '../lib/soloHistory'
import SoloRating from './SoloRating'

// Rounds are stamped in UTC and read back in whatever the device calls home;
// the list is a personal log, so "23 Sep, 14:32" is all it needs to be.
function when(at) {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function outcome(row) {
  if (row.result === 'won') return `Solved in ${row.guessCount}`
  if (row.result === 'lost') return 'Out of guesses'
  return 'Gave up'
}

// The device's own record of solo play: the numbers on top, the rounds they
// came from underneath. Read-only by design — individual rounds can't be
// edited or deleted, because a record you can groom isn't a record. The one
// exception is clearing the lot, which is the only way to get this off the
// device at all.
export default function SoloHistory({ rows, onClear, onClose }) {
  const [era, setEra] = useState('all')
  const [confirmingClear, setConfirmingClear] = useState(false)

  const filtered = era === 'all' ? rows : rows.filter((r) => r.era === era)
  const stats = summarise(filtered)
  // Runs span eras, so a per-era streak would be counting wins while ignoring
  // the losses in between. Shown on the unfiltered view only.
  const showStreaks = era === 'all'

  return (
    <div className="solo-history">
      {/* The % in the corner this screen leaves free — the ? button belongs
          to the play screen, and only one of the two is ever mounted. */}
      <SoloRating rows={rows} />
      <h2>Your solo record</h2>

      {!rows.length && <p>Nothing here yet — play a round and it'll show up.</p>}

      {!!rows.length && (
        <>
          <div className="solo-history__filters">
            <button
              type="button"
              className={`solo-history__chip ${era === 'all' ? 'solo-history__chip--on' : ''}`}
              onClick={() => setEra('all')}
            >
              All eras
            </button>
            {getEras()
              // Only eras actually played — an empty filter is a dead end.
              .filter((e) => rows.some((r) => r.era === e.id))
              .map((e) => (
                <button
                  key={e.id}
                  type="button"
                  data-era={e.id}
                  className={`solo-history__chip ${era === e.id ? 'solo-history__chip--on' : ''}`}
                  onClick={() => setEra(e.id)}
                >
                  <span className="solo-history__swatch" aria-hidden="true" />
                  {e.name}
                </button>
              ))}
          </div>

          <dl className="solo-history__stats">
            <div>
              <dt>Played</dt>
              <dd>{stats.played}</dd>
            </div>
            <div>
              <dt>Solved</dt>
              <dd>{stats.solved}</dd>
            </div>
            {showStreaks && (
              <>
                <div>
                  <dt>Streak</dt>
                  <dd>{stats.streak}</dd>
                </div>
                <div>
                  <dt>Best streak</dt>
                  <dd>{stats.bestStreak}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Best solve</dt>
              <dd>
                {stats.personalBest ? (
                  <>
                    {stats.personalBest.guessCount} <span className="solo-history__pb-word">{stats.personalBest.word}</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>

          <ul className="solo-history__rows">
            {filtered.map((row) => (
              <li key={row.at + row.word} data-era={row.era} className={`solo-history__row solo-history__row--${row.result}`}>
                <span className="solo-history__word">{row.word}</span>
                <span className="solo-history__outcome">{outcome(row)}</span>
                <span className="solo-history__meta">
                  {getEraById(row.era)?.name ?? row.era} · {when(row.at)}
                </span>
              </li>
            ))}
          </ul>

          {/* Two taps rather than a browser confirm(): this wipes the streak
              and the best-ever along with the rows, since every number here
              is derived from them. */}
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              if (!confirmingClear) return setConfirmingClear(true)
              setConfirmingClear(false)
              onClear()
            }}
          >
            {confirmingClear ? 'Tap again to wipe it all' : 'Clear history'}
          </button>
        </>
      )}

      <button type="button" className="button-secondary" onClick={onClose}>
        ← Back
      </button>
    </div>
  )
}

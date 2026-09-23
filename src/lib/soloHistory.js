// Solo play's whole record, on this device and nowhere else. One append-only
// log of finished rounds; the streak, the best streak, the personal best and
// the history list are all derived from it, so there's no second counter that
// can drift out of step with the rows it claims to summarise — and clearing
// the log clears the numbers with it, because the rows *are* the evidence.
//
// Only finished rounds land here (won, lost, gave up). Walking away mid-word
// records nothing and so can't break a streak. With no server and no
// leaderboard the only person that fools is the player, and the alternative —
// persisting in-progress rounds — would turn an accidental refresh into a
// broken streak, which is the worse failure of the two.

const KEY = 'netera:soloHistory'

// Rows are ~80 bytes and the whole list is read on every solo screen, so the
// cap is about keeping localStorage tidy rather than speed. It does mean a
// current streak longer than this reads as capped, as would a best streak
// that has since been evicted — at 200 rounds the player has larger
// achievements to hand than this number.
const LIMIT = 200

function read() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

// Newest first, everywhere: the streak, the last run and the list itself all
// read from the recent end, so it's the order that keeps the derivations
// plain (rows[0] is always the round that just finished).
export function readHistory() {
  return read()
}

export function recordRound({ era, word, result, guessCount }) {
  const rows = [{ at: new Date().toISOString(), era, word, result, guessCount }, ...read()].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch {
    // Private mode, or a full quota. The round still played and the screen
    // still reads from the array we return — only the record is lost.
  }
  return rows
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear if it couldn't be written in the first place */
  }
  return []
}

// `streak` and `bestStreak` only mean anything over the unfiltered log: a run
// is consecutive *rounds*, and counting them inside one era would quietly
// skip the losses in another. The history view shows them on "all eras" only
// (see SoloHistory) — the rest of the fields are honest under any filter.
export function summarise(rows) {
  let streak = 0
  for (const row of rows) {
    if (row.result !== 'won') break
    streak++
  }

  let bestStreak = 0
  let run = 0
  for (const row of rows) {
    run = row.result === 'won' ? run + 1 : 0
    if (run > bestStreak) bestStreak = run
  }

  let personalBest = null
  for (const row of rows) {
    // Ties go to the earlier round — it got there first, and rows are newest
    // first, so a strict < keeps it.
    if (row.result === 'won' && (!personalBest || row.guessCount <= personalBest.guessCount)) personalBest = row
  }

  return {
    played: rows.length,
    solved: rows.filter((r) => r.result === 'won').length,
    streak,
    bestStreak,
    personalBest,
  }
}

// The run that the most recent unsolved round brought to an end — i.e. the
// wins sitting directly behind it. Null when nothing has ended a run yet, and
// null for back-to-back losses, where the run that ended was empty and there
// is nothing worth reporting.
export function lastRun(rows) {
  const ended = rows.findIndex((r) => r.result !== 'won')
  if (ended === -1) return null

  const won = []
  for (let i = ended + 1; i < rows.length && rows[i].result === 'won'; i++) won.push(rows[i])
  if (!won.length) return null

  return { length: won.length, best: Math.min(...won.map((r) => r.guessCount)) }
}

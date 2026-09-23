// Which words solo has left to deal in each era.
//
// Rounds are dealt from a shuffled deck rather than drawn at random. An era
// holds 39-48 words, so a uniform random draw repeats itself within about
// eight rounds — often enough that a streak would contain words the player
// already knew the answer to, which hollows out the number the streak is
// meant to stand for. Dealing without replacement makes a repeat impossible
// until the era runs out, and running it out is the milestone (SoloPlay
// announces it on the last word's reveal; the next draw reshuffles).
//
// Decks are per era and persist across sessions, so a player who dips into
// an era once a week still works through it rather than restarting it.

import { getWordsForEra } from './wordbank'

const KEY = 'netera:soloDecks'

function read() {
  try {
    const decks = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return decks && typeof decks === 'object' && !Array.isArray(decks) ? decks : {}
  } catch {
    return {}
  }
}

function write(decks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks))
  } catch {
    // Without storage every draw reshuffles, which is the old random-draw
    // behaviour — worse, but still a playable round.
  }
}

function shuffle(words) {
  const deck = [...words]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

// A stored deck is filtered against the live bank every time it's read: a
// word dropped or renamed between sessions (`tl;dr` -> `tldr`, 17 Sep 2026)
// would otherwise be dealt as a word the bank can no longer explain.
function undealt(decks, eraId) {
  const live = new Set(getWordsForEra(eraId).map((w) => w.word))
  const deck = Array.isArray(decks[eraId]) ? decks[eraId] : []
  return deck.filter((w) => live.has(w))
}

// -> { entry, remaining, reshuffled }: the bank entry to play, how many words
// are left in the era's deck behind it, and whether this draw started a fresh
// pass. `entry` is null only if the era has no words at all.
//
// `avoid` is the word just played, and only matters across a reshuffle: a
// fresh deck has every word back in it, including that one, so without this
// the one draw in ~43 that hands it straight back would land at exactly the
// moment the player was told they'd seen the whole era. Within a pass the
// deck already makes a repeat impossible.
export function drawWord(eraId, avoid = null) {
  const decks = read()
  let deck = undealt(decks, eraId)

  const reshuffled = deck.length === 0
  if (reshuffled) {
    deck = shuffle(getWordsForEra(eraId).map((w) => w.word))
    // Bury it rather than drop it — it still owes the player an appearance,
    // just not as the first card off a brand-new deck.
    if (deck.length > 1 && deck[deck.length - 1] === avoid) {
      const swap = Math.floor(Math.random() * (deck.length - 1))
      ;[deck[deck.length - 1], deck[swap]] = [deck[swap], deck[deck.length - 1]]
    }
  }

  const word = deck.pop() ?? null
  decks[eraId] = deck
  write(decks)

  return {
    entry: word ? getWordsForEra(eraId).find((w) => w.word === word) ?? null : null,
    remaining: deck.length,
    reshuffled,
  }
}

export function deckRemaining(eraId) {
  return undealt(read(), eraId).length
}

export function clearDecks() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* see write() */
  }
}

import data from '../data/wordbank.json'

export function getEras() {
  return [...data.eras].sort((a, b) => a.order - b.order)
}

export function getEraById(eraId) {
  return data.eras.find((e) => e.id === eraId) ?? null
}

// duels.era_band in the DB is the smallint 1-5 order; the word bank JSON
// keys words by the era's string id, so this is the bridge between the two.
export function getEraByBand(band) {
  return data.eras.find((e) => e.order === band) ?? null
}

export function getWordsForEra(eraId) {
  return data.words.filter((w) => w.era === eraId)
}

export function getRandomWord(eraId) {
  const words = eraId ? getWordsForEra(eraId) : data.words
  return words[Math.floor(Math.random() * words.length)]
}

export function getRandomEra() {
  const eras = getEras()
  return eras[Math.floor(Math.random() * eras.length)]
}

// Bank entry for a word that came back from the DB, or null. Read-only and
// deliberately soft: duels created before a bank rename (`tl;dr` → `tldr`,
// 17 Sep 2026) or on a word since dropped still hold their old secret_word,
// and the finished screen just shows the word alone for those. Matches on
// `word` only — `alt` is documentary and nothing else reads it.
export function findWord(word) {
  if (typeof word !== 'string' || !word) return null
  const key = word.toLowerCase()
  return data.words.find((w) => w.word === key) ?? null
}

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

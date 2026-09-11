// Anonymous, device-scoped identity — no accounts. Two things live in localStorage:
//   1. a creatorId, used server-side only to enforce the 20-free-duels limit
//   2. a slug -> setterToken map, so a setter can reopen their own duel's status
//      screen without that same power being reachable from the shared link.

const CREATOR_ID_KEY = 'netera:creatorId'
const MY_DUELS_KEY = 'netera:myDuels'

export function getCreatorId() {
  let id = localStorage.getItem(CREATOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CREATOR_ID_KEY, id)
  }
  return id
}

function readMyDuels() {
  try {
    return JSON.parse(localStorage.getItem(MY_DUELS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function rememberOwnDuel(slug, setterToken) {
  const duels = readMyDuels()
  duels[slug] = setterToken
  localStorage.setItem(MY_DUELS_KEY, JSON.stringify(duels))
}

export function getSetterToken(slug) {
  return readMyDuels()[slug] ?? null
}

export function isOwnDuel(slug) {
  return getSetterToken(slug) !== null
}

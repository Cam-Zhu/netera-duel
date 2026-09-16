// Anonymous, device-scoped identity — no accounts. Two things live in localStorage:
//   1. a creatorId, stamped on every duel server-side (per-device usage tracking;
//      the 20-free-duels cap it once enforced is lifted for testing — see
//      supabase/migrations/0004). The same id is sent when guessing: the first
//      guess claims the duel for this device and every other device is bounced
//      to the "taken" screen (0007). One id per device covers both roles.
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

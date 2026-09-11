import { supabase } from './supabaseClient'
import { getCreatorId, rememberOwnDuel } from './localIdentity'
import { track } from './plausible'

// Thin wrappers around the RPC functions defined in
// supabase/migrations/0001_init.sql. The client never reads/writes the
// `duels` table directly — see that file for why.

export async function createDuel({ eraBand, secretWord, hint, hideEraBand, setterName, threadId, parentDuelId }) {
  const { data, error } = await supabase.rpc('create_duel', {
    p_creator_id: getCreatorId(),
    p_era_band: eraBand,
    p_secret_word: secretWord,
    p_hint: hint || null,
    p_hide_era_band: !!hideEraBand,
    p_setter_name: setterName || null,
    p_thread_id: threadId || null,
    p_parent_duel_id: parentDuelId || null,
  })

  if (error) {
    if (error.message?.includes('duel_limit_reached')) {
      throw new Error('DUEL_LIMIT_REACHED')
    }
    throw error
  }

  const { slug, setter_token: setterToken } = data[0]
  rememberOwnDuel(slug, setterToken)
  track('Duel Created', { era_band: eraBand, turn_back: threadId ? 'yes' : 'no' })
  return { slug, setterToken }
}

export async function fetchDuelForGuesser(slug) {
  const { data, error } = await supabase.rpc('get_duel_for_guesser', { p_slug: slug })
  if (error) throw error
  return data[0] ?? null
}

export async function fetchDuelForSetter(setterToken) {
  const { data, error } = await supabase.rpc('get_duel_for_setter', { p_setter_token: setterToken })
  if (error) throw error
  return data[0] ?? null
}

export async function fetchThread(threadId) {
  const { data, error } = await supabase.rpc('get_thread', { p_thread_id: threadId })
  if (error) throw error
  return data
}

export async function submitGuess(slug, guess) {
  const { data, error } = await supabase.rpc('submit_guess', { p_slug: slug, p_guess: guess })
  if (error) {
    if (error.message?.includes('wrong_length')) throw new Error('WRONG_LENGTH')
    if (error.message?.includes('duel_already_finished')) throw new Error('ALREADY_FINISHED')
    throw error
  }
  const result = data[0]
  if (result.status !== 'pending') {
    track('Duel Finished', { result: result.status, guess_count: result.guess_count })
  }
  return result
}

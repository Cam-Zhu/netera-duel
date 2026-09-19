-- ---------------------------------------------------------------------------
-- Reveal the word to the guesser once the duel is over.
--
-- A guesser who ran out of guesses was never told the word: 0001 shaped
-- get_duel_for_guesser without secret_word and nothing since revisited it.
-- Wordle reveals; so does this. It matters most at the moment the finished
-- screen asks for a turn-back — a loss that ends on "the word was hidden"
-- gives nothing to react to.
--
-- get_duel_for_guesser gains one column:
--
--   secret_word — non-null only when the duel is NOT taken (0007) AND its
--                 status is no longer 'pending'. Both conditions in one
--                 explicit case below, so the rule is readable in one place.
--                 A bystander on a finished, claimed duel still learns only
--                 that it is taken; a mid-game guesser still gets null.
--
-- Everything else — the taken null-out, parent_slug / for_name from 0010 —
-- is unchanged. submit_guess, get_duel_og and the other functions are not
-- touched; the OG function must never carry the word.
--
-- Return type changes, so drop-and-recreate; search_path and the anon grant
-- are re-applied per 0008 (a new function is callable by nobody until
-- granted). Idempotent.
-- ---------------------------------------------------------------------------

drop function if exists public.get_duel_for_guesser(text, uuid);

create function public.get_duel_for_guesser(p_slug text, p_guesser_id uuid)
returns table(
  slug text, era_band smallint, hide_era_band boolean, hint text, setter_name text,
  word_length int, status duel_status, guesses jsonb, guess_count int, thread_id uuid,
  id uuid, taken boolean, parent_slug text, for_name text, secret_word text
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  -- `is distinct from` rather than `<>`: a null p_guesser_id must count as
  -- "someone else", not slip through as unknown and return the full row.
  with d as (
    select src.*,
           (src.guesser_id is not null and src.guesser_id is distinct from p_guesser_id) as is_taken
    from duels src
    where src.slug = p_slug
  )
  select
    d.slug, d.era_band, d.hide_era_band,
    case when d.is_taken then null else d.hint end,
    d.setter_name,
    case when d.is_taken then null else char_length(d.secret_word) end,
    case when d.is_taken then null else d.status end,
    case when d.is_taken then null else d.guesses end,
    case when d.is_taken then null else d.guess_count::int end,
    case when d.is_taken then null else d.thread_id end,
    case when d.is_taken then null else d.id end,
    d.is_taken,
    case when d.is_taken then null else p.slug end,
    case when d.is_taken then null else p.setter_name end,
    -- The one rule that matters: the word leaves the DB only for the player
    -- this duel belongs to, and only once it can no longer be guessed.
    case when not d.is_taken and d.status <> 'pending'
         then d.secret_word else null end
  from d
  left join duels p on p.id = d.parent_duel_id;
$$;

revoke execute on function public.get_duel_for_guesser(text, uuid) from public, anon, authenticated;
grant  execute on function public.get_duel_for_guesser(text, uuid) to anon;

-- ---------------------------------------------------------------------------
-- Turn-back gate: tell the guesser who a reply duel was set for.
--
-- A turn-back duel is meant for one specific person — whoever set the duel
-- it answers — but until someone guesses it's unclaimed, and claiming is
-- first-guess-wins (0007). If the link lands in a group chat, a third
-- device can guess first, lock the intended player out, and (because
-- get_thread attributes results by turn order, not device) have their game
-- credited to that player in the pair's head-to-head.
--
-- Refusing anyone but the parent's creator_id would stop that, but one
-- person routinely shows up as several device ids (Safari vs. the installed
-- PWA vs. a chat app's in-app browser — the reason get_thread walks the
-- parent chain instead of trusting creator_id), and the common path of
-- setting a word in Safari then tapping the reply in WhatsApp would lock
-- the real player out of their own game. So the DB stays permissive and
-- the client asks instead: "Jess set this one for Cam. Are you Cam?" — a
-- soft gate that stops the accidental jump-in, not a lie.
--
-- get_duel_for_guesser gains two columns for that:
--
--   parent_slug  — the duel this one answers, so a browser holding that
--                  duel's setter_token knows it *is* the intended player
--                  and can skip the question.
--   for_name     — the parent's setter_name, for the copy. Null when the
--                  parent's setter gave no name, and on any duel that isn't
--                  a turn-back.
--
-- Both are null when the duel is `taken`: a spectator doesn't need them.
-- The parent is always finished and claimed (a turn-back is only created
-- after finishing), so its slug leads to nothing a spectator couldn't
-- already see.
--
-- Return type changes, so drop-and-recreate; search_path and the anon grant
-- are re-applied per 0008. submit_guess and the claiming rules are
-- untouched.
-- ---------------------------------------------------------------------------

drop function if exists public.get_duel_for_guesser(text, uuid);

create function public.get_duel_for_guesser(p_slug text, p_guesser_id uuid)
returns table(
  slug text, era_band smallint, hide_era_band boolean, hint text, setter_name text,
  word_length int, status duel_status, guesses jsonb, guess_count int, thread_id uuid,
  id uuid, taken boolean, parent_slug text, for_name text
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
    case when d.is_taken then null else p.setter_name end
  from d
  left join duels p on p.id = d.parent_duel_id;
$$;

revoke execute on function public.get_duel_for_guesser(text, uuid) from public, anon, authenticated;
grant  execute on function public.get_duel_for_guesser(text, uuid) to anon;

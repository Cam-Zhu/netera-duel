-- ---------------------------------------------------------------------------
-- Head-to-head: tell the client which of the two players set each duel.
--
-- A thread is a conversation between exactly two devices, so "Player 1" is
-- whoever created the thread's opening duel and "Player 2" is whoever set the
-- rest. That is derived here from creator_id, which is already stamped on
-- every row — no new identity, no login, and the raw creator ids never leave
-- the database (the client only ever sees 1 or 2).
--
-- Derived from creator_id rather than from position in the thread because an
-- impatient guesser can reopen a finished link and hit "Pick another word"
-- twice, which breaks strict alternation. The trade-off is that a player who
-- switches device mid-thread becomes a new creator_id and so shows up as
-- Player 2 — inherent to having no accounts, and rare enough to accept.
--
-- setter_name is returned too so the client can label the other player by the
-- name they typed, falling back to "Player N".
-- ---------------------------------------------------------------------------

-- Return-row changes alter the OUT parameter signature, which
-- create-or-replace refuses to do in place (same as migration 0002).
drop function if exists get_thread(uuid);

create function get_thread(p_thread_id uuid)
returns table(
  slug text, status duel_status, guess_count int, created_at timestamptz,
  set_by smallint, setter_name text
)
language sql security definer stable as $$
  with opener as (
    select creator_id
    from duels
    where thread_id = p_thread_id
    order by created_at asc
    limit 1
  )
  select
    d.slug, d.status, d.guess_count, d.created_at,
    (case when d.creator_id = opener.creator_id then 1 else 2 end)::smallint,
    d.setter_name
  from duels d, opener
  where d.thread_id = p_thread_id
  order by d.created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- get_duel_for_guesser gains the duel's id so a turn-back can record which
-- duel it answers (parent_duel_id) — the client only ever had the slug, so
-- that column has been null since launch. The id grants nothing: the slug is
-- the access token, the id is only ever written back as a foreign key.
-- ---------------------------------------------------------------------------

drop function if exists get_duel_for_guesser(text);

create function get_duel_for_guesser(p_slug text)
returns table(
  slug text, era_band smallint, hide_era_band boolean, hint text, setter_name text,
  word_length int, status duel_status, guesses jsonb, guess_count int, thread_id uuid,
  id uuid
)
language sql security definer stable as $$
  select
    d.slug, d.era_band, d.hide_era_band, d.hint, d.setter_name,
    char_length(d.secret_word), d.status, d.guesses, d.guess_count, d.thread_id,
    d.id
  from duels d
  where d.slug = p_slug;
$$;

-- Dropping the functions above also dropped their grants.
grant execute on function get_thread to anon;
grant execute on function get_duel_for_guesser to anon;

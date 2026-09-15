-- ---------------------------------------------------------------------------
-- Derive each duel's player from the turn-back chain, not from creator_id.
--
-- 0005 labelled a duel as Player 1 when its creator_id matched the thread's
-- opener. In testing that broke immediately: creator_id lives in localStorage,
-- and the same person routinely shows up under several — a link opened from
-- a chat lands in Safari/Chrome, while the installed PWA has its own storage,
-- as does an incognito tab. One player's duels then split across P1 and P2,
-- and the other side inherits their name.
--
-- The thread's structure is the reliable signal. A turn-back is always set by
-- whoever guessed its parent (that's the only way the UI creates one), so
-- walking parent_duel_id from the opener alternates P1, P2, P1, ... no matter
-- which device each duel came from. A double turn-back (two children of the
-- same parent) correctly lands both on the same player.
--
-- parent_duel_id was only recorded from 0005 onwards. Rows without one — the
-- opener, and any legacy turn-back — are seeded from their position in the
-- thread instead, and chained rows hang off whichever seed they descend from,
-- so threads that straddle the change still come out right going forward.
-- ---------------------------------------------------------------------------

create or replace function get_thread(p_thread_id uuid)
returns table(
  slug text, status duel_status, guess_count int, created_at timestamptz,
  set_by smallint, setter_name text
)
language sql security definer stable as $$
  with recursive ordered as (
    select d.id, d.slug, d.status, d.guess_count, d.created_at, d.setter_name,
           d.parent_duel_id,
           row_number() over (order by d.created_at, d.id) as pos
    from duels d
    where d.thread_id = p_thread_id
  ),
  chain as (
    -- seeds: no parent, or a parent outside this thread (shouldn't happen,
    -- but a tampered p_thread_id mustn't make a row vanish from the list)
    select o.id, ((o.pos - 1) % 2)::int as depth
    from ordered o
    where o.parent_duel_id is null
       or not exists (select 1 from ordered p where p.id = o.parent_duel_id)
    union all
    select o.id, c.depth + 1
    from ordered o
    join chain c on o.parent_duel_id = c.id
  )
  select
    o.slug, o.status, o.guess_count, o.created_at,
    (case when c.depth % 2 = 0 then 1 else 2 end)::smallint,
    o.setter_name
  from ordered o
  join chain c on c.id = o.id
  order by o.created_at asc, o.id;
$$;

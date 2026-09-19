-- ---------------------------------------------------------------------------
-- Spectator view.
--
-- A third person opening a claimed duel link has, since 0007, hit a dead
-- end: get_duel_for_guesser returns `taken = true` and nulls everything
-- about the game. This adds a separate read path that shows a bystander
-- the *shape* of the game — colours, count, outcome — without the word, so
-- the link can go into a group chat as something to look at rather than a
-- wall. get_duel_for_guesser, submit_guess and the claiming rules are not
-- touched; a spectator still cannot guess.
--
-- Two additions, both to the read side:
--
--   1. get_duel_spectator(slug) — new. What the spectator screen renders.
--   2. get_duel_og(slug) gains guess_count, so the /d/* preview card can
--      say "solved in 3" for a finished duel instead of the generic card.
--
-- Migration hygiene as established in 0008: security definer functions pin
-- search_path, and since 0008 revoked the default execute grant on new
-- functions in `public`, every function here is callable by nobody until
-- explicitly granted to anon. Forgetting that grant would leave the
-- spectator view 500ing in production while working fine from the SQL
-- editor (which runs as postgres).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- get_duel_spectator — never returns secret_word, guessed strings, id,
-- thread_id or guesser_id. Zero rows for an unknown slug.
--
-- What comes back depends on status:
--
--   pending  — the hint banner and setter name only. `feedback`,
--              `word_length` and `hint` are null: a spectator doesn't watch
--              a live game over the claimer's shoulder, and four rows of
--              feedback would be a real head start on the same word.
--   won / lost / expired — `feedback` is the colours only, as an array of
--              arrays: each element of `guesses` is reduced to its
--              `feedback` list, dropping `guess` and `at`. Stripped here in
--              SQL rather than in the client because on a won duel the last
--              guessed string *is* the word, and the word must never reach
--              the browser in any form.
--
-- Empty-guesses edge: jsonb_agg over zero rows is null, and an expired duel
-- can have zero guesses, so coalesce to '[]' — the client tells "finished,
-- no rows" from "pending" by status, but a null feedback on a finished duel
-- would still be a surprise.
--
-- hide_era_band is returned as-is; the client hides the era name and skin
-- exactly as it does on the guesser and taken screens.
-- ---------------------------------------------------------------------------

create function public.get_duel_spectator(p_slug text)
returns table(
  era_band smallint, hide_era_band boolean, hint text, setter_name text,
  status duel_status, guess_count int, word_length int, feedback jsonb
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select
    d.era_band,
    d.hide_era_band,
    case when d.status = 'pending' then null else d.hint end,
    d.setter_name,
    d.status,
    case when d.status = 'pending' then null else d.guess_count::int end,
    case when d.status = 'pending' then null else char_length(d.secret_word) end,
    case
      when d.status = 'pending' then null
      else coalesce(
        (select jsonb_agg(g->'feedback' order by ord)
         from jsonb_array_elements(d.guesses) with ordinality as e(g, ord)),
        '[]'::jsonb
      )
    end
  from duels d
  where d.slug = p_slug;
$$;

revoke execute on function public.get_duel_spectator(text) from public, anon, authenticated;
grant  execute on function public.get_duel_spectator(text) to anon;

-- ---------------------------------------------------------------------------
-- get_duel_og — adds guess_count so the edge function can describe a
-- finished duel ("Cam's word — solved in 3 guesses"). Still no hint, still
-- no secret_word; guess_count on its own gives nothing away.
--
-- Adding an OUT column changes the return type, which `create or replace`
-- refuses, so this is a drop-and-recreate. Dropping loses the search_path
-- setting and the grant that 0008 applied, so both are re-applied below.
-- The only caller is netlify/edge-functions/og.js, which reads columns by
-- name and ignores ones it doesn't know — so the old and new edge function
-- both work against the new shape, and there's no client breakage window.
-- ---------------------------------------------------------------------------

drop function if exists public.get_duel_og(text);

create function public.get_duel_og(p_slug text)
returns table(
  setter_name text, era_band smallint, hide_era_band boolean, status duel_status,
  guess_count int
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select d.setter_name, d.era_band, d.hide_era_band, d.status, d.guess_count::int
  from duels d
  where d.slug = p_slug;
$$;

revoke execute on function public.get_duel_og(text) from public, anon, authenticated;
grant  execute on function public.get_duel_og(text) to anon;

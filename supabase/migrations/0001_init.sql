-- Netera Duel — initial schema
-- Design notes (see claude.md "Open decisions" + architecture chat log):
--   * secret_word must never reach the guesser's client directly, so all reads/writes
--     go through security-definer RPC functions rather than direct table access.
--   * the setter needs to check on their own duel (see the word they set, whether the
--     guesser has played) without exposing that same power to whoever holds the
--     shareable link — so a duel has TWO tokens: `slug` (shared, guess-only) and
--     `setter_token` (kept locally by the setter's browser, full read access).
--   * era band visibility is a per-duel setter choice (`hide_era_band`).
--   * unanswered duels get a soft expiry after 30 days — cosmetic status only,
--     the link keeps working regardless.
--   * duel creation is rate-limited per anonymous device id (20 free, more via
--     `bonus_duel_credits` once a monetisation path exists).

create extension if not exists pgcrypto;

create type duel_status as enum ('pending', 'won', 'lost', 'expired');

create table creators (
  id                  uuid primary key,                 -- generated client-side, stored in localStorage
  bonus_duel_credits  smallint not null default 0,
  created_at          timestamptz not null default now()
);

create table duels (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,                  -- shareable, guess-only access
  setter_token   uuid unique not null default gen_random_uuid(), -- setter-only access, never shared

  thread_id      uuid not null default gen_random_uuid(), -- shared across a setter/turn-back pair
  parent_duel_id uuid references duels(id),

  creator_id     uuid not null references creators(id),

  era_band       smallint not null check (era_band between 1 and 5),
  hide_era_band  boolean not null default false,

  secret_word    text not null,
  hint           text,
  setter_name    text,

  status         duel_status not null default 'pending',
  guesses        jsonb not null default '[]',            -- [{ guess, feedback: [...], at }]
  guess_count    smallint not null default 0,

  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create unique index duels_slug_idx on duels (slug);
create unique index duels_setter_token_idx on duels (setter_token);
create index duels_thread_idx on duels (thread_id);
create index duels_creator_idx on duels (creator_id);
create index duels_status_pending_idx on duels (status) where status = 'pending';
create index duels_created_at_idx on duels (created_at);

alter table creators enable row level security;
alter table duels enable row level security;
-- No policies granted to anon/authenticated: every read/write goes through the
-- security-definer functions below, which run with the table owner's privileges.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function generate_slug() returns text
language sql volatile as $$
  select lower(
    translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'xyz')
  );
$$;

create or replace function compute_feedback(p_secret text, p_guess text)
returns jsonb
language plpgsql immutable as $$
declare
  secret_chars text[] := regexp_split_to_array(lower(p_secret), '');
  guess_chars  text[] := regexp_split_to_array(lower(p_guess), '');
  len int := array_length(secret_chars, 1);
  feedback text[] := array_fill('grey'::text, array[len]);
  remaining text[] := secret_chars; -- letters not yet claimed by a green/yellow match
  i int;
  j int;
begin
  -- pass 1: greens
  for i in 1..len loop
    if guess_chars[i] = secret_chars[i] then
      feedback[i] := 'green';
      remaining[i] := null;
    end if;
  end loop;

  -- pass 2: yellows (consume one remaining occurrence per match)
  for i in 1..len loop
    if feedback[i] = 'grey' then
      for j in 1..len loop
        if remaining[j] is not null and remaining[j] = guess_chars[i] then
          feedback[i] := 'yellow';
          remaining[j] := null;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  return to_jsonb(feedback);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_duel — used both for the opening duel and every turn-back.
-- Enforces the 20-duels-per-device limit (raises 'duel_limit_reached').
-- ---------------------------------------------------------------------------

create or replace function create_duel(
  p_creator_id    uuid,
  p_era_band      smallint,
  p_secret_word   text,
  p_hint          text,
  p_hide_era_band boolean default false,
  p_setter_name   text default null,
  p_thread_id     uuid default null,
  p_parent_duel_id uuid default null
) returns table(slug text, setter_token uuid)
language plpgsql security definer as $$
declare
  v_free_limit constant smallint := 20;
  v_used int;
  v_bonus smallint;
  v_slug text;
  v_setter_token uuid := gen_random_uuid();
begin
  insert into creators (id) values (p_creator_id)
    on conflict (id) do nothing;

  select bonus_duel_credits into v_bonus from creators where id = p_creator_id;
  select count(*) into v_used from duels where creator_id = p_creator_id;

  if v_used >= v_free_limit + coalesce(v_bonus, 0) then
    raise exception 'duel_limit_reached' using errcode = 'P0001';
  end if;

  loop
    v_slug := generate_slug();
    exit when not exists (select 1 from duels where duels.slug = v_slug);
  end loop;

  insert into duels (
    slug, setter_token, thread_id, parent_duel_id, creator_id,
    era_band, hide_era_band, secret_word, hint, setter_name
  ) values (
    v_slug, v_setter_token, coalesce(p_thread_id, gen_random_uuid()), p_parent_duel_id, p_creator_id,
    p_era_band, p_hide_era_band, lower(p_secret_word), p_hint, p_setter_name
  );

  return query select v_slug, v_setter_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_duel_for_guesser — never returns secret_word.
-- ---------------------------------------------------------------------------

create or replace function get_duel_for_guesser(p_slug text)
returns table(
  slug text, era_band smallint, hide_era_band boolean, hint text, setter_name text,
  word_length int, status duel_status, guesses jsonb, guess_count int, thread_id uuid
)
language sql security definer stable as $$
  select
    d.slug, d.era_band, d.hide_era_band, d.hint, d.setter_name,
    char_length(d.secret_word), d.status, d.guesses, d.guess_count, d.thread_id
  from duels d
  where d.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- get_duel_for_setter — full detail, gated on the private setter_token.
-- ---------------------------------------------------------------------------

create or replace function get_duel_for_setter(p_setter_token uuid)
returns table(
  slug text, era_band smallint, hide_era_band boolean, secret_word text, hint text,
  status duel_status, guesses jsonb, guess_count int, thread_id uuid, created_at timestamptz
)
language sql security definer stable as $$
  select
    d.slug, d.era_band, d.hide_era_band, d.secret_word, d.hint,
    d.status, d.guesses, d.guess_count, d.thread_id, d.created_at
  from duels d
  where d.setter_token = p_setter_token;
$$;

-- ---------------------------------------------------------------------------
-- get_thread — status/guess-count summary of every duel in a thread, for the
-- head-to-head tally. Never exposes secret_word.
-- ---------------------------------------------------------------------------

create or replace function get_thread(p_thread_id uuid)
returns table(slug text, status duel_status, guess_count int, created_at timestamptz)
language sql security definer stable as $$
  select d.slug, d.status, d.guess_count, d.created_at
  from duels d
  where d.thread_id = p_thread_id
  order by d.created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- submit_guess — the only path that ever compares a guess to secret_word.
-- ---------------------------------------------------------------------------

create or replace function submit_guess(p_slug text, p_guess text)
returns table(feedback jsonb, status duel_status, guess_count int)
language plpgsql security definer as $$
declare
  v_duel duels%rowtype;
  v_feedback jsonb;
  v_new_status duel_status;
  v_max_guesses constant smallint := 6;
begin
  select * into v_duel from duels where duels.slug = p_slug for update;

  if not found then
    raise exception 'duel_not_found' using errcode = 'P0002';
  end if;

  if v_duel.status <> 'pending' then
    raise exception 'duel_already_finished' using errcode = 'P0003';
  end if;

  if char_length(p_guess) <> char_length(v_duel.secret_word) then
    raise exception 'wrong_length' using errcode = 'P0004';
  end if;

  v_feedback := compute_feedback(v_duel.secret_word, p_guess);

  if lower(p_guess) = v_duel.secret_word then
    v_new_status := 'won';
  elsif v_duel.guess_count + 1 >= v_max_guesses then
    v_new_status := 'lost';
  else
    v_new_status := 'pending';
  end if;

  update duels set
    guesses = v_duel.guesses || jsonb_build_object(
      'guess', lower(p_guess), 'feedback', v_feedback, 'at', now()
    ),
    guess_count = v_duel.guess_count + 1,
    status = v_new_status,
    completed_at = case when v_new_status <> 'pending' then now() else null end
  where duels.slug = p_slug;

  return query select v_feedback, v_new_status, v_duel.guess_count + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Soft expiry — cosmetic only, never blocks a link from being played.
-- Schedule with pg_cron, e.g.: select cron.schedule('expire-stale-duels',
-- '0 3 * * *', $$select expire_stale_duels()$$);
-- ---------------------------------------------------------------------------

create or replace function expire_stale_duels() returns void
language sql security definer as $$
  update duels set status = 'expired'
  where status = 'pending' and created_at < now() - interval '30 days';
$$;

-- ---------------------------------------------------------------------------
-- Grants — anon only ever calls functions, never touches the tables directly.
-- ---------------------------------------------------------------------------

revoke all on duels from anon, authenticated;
revoke all on creators from anon, authenticated;

grant execute on function create_duel to anon;
grant execute on function get_duel_for_guesser to anon;
grant execute on function get_duel_for_setter to anon;
grant execute on function get_thread to anon;
grant execute on function submit_guess to anon;

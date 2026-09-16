-- ---------------------------------------------------------------------------
-- Lock each duel to its first guesser.
--
-- Duels are one-to-one, but links get dropped into group chats. A row holds a
-- single guesses/status/guess_count, and submit_guess was keyed on the slug
-- alone, so everyone who opened a link shared one game: the second person saw
-- the first's guesses and carried on from there.
--
-- The first *submitted guess* now claims the duel by stamping the caller's
-- anonymous device id (the same localStorage creatorId used for create_duel)
-- into guesser_id. Merely opening the link claims nothing, so someone who
-- glances at it and never plays doesn't block the rest of the chat. Anyone
-- else — opening the link afterwards, or submitting a guess after someone
-- beat them to it — gets a `taken` flag / a `duel_taken` error and sees none
-- of the claimer's progress.
--
-- The claim happens inside submit_guess's existing `for update` row lock, in
-- the same transaction as the scoring, so two simultaneous first guesses
-- serialise: the second one sees the first's id and raises.
--
-- guesser_id is client-generated and not a secret. It stops shared play, it
-- doesn't prove identity: a private window or cleared storage is a new
-- device and will see the taken screen. Accepted for now.
--
-- Existing rows keep guesser_id null and become claimable by whoever guesses
-- next. There's no way to know who was playing them, so no backfill.
--
-- get_duel_for_setter, get_thread and get_duel_og are untouched: none of
-- them care who is guessing.
-- ---------------------------------------------------------------------------

alter table duels add column guesser_id uuid;

-- Both functions gain an input parameter, and get_duel_for_guesser gains an
-- OUT column, so neither can be create-or-replaced in place (see 0002/0005).
-- Dropping the old signatures also means nothing can call them by mistake.
drop function if exists submit_guess(text, text);
drop function if exists get_duel_for_guesser(text);

-- ---------------------------------------------------------------------------
-- get_duel_for_guesser — never returns secret_word. When the duel has been
-- claimed by a different device, `taken` is true and only what the taken
-- screen needs comes back (setter name, era for the skin); guesses, status,
-- hint, thread and id are all null so nothing about the claimer's game or
-- the thread it belongs to leaks.
-- ---------------------------------------------------------------------------

create function get_duel_for_guesser(p_slug text, p_guesser_id uuid)
returns table(
  slug text, era_band smallint, hide_era_band boolean, hint text, setter_name text,
  word_length int, status duel_status, guesses jsonb, guess_count int, thread_id uuid,
  id uuid, taken boolean
)
language sql security definer stable as $$
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
    d.is_taken
  from d;
$$;

-- ---------------------------------------------------------------------------
-- submit_guess — the only path that ever compares a guess to secret_word,
-- and now the only path that claims a duel.
-- ---------------------------------------------------------------------------

create function submit_guess(p_slug text, p_guess text, p_guesser_id uuid)
returns table(feedback jsonb, status duel_status, guess_count int)
language plpgsql security definer as $$
declare
  v_duel duels%rowtype;
  v_feedback jsonb;
  v_new_status duel_status;
  v_max_guesses constant smallint := 6;
begin
  -- Without an id there's nothing to claim with, and a null would otherwise
  -- leave the duel unclaimed after a scored guess.
  if p_guesser_id is null then
    raise exception 'guesser_id_required' using errcode = 'P0006';
  end if;

  select * into v_duel from duels where duels.slug = p_slug for update;

  if not found then
    raise exception 'duel_not_found' using errcode = 'P0002';
  end if;

  -- Checked before the finished check on purpose: a third party hitting a
  -- finished, claimed duel should learn only that it's taken, not that it's
  -- over.
  if v_duel.guesser_id is not null and v_duel.guesser_id <> p_guesser_id then
    raise exception 'duel_taken' using errcode = 'P0005';
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
    guesser_id = coalesce(v_duel.guesser_id, p_guesser_id),
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

-- Dropping the functions above also dropped their grants.
grant execute on function get_duel_for_guesser(text, uuid) to anon;
grant execute on function submit_guess(text, text, uuid) to anon;

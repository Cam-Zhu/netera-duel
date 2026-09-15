-- ---------------------------------------------------------------------------
-- Lift the 20-duels-per-device cap for the testing period (Sept–Oct 2026).
--
-- Monetisation isn't decided yet and no payment path exists, so the cap only
-- blocks the people doing the most testing. Re-issue create_duel with the
-- limit check removed. Everything the cap depended on is deliberately left in
-- place so it can be switched back on with a single migration once there's
-- usage data and a chosen model:
--   * the `creators` table and `bonus_duel_credits` column are untouched
--   * `creator_id` is still stamped on every duel, so per-device usage can be
--     measured now and any future cap can count the right rows
--   * the client still maps a 'duel_limit_reached' error to a friendly message
--
-- To reinstate: copy this function, restore the block marked "CAP" below.
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
  v_slug text;
  v_setter_token uuid := gen_random_uuid();
begin
  insert into creators (id) values (p_creator_id)
    on conflict (id) do nothing;

  -- CAP (disabled during testing):
  --   declare v_free_limit constant smallint := 20; v_used int; v_bonus smallint;
  --   select bonus_duel_credits into v_bonus from creators where id = p_creator_id;
  --   select count(*) into v_used from duels where creator_id = p_creator_id;
  --   if v_used >= v_free_limit + coalesce(v_bonus, 0) then
  --     raise exception 'duel_limit_reached' using errcode = 'P0001';
  --   end if;

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

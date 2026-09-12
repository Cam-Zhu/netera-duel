-- ---------------------------------------------------------------------------
-- get_duel_for_setter was missing setter_name, so the setter's own "Your
-- duel" page had no way to display the name they'd entered when creating
-- the link (hint was already returned, just never rendered — see ShareLink.jsx).
-- ---------------------------------------------------------------------------

-- Inserting a column into the middle of the return row changes the OUT
-- parameter signature, which create-or-replace refuses to do in place.
drop function if exists get_duel_for_setter(uuid);

create function get_duel_for_setter(p_setter_token uuid)
returns table(
  slug text, era_band smallint, hide_era_band boolean, secret_word text, hint text,
  setter_name text, status duel_status, guesses jsonb, guess_count int, thread_id uuid,
  created_at timestamptz
)
language sql security definer stable as $$
  select
    d.slug, d.era_band, d.hide_era_band, d.secret_word, d.hint,
    d.setter_name, d.status, d.guesses, d.guess_count, d.thread_id, d.created_at
  from duels d
  where d.setter_token = p_setter_token;
$$;

-- Dropping the function above also dropped its grant.
grant execute on function get_duel_for_setter to anon;

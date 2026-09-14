-- ---------------------------------------------------------------------------
-- get_duel_og — the read path for the /d/* Open Graph edge function
-- (netlify/edge-functions/og.js), which renders a per-duel preview card for
-- link-unfurling crawlers.
--
-- Deliberately separate from get_duel_for_guesser rather than reusing it:
--   * the edge function runs with the anon key on a public path that anyone
--     (including a crawler that isn't a real player) can hit, so it should be
--     able to read the absolute minimum — name, era, and whether the duel is
--     still open. Never secret_word, and never `hint` either: the hint is
--     content the guesser is meant to read *inside* the game, not something to
--     leak into a chat-app preview before they've opened the link.
--   * keeping the app's read path untouched means changing what a preview card
--     shows can never accidentally change what the game shows.
-- ---------------------------------------------------------------------------

create or replace function get_duel_og(p_slug text)
returns table(
  setter_name text, era_band smallint, hide_era_band boolean, status duel_status
)
language sql security definer stable as $$
  select d.setter_name, d.era_band, d.hide_era_band, d.status
  from duels d
  where d.slug = p_slug;
$$;

grant execute on function get_duel_og(text) to anon;

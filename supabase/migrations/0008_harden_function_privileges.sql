-- ---------------------------------------------------------------------------
-- Harden function privileges and pin search_path.
--
-- Two gaps left by 0001–0007:
--
--   1. Postgres grants EXECUTE on a new function to PUBLIC by default, and
--      Supabase's default privileges for the postgres role additionally grant
--      execute to anon / authenticated / service_role on functions created in
--      `public`. The migrations only ever *added* grants for the six
--      client-facing functions, so the helpers (generate_slug,
--      compute_feedback) and expire_stale_duels were most likely callable
--      from the browser with the anon key too. None of them leak
--      secret_word, but expire_stale_duels writes to every pending row and
--      nothing about that should be reachable from a public key.
--
--   2. No SECURITY DEFINER function set search_path. A definer function runs
--      with the owner's privileges but resolves unqualified names through
--      the *caller's* search_path, which is the textbook way to get one to
--      run something it didn't mean to. Supabase's database linter flags
--      this as function_search_path_mutable.
--
-- Everything here is `alter`, `revoke` and `grant` — no drop/recreate, so no
-- signature churn and no chance of losing a grant the client depends on.
-- Every statement is idempotent; the whole file can be re-run safely.
--
-- Why the helpers can be revoked from anon without breaking anything:
-- create_duel calls generate_slug() and submit_guess calls
-- compute_feedback() from *inside* a SECURITY DEFINER body, so those nested
-- calls are privilege-checked as the function owner (postgres), not as the
-- anon caller. The client never calls the helpers directly.
--
-- expire_stale_duels: if a pg_cron job exists for it (not confirmed at the
-- time of writing), cron runs the command as the role that scheduled it,
-- which is not anon — so revoking anon changes nothing for the job.
--
-- get_duel_og stays granted: the /d/* edge function calls it with the anon
-- key to build link previews.
--
-- search_path = public, extensions, pg_temp
--   * public      — the tables, the duel_status enum, and the helpers
--   * extensions  — pgcrypto's gen_random_bytes(), used by generate_slug().
--                   Supabase installs pgcrypto in `extensions`; if a project
--                   has it in `public` instead, `public` is already first in
--                   the path and a schema that doesn't exist is simply
--                   skipped, so this line is right either way.
--   * pg_temp     — listed last so a temp object can never shadow a real one
--                   (when pg_temp isn't listed, Postgres searches it FIRST).
--   gen_random_uuid() is core Postgres (pg_catalog), always found.
-- ---------------------------------------------------------------------------

-- 1. Pin search_path on every function in public.

alter function generate_slug()                                                  set search_path = public, extensions, pg_temp;
alter function compute_feedback(text, text)                                     set search_path = public, extensions, pg_temp;
alter function create_duel(uuid, smallint, text, text, boolean, text, uuid, uuid) set search_path = public, extensions, pg_temp;
alter function get_duel_for_guesser(text, uuid)                                 set search_path = public, extensions, pg_temp;
alter function get_duel_for_setter(uuid)                                        set search_path = public, extensions, pg_temp;
alter function get_thread(uuid)                                                 set search_path = public, extensions, pg_temp;
alter function get_duel_og(text)                                                set search_path = public, extensions, pg_temp;
alter function submit_guess(text, text, uuid)                                   set search_path = public, extensions, pg_temp;
alter function expire_stale_duels()                                             set search_path = public, extensions, pg_temp;

-- 2. Start from nothing: drop the implicit PUBLIC grant and Supabase's
--    default anon/authenticated grants on all nine.

revoke execute on function generate_slug()                                                  from public, anon, authenticated;
revoke execute on function compute_feedback(text, text)                                     from public, anon, authenticated;
revoke execute on function create_duel(uuid, smallint, text, text, boolean, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function get_duel_for_guesser(text, uuid)                                 from public, anon, authenticated;
revoke execute on function get_duel_for_setter(uuid)                                        from public, anon, authenticated;
revoke execute on function get_thread(uuid)                                                 from public, anon, authenticated;
revoke execute on function get_duel_og(text)                                                from public, anon, authenticated;
revoke execute on function submit_guess(text, text, uuid)                                   from public, anon, authenticated;
revoke execute on function expire_stale_duels()                                             from public, anon, authenticated;

-- 3. Grant back exactly what the client (and the OG edge function) call, to
--    anon only — the app has no auth, so `authenticated` never appears.

grant execute on function create_duel(uuid, smallint, text, text, boolean, text, uuid, uuid) to anon;
grant execute on function get_duel_for_guesser(text, uuid)                                 to anon;
grant execute on function get_duel_for_setter(uuid)                                        to anon;
grant execute on function get_thread(uuid)                                                 to anon;
grant execute on function get_duel_og(text)                                                to anon;
grant execute on function submit_guess(text, text, uuid)                                   to anon;

-- 4. Stop future functions being exposed by default. From here on, a new
--    function created by postgres in `public` is callable by nobody until a
--    migration grants it — which is already how every migration since 0001
--    has worked, so the only change is that forgetting the grant now fails
--    closed instead of open. service_role is left alone.
--
--    Applies to functions created by the role running this (postgres in the
--    SQL editor); existing functions are untouched by this statement, which
--    is why steps 2–3 above are still needed.

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

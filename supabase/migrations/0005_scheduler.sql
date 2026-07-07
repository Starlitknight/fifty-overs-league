-- ============================================================================
-- Fifty Overs — Phase 4 scheduler helpers for the resolver container.
-- The worker polls these to know what to lock/resolve now. Officials use a daily
-- cadence (resolve_at at the league match time); friendlies can kick off any
-- minute, so the same short-interval worker handles both.
-- ============================================================================

-- Accepted friendlies whose lock window (kickoff - 5min) has arrived.
create or replace function app.friendlies_to_lock()
returns setof app.challenges
language sql stable security definer set search_path = app, public as $$
  select * from app.challenges
   where status = 'accepted' and now() >= kickoff_at - interval '5 minutes'
   order by kickoff_at, id;
$$;

-- Locked friendlies whose kickoff has arrived (ready to resolve).
create or replace function app.friendlies_to_resolve()
returns setof app.challenges
language sql stable security definer set search_path = app, public as $$
  select * from app.challenges
   where status = 'locked' and now() >= kickoff_at
   order by kickoff_at, id;
$$;

grant execute on all functions in schema app to authenticated;

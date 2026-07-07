-- ============================================================================
-- Fifty Overs — Phase 3 friendly loop (server lock, resolve inputs, result store)
-- ============================================================================
-- Pipeline: issue → accept (Phase 2) → edit-until-lock → SERVER lock (here) →
-- resolver runs __resolveMatch → store result → client replays deterministically.
--
-- The resolver runs as a trusted service (Supabase service_role, which bypasses
-- RLS); lock_match_orders and store_friendly_result are the server-owned steps.
-- ============================================================================

-- Map an orders row to the engine order object the harness expects.
create or replace function app._orders_to_engine(o app.orders)
returns jsonb language sql immutable as $$
  select case when o.id is null then null else jsonb_build_object(
    'batOrder',   o.bat_order,
    'captain',    o.captain,
    'keeper',     o.keeper,
    'phaseIntent',o.phase_intent,
    'fieldPlan',  o.field_plan,
    'compiled',   o.compiled,
    'xi',         o.xi
  ) end;
$$;

-- The team's most-recent lineup (for no-show auto-fill).
create or replace function app._last_used_orders(p_team_id uuid)
returns app.orders language sql stable as $$
  select * from app.orders
   where team_id = p_team_id and last_used
   order by submitted_at desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- lock_match_orders — called by the scheduler at kickoff-5min. Locks each side's
-- orders; a no-show is auto-filled from its last-used lineup, else left as an
-- empty (locked) row so the engine picks a legal default XI. The match happens
-- regardless.
-- ---------------------------------------------------------------------------
create or replace function app.lock_match_orders(p_challenge_id uuid)
returns void
language plpgsql security definer set search_path = app, public as $$
declare
  v_ch app.challenges;
  v_team uuid;
  v_existing app.orders;
  v_last app.orders;
begin
  select * into v_ch from app.challenges where id = p_challenge_id for update;
  if v_ch.id is null then raise exception 'no such challenge' using errcode='42704'; end if;
  if v_ch.status not in ('accepted','locked') then
    raise exception 'challenge is % (not lockable)', v_ch.status using errcode='42501';
  end if;

  foreach v_team in array array[v_ch.from_team_id, v_ch.to_team_id] loop
    select * into v_existing from app.orders where team_id = v_team and challenge_id = p_challenge_id;
    if v_existing.id is not null then
      update app.orders set locked = true where id = v_existing.id;      -- edited in time
    else
      v_last := app._last_used_orders(v_team);
      if v_last.id is not null then
        insert into app.orders(league_id, team_id, challenge_id, bat_order, captain, keeper,
            phase_intent, field_plan, compiled, xi, last_used, locked, submitted_at)
          values (v_ch.league_id, v_team, p_challenge_id, v_last.bat_order, v_last.captain, v_last.keeper,
            v_last.phase_intent, v_last.field_plan, v_last.compiled, v_last.xi, false, true, now());
      else
        -- no lineup ever set: empty locked row -> engine auto-picks a legal XI
        insert into app.orders(league_id, team_id, challenge_id, last_used, locked, submitted_at)
          values (v_ch.league_id, v_team, p_challenge_id, false, true, now());
      end if;
    end if;
  end loop;

  update app.challenges set status = 'locked' where id = p_challenge_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- friendly_inputs — everything the resolver needs, assembled server-side. The
-- challenger (from_team) is home; conds carry the challenge's pitch/weather/seed.
-- ---------------------------------------------------------------------------
create or replace function app.friendly_inputs(p_challenge_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare
  v_ch app.challenges;
  v_home app.teams; v_away app.teams;
  v_home_roster jsonb; v_away_roster jsonb;
  v_home_orders app.orders; v_away_orders app.orders;
begin
  select * into v_ch from app.challenges where id = p_challenge_id;
  if v_ch.id is null then raise exception 'no such challenge' using errcode='42704'; end if;
  select * into v_home from app.teams where id = v_ch.from_team_id;
  select * into v_away from app.teams where id = v_ch.to_team_id;
  select roster into v_home_roster from app.squads where team_id = v_home.id;
  select roster into v_away_roster from app.squads where team_id = v_away.id;
  select * into v_home_orders from app.orders where team_id = v_home.id and challenge_id = p_challenge_id;
  select * into v_away_orders from app.orders where team_id = v_away.id and challenge_id = p_challenge_id;

  return jsonb_build_object(
    'home', jsonb_build_object('name', v_home.name, 'ground', v_home.ground, 'players', coalesce(v_home_roster,'[]'::jsonb)),
    'away', jsonb_build_object('name', v_away.name, 'ground', v_away.ground, 'players', coalesce(v_away_roster,'[]'::jsonb)),
    'homeOrders', app._orders_to_engine(v_home_orders),
    'awayOrders', app._orders_to_engine(v_away_orders),
    'conds', jsonb_build_object('pitch', v_ch.pitch, 'weather', v_ch.weather,
                                'seed', v_ch.seed, 'ground', v_home.ground, 'friendly', true)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- store_friendly_result — the resolver writes the deterministic outcome. winner
-- is stored as winner_team_id (mapped from the engine's winner NAME), never
-- string-parsed. Friendlies are consequence-free: no standings, no fatigue/exp.
-- ---------------------------------------------------------------------------
create or replace function app.store_friendly_result(
  p_challenge_id uuid, p_payload jsonb, p_build_hash text
) returns app.results
language plpgsql security definer set search_path = app, public as $$
declare
  v_ch app.challenges;
  v_home app.teams; v_away app.teams;
  v_winner uuid;
  v_name text := p_payload->>'winner_team';
  v_row app.results;
begin
  select * into v_ch from app.challenges where id = p_challenge_id for update;
  if v_ch.id is null then raise exception 'no such challenge' using errcode='42704'; end if;
  select * into v_home from app.teams where id = v_ch.from_team_id;
  select * into v_away from app.teams where id = v_ch.to_team_id;

  v_winner := case
    when v_name = v_home.name then v_home.id
    when v_name = v_away.name then v_away.id
    else null end;   -- tie or unknown -> null

  insert into app.results(league_id, fixture_id, challenge_id, comp, home_team_id, away_team_id,
      winner_team_id, result_text, home_runs, home_balls, away_runs, away_balls,
      scorecard, worm, log, seed, pitch, weather, build_hash)
    values (v_ch.league_id, null, p_challenge_id, 'friendly', v_home.id, v_away.id,
      v_winner, p_payload->>'result_text',
      (p_payload->>'home_runs')::int, (p_payload->>'home_balls')::int,
      (p_payload->>'away_runs')::int, (p_payload->>'away_balls')::int,
      p_payload->'scorecard', p_payload->'worm', p_payload->'log',
      (p_payload->>'seed')::bigint, p_payload->>'pitch', v_ch.weather, p_build_hash)
    returning * into v_row;

  update app.challenges set status = 'resolved' where id = p_challenge_id;
  return v_row;
end;
$$;

-- Expire an unaccepted challenge whose kickoff has passed.
create or replace function app.expire_stale_challenges()
returns int language plpgsql security definer set search_path = app, public as $$
declare n int;
begin
  update app.challenges set status = 'expired'
   where status = 'pending' and kickoff_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema app to authenticated;

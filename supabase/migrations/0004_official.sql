-- ============================================================================
-- Fifty Overs — Phase 4 official league (fixtures, resolve, consequences, locks)
-- ============================================================================
-- The double round-robin is generated app-side (schedule.js) and persisted here.
-- The resolver container claims a due fixture (team-lock), runs __resolveMatch,
-- and stores the result WITH per-player consequences applied to the server-owned
-- squads — official matches only. Friendlies never touch squad state.
-- ============================================================================

-- Founder-only: bulk-insert a generated double round-robin. Idempotent per season
-- (clears prior scheduled fixtures for the season first).
create or replace function app.write_fixtures(
  p_league_id uuid, p_season_no int, p_fixtures jsonb, p_default_ground text default 'Neutral Ground'
) returns int
language plpgsql security definer set search_path = app, public as $$
declare n int;
begin
  perform app.require_founder(p_league_id);
  delete from app.fixtures
   where league_id = p_league_id and season_no = p_season_no and status = 'scheduled';

  insert into app.fixtures(league_id, season_no, round, home_team_id, away_team_id,
      ground, pitch, weather, seed, resolve_at, status)
  select p_league_id, p_season_no, (f->>'round')::int,
         (f->>'home_team_id')::uuid, (f->>'away_team_id')::uuid,
         coalesce(ht.ground, p_default_ground),
         coalesce(ht.home_pitch, 'balanced'),
         -- deterministic weather from the seed, mirroring the game's WXLIST index
         (array['Sunny','Overcast','Chilly','Humid','Misty','Windy'])[1 + (((f->>'seed')::bigint % 6))::int],
         (f->>'seed')::bigint, (f->>'resolve_at')::timestamptz, 'scheduled'
  from jsonb_array_elements(p_fixtures) f
  left join app.teams ht on ht.id = (f->>'home_team_id')::uuid;
  get diagnostics n = row_count;

  update app.leagues set status = 'active' where id = p_league_id;
  return n;
end;
$$;

-- Inputs for the resolver (mirror of friendly_inputs, for an official fixture).
create or replace function app.fixture_inputs(p_fixture_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare
  v_fx app.fixtures; v_home app.teams; v_away app.teams;
  v_hr jsonb; v_ar jsonb; v_ho app.orders; v_ao app.orders;
begin
  select * into v_fx from app.fixtures where id = p_fixture_id;
  if v_fx.id is null then raise exception 'no such fixture' using errcode='42704'; end if;
  select * into v_home from app.teams where id = v_fx.home_team_id;
  select * into v_away from app.teams where id = v_fx.away_team_id;
  select roster into v_hr from app.squads where team_id = v_home.id;
  select roster into v_ar from app.squads where team_id = v_away.id;
  select * into v_ho from app.orders where team_id = v_home.id and fixture_id = p_fixture_id;
  select * into v_ao from app.orders where team_id = v_away.id and fixture_id = p_fixture_id;
  return jsonb_build_object(
    'home', jsonb_build_object('name', v_home.name, 'ground', v_home.ground, 'players', coalesce(v_hr,'[]'::jsonb)),
    'away', jsonb_build_object('name', v_away.name, 'ground', v_away.ground, 'players', coalesce(v_ar,'[]'::jsonb)),
    'homeOrders', app._orders_to_engine(v_ho),
    'awayOrders', app._orders_to_engine(v_ao),
    'conds', jsonb_build_object('pitch', v_fx.pitch, 'weather', v_fx.weather,
                                'seed', v_fx.seed, 'ground', v_home.ground, 'friendly', false)
  );
end;
$$;

-- Lock official orders (kickoff = resolve_at) with no-show auto-fill.
create or replace function app.lock_fixture_orders(p_fixture_id uuid)
returns void
language plpgsql security definer set search_path = app, public as $$
declare
  v_fx app.fixtures; v_team uuid; v_existing app.orders; v_last app.orders;
begin
  select * into v_fx from app.fixtures where id = p_fixture_id for update;
  if v_fx.id is null then raise exception 'no such fixture' using errcode='42704'; end if;

  foreach v_team in array array[v_fx.home_team_id, v_fx.away_team_id] loop
    select * into v_existing from app.orders where team_id = v_team and fixture_id = p_fixture_id;
    if v_existing.id is not null then
      update app.orders set locked = true where id = v_existing.id;
    else
      v_last := app._last_used_orders(v_team);
      if v_last.id is not null then
        insert into app.orders(league_id, team_id, fixture_id, bat_order, captain, keeper,
            phase_intent, field_plan, compiled, xi, last_used, locked, submitted_at)
          values (v_fx.league_id, v_team, p_fixture_id, v_last.bat_order, v_last.captain, v_last.keeper,
            v_last.phase_intent, v_last.field_plan, v_last.compiled, v_last.xi, false, true, now());
      else
        insert into app.orders(league_id, team_id, fixture_id, last_used, locked, submitted_at)
          values (v_fx.league_id, v_team, p_fixture_id, false, true, now());
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Team-locking: claim a due fixture for resolution. Refuses if either team is
-- already mid-resolution ('locked') in another fixture — no team resolves two
-- matches at once. Also locks the lineups (kickoff reached).
-- ---------------------------------------------------------------------------
create or replace function app.begin_resolve(p_fixture_id uuid)
returns app.fixtures
language plpgsql security definer set search_path = app, public as $$
declare v_fx app.fixtures;
begin
  select * into v_fx from app.fixtures where id = p_fixture_id for update;
  if v_fx.id is null then raise exception 'no such fixture' using errcode='42704'; end if;
  if v_fx.status <> 'scheduled' then
    raise exception 'fixture is % (not claimable)', v_fx.status using errcode='42501';
  end if;
  if v_fx.resolve_at > now() then
    raise exception 'fixture not due yet (resolve_at %)', v_fx.resolve_at using errcode='42501';
  end if;
  if exists (
    select 1 from app.fixtures f2
     where f2.id <> v_fx.id and f2.status = 'locked'
       and (f2.home_team_id in (v_fx.home_team_id, v_fx.away_team_id)
         or f2.away_team_id in (v_fx.home_team_id, v_fx.away_team_id))
  ) then
    raise exception 'a team is already resolving another fixture' using errcode='42501';
  end if;

  perform app.lock_fixture_orders(p_fixture_id);
  update app.fixtures set status = 'locked' where id = v_fx.id returning * into v_fx;
  return v_fx;
end;
$$;

-- Apply per-player consequences to a roster (override fatigue/form for named players).
create or replace function app._apply_consequences(roster jsonb, cons jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(
    case when cons ? (e->>'name') then
      e || jsonb_build_object(
        'fatigue',  cons->(e->>'name')->>'fatigue',
        'formIx',  (cons->(e->>'name')->>'formIx')::int,
        'formWord', cons->(e->>'name')->>'formWord')
    else e end
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(roster,'[]'::jsonb)) e;
$$;

-- ---------------------------------------------------------------------------
-- store_official_result — writes the league result (winner_team_id), marks the
-- fixture resolved, and APPLIES CONSEQUENCES to both squads (official only).
-- ---------------------------------------------------------------------------
create or replace function app.store_official_result(
  p_fixture_id uuid, p_payload jsonb, p_build_hash text
) returns app.results
language plpgsql security definer set search_path = app, public as $$
declare
  v_fx app.fixtures; v_home app.teams; v_away app.teams;
  v_name text := p_payload->>'winner_team';
  v_winner uuid; v_cons jsonb := coalesce(p_payload->'consequences','{}'::jsonb);
  v_row app.results;
begin
  select * into v_fx from app.fixtures where id = p_fixture_id for update;
  if v_fx.id is null then raise exception 'no such fixture' using errcode='42704'; end if;
  if v_fx.status = 'resolved' then raise exception 'fixture already resolved' using errcode='42501'; end if;
  select * into v_home from app.teams where id = v_fx.home_team_id;
  select * into v_away from app.teams where id = v_fx.away_team_id;

  v_winner := case when v_name = v_home.name then v_home.id
                   when v_name = v_away.name then v_away.id else null end;

  insert into app.results(league_id, fixture_id, challenge_id, comp, home_team_id, away_team_id,
      winner_team_id, result_text, home_runs, home_balls, away_runs, away_balls,
      scorecard, worm, log, seed, pitch, weather, build_hash)
    values (v_fx.league_id, p_fixture_id, null, 'league', v_home.id, v_away.id,
      v_winner, p_payload->>'result_text',
      (p_payload->>'home_runs')::int, (p_payload->>'home_balls')::int,
      (p_payload->>'away_runs')::int, (p_payload->>'away_balls')::int,
      p_payload->'scorecard', p_payload->'worm', p_payload->'log',
      v_fx.seed, v_fx.pitch, v_fx.weather, p_build_hash)
    returning * into v_row;

  -- CONSEQUENCES (official only): persist form + fatigue onto the server-owned squads
  update app.squads set roster = app._apply_consequences(roster, v_cons), updated_at = now()
   where team_id = v_home.id;
  update app.squads set roster = app._apply_consequences(roster, v_cons), updated_at = now()
   where team_id = v_away.id;

  update app.fixtures set status = 'resolved' where id = p_fixture_id;
  return v_row;
end;
$$;

-- Due, unresolved fixtures (for the resolver container's polling loop).
create or replace function app.due_fixtures()
returns setof app.fixtures
language sql stable security definer set search_path = app, public as $$
  select * from app.fixtures
   where status = 'scheduled' and resolve_at <= now()
   order by resolve_at, seed, id;   -- seed tiebreak => deterministic processing order
$$;

grant execute on all functions in schema app to authenticated;

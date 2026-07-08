-- ============================================================================
-- Fifty Overs — admin (commissioner) controls. The founder runs the league;
-- players (including the founder via a separate account) join and play. The
-- season can only start once every team has drafted.
-- ============================================================================

-- Readiness snapshot for the admin panel + start-season gate.
create or replace function app.league_readiness(p_league_id uuid)
returns json language sql stable security definer set search_path = app, public as $$
  select json_build_object(
    'teams',    count(*),
    'drafted',  count(*) filter (where s.confirmed),
    'all_ready', count(*) >= 2 and count(*) = count(*) filter (where s.confirmed)
  )
  from app.teams t
  left join app.squads s on s.team_id = t.id
  where t.league_id = p_league_id;
$$;

-- Start the season: founder-only, and ONLY when every team has drafted. Writes
-- the fixtures (double round-robin computed client-side, passed in).
create or replace function app.founder_start_season(
  p_league_id uuid, p_fixtures jsonb, p_start_date date default current_date
) returns int
language plpgsql security definer set search_path = app, public as $$
declare v_teams int; v_ready int; v_season int; n int;
begin
  perform app.require_founder(p_league_id);
  select count(*), count(*) filter (where s.confirmed) into v_teams, v_ready
    from app.teams t left join app.squads s on s.team_id = t.id
   where t.league_id = p_league_id;
  if v_teams < 2 then raise exception 'need at least 2 teams to start' using errcode='42501'; end if;
  if v_ready < v_teams then
    raise exception 'not everyone has drafted yet (% of % ready)', v_ready, v_teams using errcode='42501';
  end if;
  select season_no into v_season from app.leagues where id = p_league_id;
  n := app.write_fixtures(p_league_id, v_season, p_fixtures, p_start_date);
  return n;
end;
$$;

-- Reset the clock: clear all not-yet-resolved fixtures so the admin can
-- regenerate the schedule (e.g. after everyone joins, or to change the date).
create or replace function app.founder_reset_schedule(p_league_id uuid)
returns int language plpgsql security definer set search_path = app, public as $$
declare n int; begin
  perform app.require_founder(p_league_id);
  delete from app.fixtures where league_id = p_league_id and status <> 'resolved';
  get diagnostics n = row_count; return n;
end;
$$;

-- Full wipe back to pre-season: clears all matches/results/challenges/orders and
-- removes any 'Demo Rivals' demo opponent. Squads/teams of real managers stay.
create or replace function app.founder_reset_league(p_league_id uuid)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  perform app.require_founder(p_league_id);
  delete from app.results    where league_id = p_league_id;
  delete from app.orders     where league_id = p_league_id;
  delete from app.challenges where league_id = p_league_id;
  delete from app.fixtures   where league_id = p_league_id;
  update app.leagues set status = 'setup' where id = p_league_id;
  -- remove demo opponent(s): deleting the member cascades team + squad
  delete from app.members
   where id in (select manager_id from app.teams where league_id = p_league_id and name = 'Demo Rivals');
end;
$$;

-- Founder becomes admin-only: remove their own playing team (if it has no results).
create or replace function app.founder_remove_own_team(p_league_id uuid)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.require_founder(p_league_id); v_team uuid;
begin
  select id into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  if v_team is null then return; end if;
  if exists (select 1 from app.results where league_id = p_league_id and (home_team_id = v_team or away_team_id = v_team)) then
    raise exception 'cannot remove a team that already has results' using errcode='42501';
  end if;
  delete from app.fixtures where league_id = p_league_id and (home_team_id = v_team or away_team_id = v_team) and status <> 'resolved';
  delete from app.teams where id = v_team;   -- cascades squad + orders
end;
$$;

grant execute on all functions in schema app to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant execute on all functions in schema app to service_role';
  end if;
end $$;

-- ============================================================================
-- Fifty Overs — Phase 5 founder tools + read views for the client dashboard.
-- ============================================================================

-- Founder: void a fixture (it will not be resolved). e.g. dispute / withdrawal.
create or replace function app.founder_void_fixture(p_league_id uuid, p_fixture_id uuid)
returns app.fixtures
language plpgsql security definer set search_path = app, public as $$
declare v_fx app.fixtures;
begin
  perform app.require_founder(p_league_id);
  update app.fixtures set status = 'void'
   where id = p_fixture_id and league_id = p_league_id and status <> 'resolved'
   returning * into v_fx;
  if v_fx.id is null then raise exception 'fixture not found or already resolved' using errcode='42704'; end if;
  return v_fx;
end;
$$;

-- Founder: reschedule a not-yet-resolved fixture's kickoff.
create or replace function app.founder_reschedule_fixture(
  p_league_id uuid, p_fixture_id uuid, p_resolve_at timestamptz
) returns app.fixtures
language plpgsql security definer set search_path = app, public as $$
declare v_fx app.fixtures;
begin
  perform app.require_founder(p_league_id);
  update app.fixtures set resolve_at = p_resolve_at
   where id = p_fixture_id and league_id = p_league_id and status = 'scheduled'
   returning * into v_fx;
  if v_fx.id is null then raise exception 'fixture not found or not scheduled' using errcode='42704'; end if;
  return v_fx;
end;
$$;

-- Ordered league table (RLS-scoped to members via the standings view / teams).
create or replace function app.league_table(p_league_id uuid)
returns table(pos int, team_id uuid, team_name text, p int, w int, l int, t int, pts int, nrr numeric)
language sql stable security definer set search_path = app, public as $$
  with base as (
    select s.team_id, s.team_name,
           s.p::int, s.w::int, s.l::int, s.t::int, s.pts::int, s.nrr
    from app.standings s
    where s.league_id = p_league_id
    union all
    -- teams with no results yet still appear (zeros)
    select t.id, t.name, 0,0,0,0,0, 0::numeric
    from app.teams t
    where t.league_id = p_league_id
      and not exists (select 1 from app.standings s2 where s2.team_id = t.id)
  )
  select (row_number() over (order by pts desc, nrr desc, team_name))::int as pos,
         team_id, team_name, p, w, l, t, pts, nrr
  from base
  order by pts desc, nrr desc, team_name;
$$;

grant execute on all functions in schema app to authenticated;

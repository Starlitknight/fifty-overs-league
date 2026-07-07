-- ============================================================================
-- Fifty Overs — Phase 5+ follow-ups: timezone-correct fixtures + season rollover.
-- ============================================================================

-- Replace write_fixtures with a timezone-aware version: resolve_at is computed
-- HERE (server-owned) as the league match_time on start_date + (round-1) days,
-- interpreted in the league's tz. schedule.js no longer carries resolve_at.
-- Drop the prior 0004 signature so the new one isn't merely an overload.
drop function if exists app.write_fixtures(uuid, int, jsonb, text);
create or replace function app.write_fixtures(
  p_league_id uuid, p_season_no int, p_fixtures jsonb,
  p_start_date date default current_date, p_default_ground text default 'Neutral Ground'
) returns int
language plpgsql security definer set search_path = app, public as $$
declare n int; v_match_time time; v_tz text;
begin
  perform app.require_founder(p_league_id);
  select match_time, tz into v_match_time, v_tz from app.leagues where id = p_league_id;

  delete from app.fixtures
   where league_id = p_league_id and season_no = p_season_no and status = 'scheduled';

  insert into app.fixtures(league_id, season_no, round, home_team_id, away_team_id,
      ground, pitch, weather, seed, resolve_at, status)
  select p_league_id, p_season_no, (f->>'round')::int,
         (f->>'home_team_id')::uuid, (f->>'away_team_id')::uuid,
         coalesce(ht.ground, p_default_ground),
         coalesce(ht.home_pitch, 'balanced'),
         (array['Sunny','Overcast','Chilly','Humid','Misty','Windy'])[1 + (((f->>'seed')::bigint % 6))::int],
         (f->>'seed')::bigint,
         -- wall-clock (start_date + round offset at match_time) interpreted in the league tz
         ((p_start_date + ((f->>'round')::int - 1)) + v_match_time) at time zone v_tz,
         'scheduled'
  from jsonb_array_elements(p_fixtures) f
  left join app.teams ht on ht.id = (f->>'home_team_id')::uuid;
  get diagnostics n = row_count;

  update app.leagues set status = 'active' where id = p_league_id;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Season rollover. Aging (age++, 31+ decline, retirement) is computed by the
-- engine's exact model in the resolver (window.__ageSquad) and passed in here as
-- p_aged = [{ team_id, roster:[...] }]; this persists the aged rosters and bumps
-- the season. Squads persist across seasons (no re-draft) — only their players
-- age. Founder-gated.
-- ---------------------------------------------------------------------------
create or replace function app.founder_advance_season(p_league_id uuid, p_aged jsonb)
returns int
language plpgsql security definer set search_path = app, public as $$
declare v int;
begin
  perform app.require_founder(p_league_id);

  update app.squads s
     set roster = (a->'roster'), updated_at = now()
  from jsonb_array_elements(p_aged) a
  where s.team_id = (a->>'team_id')::uuid and s.league_id = p_league_id;
  get diagnostics v = row_count;

  update app.leagues
     set season_no = season_no + 1, status = 'setup'
   where id = p_league_id;
  return v;
end;
$$;

grant execute on all functions in schema app to authenticated;

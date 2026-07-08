-- ============================================================================
-- Fifty Overs — in-game draft: each manager creates a team (name + manager name
-- + home country), drafts their own balanced, country-flavoured, unique pool in
-- the game's draft screen, and "Start Season" saves that squad as their league
-- team. The pool is generated client-side from a server-issued draft_seed (unique
-- per team), so it is reproducible/verifiable and balanced by construction.
-- ============================================================================

alter table app.teams add column if not exists country text;
alter table app.teams add column if not exists draft_seed int;

-- Create/label the caller's team: sets team name, home country, manager display
-- name, and a stable unique draft_seed derived from the team id.
create or replace function app.create_league_team(
  p_league_id uuid, p_team_name text, p_manager_name text, p_country text
) returns app.teams
language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id); v_team app.teams; v_seed int;
begin
  update app.members set display_name = p_manager_name where id = v_mid;
  select * into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  if v_team.id is null then
    insert into app.teams(league_id, manager_id, name) values (p_league_id, v_mid, p_team_name)
      returning * into v_team;
  end if;
  -- stable, unique, positive 28-bit seed from the team id
  v_seed := ('x' || substr(md5(v_team.id::text), 1, 7))::bit(28)::int;
  update app.teams
     set name = p_team_name, country = p_country, draft_seed = v_seed
   where id = v_team.id returning * into v_team;
  return v_team;
end;
$$;

-- Save the drafted squad ("Start Season"). Validates the game's legal-squad rule
-- (>=11, a keeper, >=5 bowling options, within budget) from the submitted roster
-- and writes the server-owned squad. (Pool-membership integrity can be verified
-- later by the resolver, which regenerates the pool from team.draft_seed+country.)
create or replace function app.submit_league_squad(p_league_id uuid, p_roster jsonb)
returns app.squads
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_team app.teams; v_squad app.squads; v_budget bigint; r record; reasons text[] := '{}';
begin
  select * into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  if v_team.id is null then raise exception 'no team' using errcode='42704'; end if;
  select draft_budget into v_budget from app.leagues where id = p_league_id;
  select * into r from app._roster_counts(p_roster);

  if r.n < 11 then reasons := array_append(reasons, (r.n || '/11 players')::text); end if;
  if r.wk < 1 then reasons := array_append(reasons, 'no wicketkeeper'::text); end if;
  if r.bowl_options < 5 then reasons := array_append(reasons, (r.bowl_options || '/5 bowling options')::text); end if;
  if r.fee_sum > v_budget then reasons := array_append(reasons, 'over budget'::text); end if;
  if array_length(reasons, 1) is not null then
    raise exception 'illegal squad: %', array_to_string(reasons, ', ') using errcode='42501';
  end if;

  insert into app.squads(team_id, league_id, roster, budget_spent, confirmed)
    values (v_team.id, p_league_id, p_roster, r.fee_sum, true)
  on conflict (team_id) do update
    set roster = excluded.roster, budget_spent = excluded.budget_spent, confirmed = true, updated_at = now()
  returning * into v_squad;
  return v_squad;
end;
$$;

grant execute on all functions in schema app to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant execute on all functions in schema app to service_role';
  end if;
end $$;

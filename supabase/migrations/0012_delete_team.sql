-- ============================================================================
-- Fifty Overs — commissioner power: fully delete ANY team in the league. Unlike
-- founder_remove_own_team (own team, blocked if it has results), this removes any
-- team outright, including its drafted club and order packets. Founder-only.
-- ============================================================================

create or replace function app.founder_delete_team(p_league_id uuid, p_team_id uuid)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.require_founder(p_league_id); v_owner uuid;
begin
  select manager_id into v_owner from app.teams where id = p_team_id and league_id = p_league_id;
  if v_owner is null then raise exception 'no such team in this league' using errcode='42704'; end if;
  -- results.winner_team_id has no ON DELETE CASCADE: clear references first
  update app.results set winner_team_id = null where winner_team_id = p_team_id;
  -- the league-sync tables are keyed by manager, not team: clear the owner's rows
  delete from app.league_packets where league_id = p_league_id and manager_id = v_owner;
  delete from app.league_clubs   where league_id = p_league_id and manager_id = v_owner;
  -- squad, orders, fixtures, results, challenges all cascade on the team delete
  delete from app.teams where id = p_team_id;
end $$;

grant execute on all functions in schema app to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant execute on all functions in schema app to service_role';
  end if;
end $$;

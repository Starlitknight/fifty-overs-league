-- ============================================================================
-- Fifty Overs — Phase 2 constrained-action API
-- ============================================================================
-- Every function is SECURITY DEFINER and authorizes the caller via the identity
-- seam (app.resolve_manager_id / app.require_founder). Clients submit only these
-- validated actions; they never write roster/results/lock state directly.
--
-- The two load-bearing validations (tested):
--   * sign_player  — player must be in THIS manager's dealt pool AND within budget
--   * submit_orders— rejected once server time (now()) is past the match lock
-- ============================================================================

-- Player lookup helpers over a jsonb array of engine player objects ----------
-- Each player object carries engine-consistent fields: name, fee, wage, rating,
-- keeper (bool), bowlTypeFull ('none' = does not bowl), skills, ...
create or replace function app._player_in(arr jsonb, p_name text)
returns jsonb language sql immutable as $$
  select e from jsonb_array_elements(arr) e where e->>'name' = p_name limit 1;
$$;

create or replace function app._roster_counts(roster jsonb)
returns table(n int, wk int, bowl_options int, fee_sum bigint)
language sql immutable as $$
  select
    count(*)::int,
    count(*) filter (where coalesce((e->>'keeper')::boolean, false))::int,
    count(*) filter (where coalesce(e->>'bowlTypeFull','none') <> 'none')::int,
    coalesce(sum((e->>'fee')::bigint), 0)
  from jsonb_array_elements(coalesce(roster,'[]'::jsonb)) e;
$$;

-- Ensure a squad row exists for a team; returns it.
create or replace function app._ensure_squad(p_team_id uuid, p_league_id uuid)
returns app.squads language plpgsql as $$
declare s app.squads;
begin
  select * into s from app.squads where team_id = p_team_id;
  if s.id is null then
    insert into app.squads(team_id, league_id) values (p_team_id, p_league_id) returning * into s;
  end if;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_team — set the caller's club identity (team row exists from redeem).
-- ---------------------------------------------------------------------------
create or replace function app.create_team(
  p_league_id uuid, p_name text, p_ground text default 'Neutral Ground',
  p_home_pitch text default 'balanced'
) returns app.teams
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_team app.teams;
begin
  update app.teams
     set name = p_name, ground = p_ground, home_pitch = p_home_pitch
   where league_id = p_league_id and manager_id = v_mid
   returning * into v_team;
  if v_team.id is null then
    insert into app.teams(league_id, manager_id, name, ground, home_pitch)
      values (p_league_id, v_mid, p_name, p_ground, p_home_pitch) returning * into v_team;
  end if;
  return v_team;
end;
$$;

-- ---------------------------------------------------------------------------
-- Draft: lock the manager count, then snake-dealt buckets are written per manager.
-- Player generation is done by the real engine (genDraftPool) off-DB; the deal
-- (partition) is app-side; persistence + the sign-from-pool check live here.
-- ---------------------------------------------------------------------------

-- Founder-only: freeze the roster count. Returns manager_ids in a stable order
-- (creation order) so the off-DB snake-deal maps bucket i -> this[i].
create or replace function app.lock_managers(p_league_id uuid)
returns setof uuid
language plpgsql security definer set search_path = app, public as $$
declare v_founder uuid := app.require_founder(p_league_id);
begin
  update app.leagues
     set managers_locked = true,
         manager_cap = (select count(*) from app.members where league_id = p_league_id),
         status = 'drafting'
   where id = p_league_id;
  return query
    select id from app.members where league_id = p_league_id order by created_at, id;
end;
$$;

-- Founder-only: write one manager's private draft bucket (idempotent upsert).
create or replace function app.write_draft_pool(
  p_league_id uuid, p_manager_id uuid, p_players jsonb
) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  perform app.require_founder(p_league_id);
  insert into app.draft_pools(league_id, manager_id, players)
    values (p_league_id, p_manager_id, p_players)
  on conflict (league_id, manager_id) do update set players = excluded.players;
end;
$$;

-- ---------------------------------------------------------------------------
-- sign_player — LOAD-BEARING: player must be in the caller's dealt pool and the
-- signing must not exceed the league draft budget. Rejects re-signing and edits
-- after the squad is confirmed.
-- ---------------------------------------------------------------------------
create or replace function app.sign_player(p_league_id uuid, p_name text)
returns app.squads
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_team app.teams;
  v_squad app.squads;
  v_pool jsonb;
  v_player jsonb;
  v_budget bigint;
  v_fee bigint;
begin
  select * into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  if v_team.id is null then raise exception 'no team' using errcode='42704'; end if;

  v_squad := app._ensure_squad(v_team.id, p_league_id);
  if v_squad.confirmed then
    raise exception 'squad already confirmed — drop is disabled' using errcode='42501';
  end if;

  select players into v_pool from app.draft_pools
   where league_id = p_league_id and manager_id = v_mid;

  -- (1) must be in THIS manager's pool
  v_player := app._player_in(coalesce(v_pool,'[]'::jsonb), p_name);
  if v_player is null then
    raise exception 'player % is not in your draft pool', p_name using errcode='42501';
  end if;

  -- already signed?
  if app._player_in(v_squad.roster, p_name) is not null then
    raise exception 'player % already signed', p_name using errcode='23505';
  end if;

  -- (2) budget
  select draft_budget into v_budget from app.leagues where id = p_league_id;
  v_fee := (v_player->>'fee')::bigint;
  if v_squad.budget_spent + v_fee > v_budget then
    raise exception 'over budget: % + % > %', v_squad.budget_spent, v_fee, v_budget using errcode='42501';
  end if;

  update app.squads
     set roster = roster || jsonb_build_array(v_player),
         budget_spent = budget_spent + v_fee,
         updated_at = now()
   where id = v_squad.id
   returning * into v_squad;
  return v_squad;
end;
$$;

-- drop_player — inverse of sign; only before confirmation.
create or replace function app.drop_player(p_league_id uuid, p_name text)
returns app.squads
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_team app.teams;
  v_squad app.squads;
  v_player jsonb;
begin
  select * into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  v_squad := app._ensure_squad(v_team.id, p_league_id);
  if v_squad.confirmed then
    raise exception 'squad already confirmed' using errcode='42501';
  end if;
  v_player := app._player_in(v_squad.roster, p_name);
  if v_player is null then
    raise exception 'player % not on roster', p_name using errcode='42704';
  end if;
  update app.squads
     set roster = (select coalesce(jsonb_agg(e),'[]'::jsonb)
                     from jsonb_array_elements(roster) e where e->>'name' <> p_name),
         budget_spent = greatest(0, budget_spent - (v_player->>'fee')::bigint),
         updated_at = now()
   where id = v_squad.id
   returning * into v_squad;
  return v_squad;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_squad — reuse the game's legal-squad rule (v11.6, live definition):
--   ready = picked>=11 AND keepers>=1 AND bowlOptions>=5 AND budget_left>=0
-- Raises with the same reasons the game surfaces; else marks confirmed.
-- ---------------------------------------------------------------------------
create or replace function app.confirm_squad(p_league_id uuid)
returns app.squads
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_team app.teams;
  v_squad app.squads;
  v_budget bigint;
  r record;
  reasons text[] := '{}';
begin
  select * into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  v_squad := app._ensure_squad(v_team.id, p_league_id);
  select draft_budget into v_budget from app.leagues where id = p_league_id;
  select * into r from app._roster_counts(v_squad.roster);

  -- append reasons via array_append with explicitly text-typed values; a bare
  -- string literal (unknown type) would be mis-parsed as a text[] literal.
  if r.n < 11 then reasons := array_append(reasons, (r.n || '/11 players')::text); end if;
  if r.wk < 1 then reasons := array_append(reasons, 'no wicketkeeper'::text); end if;
  if r.bowl_options < 5 then reasons := array_append(reasons, (r.bowl_options || '/5 bowling options')::text); end if;
  if v_squad.budget_spent > v_budget then reasons := array_append(reasons, 'over budget'::text); end if;

  if array_length(reasons, 1) is not null then
    raise exception 'illegal squad: %', array_to_string(reasons, ', ') using errcode='42501';
  end if;

  update app.squads set confirmed = true, updated_at = now()
   where id = v_squad.id returning * into v_squad;
  return v_squad;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock timing (server-owned). Official fixture: lock at kickoff (resolve_at).
-- Friendly: lock at kickoff - 5 min. The SERVER decides; the client never does.
-- ---------------------------------------------------------------------------
create or replace function app._match_lock_at(p_fixture_id uuid, p_challenge_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = app, public as $$
declare v timestamptz;
begin
  if p_fixture_id is not null then
    select resolve_at into v from app.fixtures where id = p_fixture_id;
  else
    select kickoff_at - interval '5 minutes' into v from app.challenges where id = p_challenge_id;
  end if;
  return v;
end;
$$;

-- One orders row per (team, match). Expression index backs the upsert below;
-- exactly one of fixture_id/challenge_id is non-null (table CHECK), so the
-- coalesce is well-defined.
create unique index if not exists orders_team_match
  on app.orders(team_id, (coalesce(fixture_id, challenge_id)));

-- ---------------------------------------------------------------------------
-- submit_orders — LOAD-BEARING: rejected once now() >= lock. Upserts the orders
-- for (team, match) and marks them the team's last_used lineup (no-show fill).
-- ---------------------------------------------------------------------------
create or replace function app.submit_orders(
  p_league_id uuid, p_fixture_id uuid, p_challenge_id uuid, p_orders jsonb
) returns app.orders
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_team app.teams;
  v_lock timestamptz;
  v_row app.orders;
begin
  if (p_fixture_id is not null) = (p_challenge_id is not null) then
    raise exception 'exactly one of fixture/challenge required' using errcode='22023';
  end if;
  select * into v_team from app.teams where league_id = p_league_id and manager_id = v_mid;
  if v_team.id is null then raise exception 'no team' using errcode='42704'; end if;

  v_lock := app._match_lock_at(p_fixture_id, p_challenge_id);
  if v_lock is null then raise exception 'no such match' using errcode='42704'; end if;
  if now() >= v_lock then
    raise exception 'orders locked (lock was %, now %)', v_lock, now() using errcode='42501';
  end if;

  insert into app.orders(league_id, team_id, fixture_id, challenge_id,
      bat_order, captain, keeper, phase_intent, field_plan, compiled, xi, last_used, submitted_at)
    values (p_league_id, v_team.id, p_fixture_id, p_challenge_id,
      coalesce(p_orders->'batOrder','[]'::jsonb), p_orders->>'captain', p_orders->>'keeper',
      coalesce(p_orders->'phaseIntent','{"pp":0,"mid":0,"death":1}'::jsonb),
      coalesce(p_orders->'fieldPlan','{"pp":"bal","mid":"bal","death":"bal"}'::jsonb),
      coalesce(p_orders->'compiled','[]'::jsonb), coalesce(p_orders->'xi','[]'::jsonb),
      true, now())
  on conflict (team_id, coalesce(fixture_id, challenge_id)) do update
    set bat_order = excluded.bat_order, captain = excluded.captain, keeper = excluded.keeper,
        phase_intent = excluded.phase_intent, field_plan = excluded.field_plan,
        compiled = excluded.compiled, xi = excluded.xi, last_used = true, submitted_at = now()
  returning * into v_row;

  -- this is now the team's most recent lineup; demote older last_used rows
  update app.orders set last_used = false
   where team_id = v_team.id and id <> v_row.id and last_used;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Friendlies (Phase 3 completes the pipeline; the availability window lives here
-- because the design enforces it at ACCEPTANCE).
-- ---------------------------------------------------------------------------

-- A team is "busy" near `at` if it has a scheduled/locked fixture or an accepted
-- challenge whose kickoff is within `p_window` of `at`.
create or replace function app.team_busy(
  p_team_id uuid, p_at timestamptz, p_window interval, p_exclude_challenge uuid default null
) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from app.fixtures f
     where (f.home_team_id = p_team_id or f.away_team_id = p_team_id)
       and f.status in ('scheduled','locked')
       and f.resolve_at between p_at - p_window and p_at + p_window
  ) or exists (
    select 1 from app.challenges c
     where c.id is distinct from p_exclude_challenge
       and (c.from_team_id = p_team_id or c.to_team_id = p_team_id)
       and c.status = 'accepted'
       and c.kickoff_at between p_at - p_window and p_at + p_window
  );
$$;

-- issue_challenge — kickoff must be >= now()+1h; caller owns from_team.
create or replace function app.issue_challenge(
  p_league_id uuid, p_to_team_id uuid, p_pitch text, p_weather text,
  p_seed bigint, p_kickoff_at timestamptz
) returns app.challenges
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_from app.teams;
  v_row app.challenges;
begin
  select * into v_from from app.teams where league_id = p_league_id and manager_id = v_mid;
  if v_from.id is null then raise exception 'no team' using errcode='42704'; end if;
  if p_to_team_id = v_from.id then raise exception 'cannot challenge yourself' using errcode='22023'; end if;
  if p_kickoff_at < now() + interval '1 hour' then
    raise exception 'kickoff must be at least 1 hour out' using errcode='22023';
  end if;
  insert into app.challenges(league_id, from_team_id, to_team_id, pitch, weather, seed, kickoff_at)
    values (p_league_id, v_from.id, p_to_team_id, p_pitch, p_weather, p_seed, p_kickoff_at)
    returning * into v_row;
  return v_row;
end;
$$;

-- accept_challenge — LOAD-BEARING availability check: neither team may already be
-- in a match (official or friendly) overlapping this kickoff window.
create or replace function app.accept_challenge(
  p_league_id uuid, p_challenge_id uuid, p_window interval default interval '4 hours'
) returns app.challenges
language plpgsql security definer set search_path = app, public as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_to app.teams;
  v_ch app.challenges;
begin
  select * into v_ch from app.challenges where id = p_challenge_id for update;
  if v_ch.id is null then raise exception 'no such challenge' using errcode='42704'; end if;
  if v_ch.status <> 'pending' then raise exception 'challenge is %', v_ch.status using errcode='42501'; end if;

  -- only the challenged team's manager may accept
  select * into v_to from app.teams where id = v_ch.to_team_id;
  if v_to.manager_id <> v_mid then raise exception 'not your challenge to accept' using errcode='42501'; end if;

  if v_ch.kickoff_at < now() then
    update app.challenges set status='expired' where id = v_ch.id;
    raise exception 'challenge expired' using errcode='42501';
  end if;

  if app.team_busy(v_ch.from_team_id, v_ch.kickoff_at, p_window, v_ch.id)
     or app.team_busy(v_ch.to_team_id, v_ch.kickoff_at, p_window, v_ch.id) then
    raise exception 'a team is already booked in this window' using errcode='42501';
  end if;

  update app.challenges set status='accepted', accepted_at=now()
   where id = v_ch.id returning * into v_ch;
  return v_ch;
end;
$$;

-- ---------------------------------------------------------------------------
-- founder_edit — founder-only corrections: league config + squad override.
-- ---------------------------------------------------------------------------
create or replace function app.founder_edit(
  p_league_id uuid, p_action text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare
  v_founder uuid := app.require_founder(p_league_id);
begin
  if p_action = 'set_config' then
    update app.leagues
       set match_time = coalesce((p_payload->>'match_time')::time, match_time),
           tz         = coalesce(p_payload->>'tz', tz),
           status     = coalesce((p_payload->>'status')::app.league_status, status)
     where id = p_league_id;
    return jsonb_build_object('ok', true, 'action', 'set_config');

  elsif p_action = 'override_roster' then
    -- founder can correct a team's server-owned roster (e.g. dispute resolution)
    update app.squads
       set roster = p_payload->'roster',
           budget_spent = coalesce((p_payload->>'budget_spent')::bigint, budget_spent),
           updated_at = now()
     where team_id = (p_payload->>'team_id')::uuid and league_id = p_league_id;
    return jsonb_build_object('ok', true, 'action', 'override_roster');

  else
    raise exception 'unknown founder action %', p_action using errcode='22023';
  end if;
end;
$$;

-- Grant execute on the new functions to the authenticated role.
grant execute on all functions in schema app to authenticated;

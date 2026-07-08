-- ============================================================================
-- Fifty Overs — game-native league sync. The game engine is deterministic, so
-- the whole league is just: (1) one authoritative game snapshot per league, and
-- (2) each manager's per-round order packet. Clients pull the snapshot to see
-- the league in the game's OWN UI (table, fixtures, results) and push their own
-- orders packet; the background resolver (or the founder's client) replays the
-- packets through the engine and writes the next snapshot. No parallel UI.
-- ============================================================================

-- The authoritative league state = the game's snapshot() document.
create table if not exists app.league_state (
  league_id  uuid primary key references app.leagues(id) on delete cascade,
  snapshot   jsonb not null,
  version    int   not null default 1,
  round      int   not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- Each manager's per-round order packet ({fo_packet,teamIx,club,round,manager,orders}).
create table if not exists app.league_packets (
  league_id  uuid not null references app.leagues(id) on delete cascade,
  manager_id uuid not null references app.members(id) on delete cascade,
  round      int  not null,
  packet     jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (league_id, manager_id, round)
);

-- Each manager's drafted club (a GD.teams record), used to assemble the league.
create table if not exists app.league_clubs (
  league_id  uuid not null references app.leagues(id) on delete cascade,
  manager_id uuid not null references app.members(id) on delete cascade,
  club       jsonb not null,
  team_ix    int,
  updated_at timestamptz not null default now(),
  primary key (league_id, manager_id)
);

alter table app.league_state   enable row level security;
alter table app.league_packets enable row level security;
alter table app.league_clubs   enable row level security;

-- Members may read all three (so the game can sync); writes go through RPCs.
drop policy if exists ls_read on app.league_state;
create policy ls_read on app.league_state   for select using (league_id in (select app.my_league_ids()));
drop policy if exists lp_read on app.league_packets;
create policy lp_read on app.league_packets for select using (league_id in (select app.my_league_ids()));
drop policy if exists lc_read on app.league_clubs;
create policy lc_read on app.league_clubs   for select using (league_id in (select app.my_league_ids()));

-- Push my drafted club (called from the game on "Start Season"/founderConfirm).
create or replace function app.push_club(p_league_id uuid, p_club jsonb, p_team_ix int default null)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  insert into app.league_clubs(league_id, manager_id, club, team_ix)
    values (p_league_id, v_mid, p_club, p_team_ix)
  on conflict (league_id, manager_id) do update
    set club = excluded.club, team_ix = excluded.team_ix, updated_at = now();
end $$;

-- Push my per-round orders packet (called from the game when orders are saved).
create or replace function app.push_packet(p_league_id uuid, p_round int, p_packet jsonb)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  insert into app.league_packets(league_id, manager_id, round, packet)
    values (p_league_id, v_mid, p_round, p_packet)
  on conflict (league_id, manager_id, round) do update
    set packet = excluded.packet, updated_at = now();
end $$;

-- Write the authoritative snapshot. Founder-only for humans; the resolver runs as
-- service_role (no jwt subject) and is allowed through to advance rounds.
create or replace function app.push_league_state(p_league_id uuid, p_snapshot jsonb, p_round int)
returns int language plpgsql security definer set search_path = app, public as $$
declare v_ver int; v_mid uuid;
begin
  if app.current_auth_uid() is not null then
    v_mid := app.require_founder(p_league_id);
  end if;
  insert into app.league_state(league_id, snapshot, version, round, updated_by)
    values (p_league_id, p_snapshot, 1, p_round, v_mid)
  on conflict (league_id) do update
    set snapshot = excluded.snapshot, version = app.league_state.version + 1,
        round = excluded.round, updated_by = v_mid, updated_at = now()
  returning version into v_ver;
  return v_ver;
end $$;

-- Table-level SELECT for logged-in users (RLS still restricts rows to members).
-- Writes go only through the SECURITY DEFINER functions above, so no insert/update grant.
grant select on app.league_state, app.league_packets, app.league_clubs to authenticated;
grant execute on all functions in schema app to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant execute on all functions in schema app to service_role';
    execute 'grant select, insert, update on app.league_state, app.league_packets, app.league_clubs to service_role';
  end if;
end $$;

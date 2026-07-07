-- Fifty Overs — all migrations, concatenated in order for a one-shot deploy.
-- Paste into the Supabase SQL Editor (Dashboard → SQL Editor → New query) and Run.
-- Safe to run ONCE on a fresh project. Contains NO secrets.


-- ==================== 0001_init.sql ====================

-- ============================================================================
-- Fifty Overs Multiplayer League — Phase 1 schema + identity boundary
-- ============================================================================
-- Trust boundary: the server owns every outcome-determining fact. Clients never
-- write results, ratings, squad state, or lock timing directly. All mutations go
-- through SECURITY DEFINER functions in the `app` schema that authorize the
-- caller via ONE identity seam: app.resolve_manager_id(...).
--
-- Identity seam: in Supabase, a request's JWT populates the GUC
-- `request.jwt.claim.sub` with the auth user's UUID (this is exactly what
-- auth.uid() reads). We read the same GUC so the code is identical in Supabase
-- and in local PGlite tests (tests just SET the GUC). Swapping identity providers
-- means changing ONLY app.current_auth_uid().
-- ============================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type app.member_role   as enum ('founder','manager');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.league_status as enum ('setup','drafting','active','complete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.fixture_status as enum ('scheduled','locked','resolved','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.challenge_status as enum ('pending','accepted','declined','expired','locked','resolved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

-- A league is frozen to ONE engine build (build_hash) for the whole season.
create table app.leagues (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  founder_uid    uuid        not null,               -- auth user who created it
  build_hash     text        not null,               -- pinned sha256 of the game file
  status         app.league_status not null default 'setup',
  match_time     time        not null default '17:00',   -- league-local kickoff for official matches
  tz             text        not null default 'UTC',
  draft_budget   bigint      not null default 1000000,
  manager_cap    int,                                 -- set when the founder locks the roster count
  managers_locked boolean    not null default false,
  season_no      int         not null default 1,
  created_at     timestamptz not null default now(),
  constraint draft_budget_pos check (draft_budget > 0)
);

-- One membership row per (league, auth user). manager_id is THE key every game
-- action is authorized against. role is checked server-side for founder gating.
create table app.members (
  id          uuid primary key default gen_random_uuid(),   -- == manager_id
  league_id   uuid not null references app.leagues(id) on delete cascade,
  auth_uid    uuid not null,
  role        app.member_role not null default 'manager',
  display_name text not null,
  created_at  timestamptz not null default now(),
  unique (league_id, auth_uid)
);
create index members_by_uid on app.members(auth_uid);

-- Invite codes. Invite-only: a code is bound to a Supabase Auth account on redeem.
create table app.invites (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references app.leagues(id) on delete cascade,
  code          text not null unique,
  role          app.member_role not null default 'manager',
  created_by    uuid not null references app.members(id) on delete cascade,
  redeemed_uid  uuid,                       -- auth user who redeemed (null = unused)
  redeemed_by   uuid references app.members(id) on delete set null,
  redeemed_at   timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index invites_by_league on app.invites(league_id);

-- One team per manager per league. Server-owned identity of the club.
create table app.teams (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references app.leagues(id) on delete cascade,
  manager_id  uuid not null references app.members(id) on delete cascade,
  name        text not null,
  ground      text not null default 'Neutral Ground',
  home_pitch  text not null default 'balanced',
  created_at  timestamptz not null default now(),
  unique (league_id, manager_id),
  unique (league_id, name)
);

-- Server-owned squad state. roster is the authoritative set of signed players.
create table app.squads (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null unique references app.teams(id) on delete cascade,
  league_id    uuid not null references app.leagues(id) on delete cascade,
  roster       jsonb not null default '[]'::jsonb,   -- [{name, rating, wage, skills, ...}]
  budget_spent bigint not null default 0,
  confirmed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  constraint budget_spent_nonneg check (budget_spent >= 0)
);

-- The snake-dealt private pool a manager drafts from. One bucket per manager.
create table app.draft_pools (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references app.leagues(id) on delete cascade,
  manager_id  uuid not null references app.members(id) on delete cascade,
  players     jsonb not null default '[]'::jsonb,   -- the manager's unique bucket
  created_at  timestamptz not null default now(),
  unique (league_id, manager_id)
);

-- Official fixtures: double round-robin, one per team per day at league match time.
create table app.fixtures (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references app.leagues(id) on delete cascade,
  season_no     int  not null default 1,
  round         int  not null,
  home_team_id  uuid not null references app.teams(id) on delete cascade,
  away_team_id  uuid not null references app.teams(id) on delete cascade,
  ground        text not null,
  pitch         text not null,
  weather       text not null,
  seed          bigint not null,                     -- per-fixture deterministic seed
  resolve_at    timestamptz not null,                -- kickoff / lock reference
  status        app.fixture_status not null default 'scheduled',
  created_at    timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index fixtures_by_league_round on app.fixtures(league_id, season_no, round);
create index fixtures_by_resolve on app.fixtures(resolve_at) where status = 'scheduled';

-- Friendlies. Challenge → accept → server-locked lineups → resolved as replay.
create table app.challenges (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references app.leagues(id) on delete cascade,
  from_team_id  uuid not null references app.teams(id) on delete cascade,
  to_team_id    uuid not null references app.teams(id) on delete cascade,
  pitch         text not null,
  weather       text not null,
  seed          bigint not null,
  kickoff_at    timestamptz not null,                -- must be >= now()+1h at issue time
  status        app.challenge_status not null default 'pending',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  check (from_team_id <> to_team_id)
);
create index challenges_by_team on app.challenges(from_team_id, to_team_id);
create index challenges_open on app.challenges(kickoff_at) where status in ('pending','accepted');

-- Orders (lineup + tactics) submitted for a specific match (fixture or challenge).
-- Exactly one target is set. last_used marks the most recent orders per team, for
-- no-show auto-fill.
create table app.orders (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references app.leagues(id) on delete cascade,
  team_id      uuid not null references app.teams(id) on delete cascade,
  fixture_id   uuid references app.fixtures(id) on delete cascade,
  challenge_id uuid references app.challenges(id) on delete cascade,
  bat_order    jsonb not null default '[]'::jsonb,
  captain      text,
  keeper       text,
  phase_intent jsonb not null default '{"pp":0,"mid":0,"death":1}'::jsonb,
  field_plan   jsonb not null default '{"pp":"bal","mid":"bal","death":"bal"}'::jsonb,
  compiled     jsonb not null default '[]'::jsonb,   -- per-over bowler plan
  xi           jsonb not null default '[]'::jsonb,    -- explicit 11 (names)
  last_used    boolean not null default false,
  locked       boolean not null default false,
  submitted_at timestamptz not null default now(),
  -- exactly one match target
  constraint one_target check ((fixture_id is not null) <> (challenge_id is not null)),
  unique (team_id, fixture_id),
  unique (team_id, challenge_id)
);
create index orders_by_team on app.orders(team_id);

-- Results. winner_team is a WRITTEN column (never string-parsed). Runs/balls
-- convenience columns let the standings view compute NRR without parsing jsonb.
create table app.results (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references app.leagues(id) on delete cascade,
  fixture_id    uuid references app.fixtures(id) on delete set null,
  challenge_id  uuid references app.challenges(id) on delete set null,
  comp          text not null,                       -- 'league' | 'friendly'
  home_team_id  uuid not null references app.teams(id) on delete cascade,
  away_team_id  uuid not null references app.teams(id) on delete cascade,
  winner_team_id uuid references app.teams(id),      -- null = tie
  result_text   text not null,
  home_runs     int not null default 0,
  home_balls    int not null default 0,
  away_runs     int not null default 0,
  away_balls    int not null default 0,
  scorecard     jsonb not null,
  worm          jsonb not null,
  log           jsonb not null,
  seed          bigint not null,
  pitch         text not null,
  weather       text not null,
  build_hash    text not null,                       -- build the resolver actually ran
  resolved_at   timestamptz not null default now(),
  constraint one_source check ((fixture_id is not null) <> (challenge_id is not null))
);
create unique index results_one_per_fixture on app.results(fixture_id) where fixture_id is not null;
create unique index results_one_per_challenge on app.results(challenge_id) where challenge_id is not null;
create index results_by_league on app.results(league_id);

-- ---------------------------------------------------------------------------
-- Standings view — derived from results (official only), via winner_team_id.
-- NRR = (runs_for / overs_for) - (runs_against / overs_against).
-- ---------------------------------------------------------------------------
create view app.standings as
with per_team as (
  -- home perspective
  select r.league_id, r.home_team_id as team_id,
         1 as played,
         (r.winner_team_id = r.home_team_id)::int as won,
         (r.winner_team_id is not null and r.winner_team_id = r.away_team_id)::int as lost,
         (r.winner_team_id is null)::int as tied,
         r.home_runs as runs_for, r.home_balls as balls_for,
         r.away_runs as runs_against, r.away_balls as balls_against
  from app.results r where r.comp = 'league'
  union all
  -- away perspective
  select r.league_id, r.away_team_id as team_id,
         1 as played,
         (r.winner_team_id = r.away_team_id)::int as won,
         (r.winner_team_id is not null and r.winner_team_id = r.home_team_id)::int as lost,
         (r.winner_team_id is null)::int as tied,
         r.away_runs as runs_for, r.away_balls as balls_for,
         r.home_runs as runs_against, r.home_balls as balls_against
  from app.results r where r.comp = 'league'
)
select
  pt.league_id,
  pt.team_id,
  t.name as team_name,
  sum(pt.played) as p,
  sum(pt.won)    as w,
  sum(pt.lost)   as l,
  sum(pt.tied)   as t,
  sum(pt.won)*2 + sum(pt.tied) as pts,
  case when sum(pt.balls_for) > 0 and sum(pt.balls_against) > 0
       then round(
         (sum(pt.runs_for)::numeric   / (sum(pt.balls_for)::numeric/6))
       - (sum(pt.runs_against)::numeric/ (sum(pt.balls_against)::numeric/6)), 3)
       else 0 end as nrr
from per_team pt
join app.teams t on t.id = pt.team_id
group by pt.league_id, pt.team_id, t.name;

-- ============================================================================
-- IDENTITY SEAM
-- ============================================================================

-- The ONE place identity is resolved from the transport. In Supabase this GUC is
-- set from the verified JWT (same source as auth.uid()). Swap providers here only.
create or replace function app.current_auth_uid()
returns uuid
language plpgsql
stable
as $$
declare
  v text;
begin
  -- Supabase sets 'request.jwt.claim.sub'; some stacks use the whole claims json.
  v := nullif(current_setting('request.jwt.claim.sub', true), '');
  if v is null then
    begin
      v := nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '');
    exception when others then
      v := null;
    end;
  end if;
  if v is null then
    return null;
  end if;
  return v::uuid;
end;
$$;

-- resolveManagerId(request): auth uid -> members.auth_uid -> manager_id, scoped
-- to a league. Raises if the caller is not authenticated or not a member.
create or replace function app.resolve_manager_id(p_league_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  v_uid uuid := app.current_auth_uid();
  v_mid uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select id into v_mid from app.members
    where league_id = p_league_id and auth_uid = v_uid;
  if v_mid is null then
    raise exception 'not a member of league %', p_league_id using errcode = '42501';
  end if;
  return v_mid;
end;
$$;

-- Founder gating: raise unless the current manager is the league founder.
create or replace function app.require_founder(p_league_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  v_mid uuid := app.resolve_manager_id(p_league_id);
  v_role app.member_role;
begin
  select role into v_role from app.members where id = v_mid;
  if v_role is distinct from 'founder' then
    raise exception 'founder-only action' using errcode = '42501';
  end if;
  return v_mid;
end;
$$;

-- ============================================================================
-- BOOTSTRAP + INVITE FLOW
-- ============================================================================

-- Create a league and its founder membership + team, in one authenticated call.
create or replace function app.create_league(
  p_name text, p_build_hash text, p_display_name text,
  p_team_name text default null, p_ground text default 'Neutral Ground'
) returns app.leagues
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_uid uuid := app.current_auth_uid();
  v_league app.leagues;
  v_mid uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into app.leagues(name, founder_uid, build_hash)
    values (p_name, v_uid, p_build_hash) returning * into v_league;
  insert into app.members(league_id, auth_uid, role, display_name)
    values (v_league.id, v_uid, 'founder', p_display_name) returning id into v_mid;
  insert into app.teams(league_id, manager_id, name, ground)
    values (v_league.id, v_mid, coalesce(p_team_name, p_display_name || ' XI'), p_ground);
  return v_league;
end;
$$;

-- Founder-only: mint an invite code.
create or replace function app.create_invite(
  p_league_id uuid, p_code text, p_role app.member_role default 'manager',
  p_expires_at timestamptz default null
) returns app.invites
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_founder uuid := app.require_founder(p_league_id);   -- gate
  v_inv app.invites;
begin
  insert into app.invites(league_id, code, role, created_by, expires_at)
    values (p_league_id, p_code, p_role, v_founder, p_expires_at)
    returning * into v_inv;
  return v_inv;
end;
$$;

-- Redeem an invite: binds the code to the calling auth account, creates the
-- member (and their team), returns the new manager_id. Idempotent-safe: a used or
-- expired code, or an already-joined user, raises.
create or replace function app.redeem_invite(
  p_code text, p_display_name text, p_team_name text default null
) returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_uid uuid := app.current_auth_uid();
  v_inv app.invites;
  v_mid uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_inv from app.invites where code = p_code for update;
  if v_inv.id is null then
    raise exception 'invalid invite code' using errcode = '22023';
  end if;
  if v_inv.redeemed_uid is not null then
    raise exception 'invite already redeemed' using errcode = '23505';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'invite expired' using errcode = '22023';
  end if;
  if exists (select 1 from app.members where league_id = v_inv.league_id and auth_uid = v_uid) then
    raise exception 'already a member of this league' using errcode = '23505';
  end if;

  insert into app.members(league_id, auth_uid, role, display_name)
    values (v_inv.league_id, v_uid, v_inv.role, p_display_name)
    returning id into v_mid;

  insert into app.teams(league_id, manager_id, name, ground)
    values (v_inv.league_id, v_mid, coalesce(p_team_name, p_display_name || ' XI'), 'Neutral Ground');

  update app.invites
     set redeemed_uid = v_uid, redeemed_by = v_mid, redeemed_at = now()
   where id = v_inv.id;

  return v_mid;
end;
$$;

-- ============================================================================
-- RLS — deny direct table access by default. All mutations flow through the
-- SECURITY DEFINER functions above; reads are scoped to league membership.
-- (Supabase roles: 'authenticated'/'anon'. Superuser/service_role bypass RLS.)
--
-- Membership lookups live in SECURITY DEFINER helpers so policies never SELECT
-- the RLS-protected tables directly (that would recurse: a policy on `members`
-- that queries `members` re-triggers itself). The helpers run as the owner and
-- bypass RLS, giving each policy a clean "what may I see" set.
-- ============================================================================
create or replace function app.my_league_ids()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select league_id from app.members where auth_uid = app.current_auth_uid();
$$;

create or replace function app.my_manager_ids()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select id from app.members where auth_uid = app.current_auth_uid();
$$;

create or replace function app.my_team_ids()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select t.id from app.teams t
   where t.manager_id in (select id from app.members where auth_uid = app.current_auth_uid());
$$;

create or replace function app.my_founder_league_ids()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select league_id from app.members
   where auth_uid = app.current_auth_uid() and role = 'founder';
$$;

alter table app.leagues     enable row level security;
alter table app.members     enable row level security;
alter table app.invites     enable row level security;
alter table app.teams       enable row level security;
alter table app.squads      enable row level security;
alter table app.draft_pools enable row level security;
alter table app.fixtures    enable row level security;
alter table app.challenges  enable row level security;
alter table app.orders      enable row level security;
alter table app.results     enable row level security;

-- Read policies: a member can read rows of leagues they belong to.
create policy leagues_read on app.leagues for select
  using (id in (select app.my_league_ids()));

create policy members_read on app.members for select
  using (league_id in (select app.my_league_ids()));

create policy teams_read on app.teams for select
  using (league_id in (select app.my_league_ids()));

create policy squads_read on app.squads for select
  using (league_id in (select app.my_league_ids()));

-- A manager sees only their OWN draft pool (buckets are private).
create policy draft_pools_read on app.draft_pools for select
  using (manager_id in (select app.my_manager_ids()));

create policy fixtures_read on app.fixtures for select
  using (league_id in (select app.my_league_ids()));

create policy challenges_read on app.challenges for select
  using (league_id in (select app.my_league_ids()));

create policy orders_read on app.orders for select
  using (team_id in (select app.my_team_ids()));

create policy results_read on app.results for select
  using (league_id in (select app.my_league_ids()));

-- Invites: only the founder can list a league's invites.
create policy invites_read on app.invites for select
  using (league_id in (select app.my_founder_league_ids()));

-- No INSERT/UPDATE/DELETE policies => direct writes are denied for
-- authenticated/anon; every write must go through an app.* SECURITY DEFINER fn.

-- ---------------------------------------------------------------------------
-- Grants for the Supabase 'authenticated' role. Reads flow through RLS (row
-- filtering); writes are NOT granted at the table level, so the ONLY write path
-- is the app.* SECURITY DEFINER functions (defense in depth: RLS + no privilege).
-- 'anon' gets nothing — every action needs an authenticated identity.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema app to authenticated;
grant select on all tables in schema app to authenticated;
grant execute on all functions in schema app to authenticated;

-- ==================== 0002_actions.sql ====================

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

-- ==================== 0003_friendly.sql ====================

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

-- ==================== 0004_official.sql ====================

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

-- ==================== 0005_scheduler.sql ====================

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

-- ==================== 0006_founder_views.sql ====================

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

-- ==================== 0007_season_tz.sql ====================

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

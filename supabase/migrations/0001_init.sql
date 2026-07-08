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

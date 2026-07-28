-- ============================================================================
-- Fifty Overs — PHASE 1: the league as TABLES, not a document.
--
-- Until now the whole league lived as one JSON snapshot that every device
-- downloaded whole and every page parsed whole. Battrick and From the
-- Pavilion never have that class of problem because their pages ask the
-- database only for what they show: a standings page reads standings, a
-- squad page reads eighteen players. This schema is that spine.
--
-- The `game` schema starts clean (the old app/world schemas stay as they are;
-- the current league is being retired by its owner, not migrated). Reads are
-- public — a league table is a public thing, exactly as it is on Battrick.
-- Writes happen ONLY through the umpire (service_role): clients never write
-- rows, so no client can corrupt the world.
-- ============================================================================

create schema if not exists game;

create table if not exists game.leagues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  season_no  int  not null default 1,
  round      int  not null default 0,          -- rounds fully resolved so far
  created_at timestamptz not null default now()
);

create table if not exists game.clubs (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references game.leagues(id) on delete cascade,
  name        text not null,
  manager_uid uuid,                            -- auth.users id; null = bot club
  ground      text not null default '',
  bank        bigint not null default 0,
  unique (league_id, name)
);

create table if not exists game.players (
  id      uuid primary key default gen_random_uuid(),
  club_id uuid not null references game.clubs(id) on delete cascade,
  name    text not null,
  role    text not null default '',
  age     int  not null default 0,
  rating  int  not null default 0,
  -- the full engine player record; the columns above are what list pages
  -- sort and show, the engine reads this when it simulates
  attrs   jsonb not null,
  unique (club_id, name)
);

-- One row per completed match. The numeric columns are exactly what the
-- standings need; the scorecard is what the match page shows; the
-- ball-by-ball goes to match_logs and is fetched only when read.
create table if not exists game.results (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references game.leagues(id) on delete cascade,
  comp       text not null default 'league',
  round      int  not null,
  home       text not null,
  away       text not null,
  winner     text,                             -- null = tie / no result
  home_runs  int not null, home_wkts int not null, home_balls int not null,
  away_runs  int not null, away_wkts int not null, away_balls int not null,
  summary    text not null default '',
  seed       bigint,
  scorecard  jsonb,
  played_at  timestamptz not null default now(),
  unique (league_id, comp, round, home, away)
);
create index if not exists results_league_round on game.results (league_id, round);

create table if not exists game.match_logs (
  result_id uuid primary key references game.results(id) on delete cascade,
  log       jsonb not null
);

-- THE LEAGUE TABLE IS A QUERY, NOT A STORED THING. This view mirrors the
-- engine's leagueRows() to the letter: two points a win, one a tie, overs
-- charged as 50 when a side is bowled out else legal balls / 6, net run rate
-- = runs-for per over faced minus runs-against per over bowled. The test
-- suite proves this view and the engine agree on a real played season.
create or replace view game.standings as
with per_side as (
  select league_id, home as club, home_runs as rf,
         case when home_wkts >= 10 then 50.0 else home_balls / 6.0 end as ovf,
         away_runs as ra,
         case when away_wkts >= 10 then 50.0 else away_balls / 6.0 end as ova,
         case when winner is null then 't' when winner = home then 'w' else 'l' end as res
    from game.results where comp = 'league'
  union all
  select league_id, away, away_runs,
         case when away_wkts >= 10 then 50.0 else away_balls / 6.0 end,
         home_runs,
         case when home_wkts >= 10 then 50.0 else home_balls / 6.0 end,
         case when winner is null then 't' when winner = away then 'w' else 'l' end
    from game.results where comp = 'league'
)
select c.league_id, c.name as club,
       count(s.club)::int                            as p,
       (count(*) filter (where s.res = 'w'))::int    as w,
       (count(*) filter (where s.res = 'l'))::int    as l,
       (count(*) filter (where s.res = 't'))::int    as t,
       (2 * count(*) filter (where s.res = 'w')
          + count(*) filter (where s.res = 't'))::int as pts,
       coalesce(sum(s.rf), 0)::int as rf,
       coalesce(sum(s.ra), 0)::int as ra,
       case when coalesce(sum(s.ovf), 0) > 0 and coalesce(sum(s.ova), 0) > 0
            then sum(s.rf) / sum(s.ovf) - sum(s.ra) / sum(s.ova)
            else 0 end as nrr
  from game.clubs c
  left join per_side s on s.league_id = c.league_id and s.club = c.name
 group by c.league_id, c.name;

-- Reads are public; writes are the umpire's alone.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant usage on schema game to anon, authenticated';
    execute 'grant select on all tables in schema game to anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema game to service_role';
    execute 'grant all on all tables in schema game to service_role';
  end if;
end $$;

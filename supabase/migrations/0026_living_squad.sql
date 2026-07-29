-- ============================================================================
-- Fifty Overs — THE LIVING SQUAD.
--
-- 0024 gave the relational spine a players table that held a name, an age and
-- a rating. That is enough to print a scorecard and nothing else. A squad a
-- manager BUILDS needs four things it did not have:
--
--   * a career, season by season, so growth is something you can point at
--     rather than a number that silently changed overnight
--   * a contract, so a cricketer can want more, and can leave
--   * a status, so a man can retire and stay in the record book afterwards
--   * a club that owns facilities, so money buys something permanent
--
-- WHAT IS NOT HERE, DELIBERATELY. A player's CEILING and his CHARACTER are not
-- columns. They are pure functions of facts already on the record (engine
-- module 70-living-squad.js), so the umpire, every phone and a manager who has
-- been asleep for a fortnight all derive the identical career with nothing to
-- migrate and nothing that can drift. A stored ceiling is a stored lie waiting
-- to happen. `traits` below exists only so the world can OVERRIDE that
-- derivation for a particular man; left null, he is read off his own name.
--
-- Safe to run on a database that already has 0024 and 0025: every change is
-- additive, every column has a default, and nothing existing is rewritten.
--
-- OPERATOR NOTE — as with 0025, PostgREST only answers for schemas it has been
-- told to expose. `game` must be in Settings -> API -> "Exposed schemas". It
-- already is if 0025 was run and the standings page reads "served".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. THE CRICKETER
-- ---------------------------------------------------------------------------
alter table game.players add column if not exists status         text   not null default 'active';
alter table game.players add column if not exists debut_season   int    not null default 1;
alter table game.players add column if not exists retired_season int;
alter table game.players add column if not exists contract_until int;
alter table game.players add column if not exists wage           int    not null default 0;
alter table game.players add column if not exists traits         text[];
alter table game.players add column if not exists talent         text   not null default 'steady';

-- 'active' | 'retired' | 'released'. A retired man keeps his row: the record
-- book, the honours board and his own club's history all still name him.
alter table game.players drop constraint if exists players_status_ck;
alter table game.players add constraint players_status_ck
  check (status in ('active', 'retired', 'released'));

create index if not exists players_club_status_ix on game.players (club_id, status);

-- ---------------------------------------------------------------------------
-- 2. THE CAREER — one row per player per season
--
-- This is the "season-by-season history" a manager reads to see a career
-- happen: what he was worth at 19, at 20, at 21, and what he did each year.
-- ovr_start and ovr_end are the two numbers that make growth visible.
-- ---------------------------------------------------------------------------
create table if not exists game.player_seasons (
  player_id   uuid not null references game.players(id) on delete cascade,
  season_no   int  not null,
  club_id     uuid references game.clubs(id) on delete set null,
  age         int  not null default 0,
  ovr_start   int  not null default 0,
  ovr_end     int  not null default 0,
  matches     int  not null default 0,
  runs        int  not null default 0,
  balls       int  not null default 0,
  outs        int  not null default 0,
  high_score  int  not null default 0,
  fifties     int  not null default 0,
  hundreds    int  not null default 0,
  wickets     int  not null default 0,
  runs_conceded int not null default 0,
  balls_bowled  int not null default 0,
  best_wkts   int  not null default 0,
  best_runs   int  not null default 0,
  catches     int  not null default 0,
  primary key (player_id, season_no)
);

-- ---------------------------------------------------------------------------
-- 3. THE THINGS THAT HAPPENED TO HIM
--
-- Retirements, breakthroughs, contract renewals, departures. The end-of-season
-- report is a query over this table, and so is a player's own story.
-- ---------------------------------------------------------------------------
create table if not exists game.player_events (
  id         bigserial primary key,
  player_id  uuid not null references game.players(id) on delete cascade,
  season_no  int  not null,
  round      int,
  kind       text not null,
  detail     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists player_events_player_ix on game.player_events (player_id, season_no);

-- ---------------------------------------------------------------------------
-- 4. THE CLUB THAT GETS BIGGER
--
-- Money has to buy something that is still there in three seasons. Each of
-- these is a level the umpire reads when it works a round: seats decide the
-- gate, the academy decides how many boys and how good, the nets decide how
-- much of a season's work a player banks, scouting decides how far you can
-- see. They are the compounding advantages a big club has over a small one.
-- ---------------------------------------------------------------------------
alter table game.clubs add column if not exists seats           int not null default 15000;
alter table game.clubs add column if not exists supporters      int not null default 12000;
alter table game.clubs add column if not exists academy_level   int not null default 2;
alter table game.clubs add column if not exists nets_level      int not null default 1;
alter table game.clubs add column if not exists scouting_level  int not null default 1;
alter table game.clubs add column if not exists colour          text;
alter table game.clubs add column if not exists founded_season  int not null default 1;

alter table game.clubs drop constraint if exists clubs_levels_ck;
alter table game.clubs add constraint clubs_levels_ck check (
  academy_level between 1 and 5 and nets_level between 1 and 5 and scouting_level between 1 and 5
);

-- ---------------------------------------------------------------------------
-- 5. WHAT A CLUB DID IN A SEASON
--
-- The dynasty ledger. One row per club per season, written when the season
-- rolls over, so "three titles in five years" is a query and not a guess.
-- ---------------------------------------------------------------------------
create table if not exists game.club_seasons (
  club_id    uuid not null references game.clubs(id) on delete cascade,
  season_no  int  not null,
  league_id  uuid not null references game.leagues(id) on delete cascade,
  position   int  not null default 0,
  played     int  not null default 0,
  won        int  not null default 0,
  lost       int  not null default 0,
  tied       int  not null default 0,
  points     int  not null default 0,
  nrr        numeric(6,3) not null default 0,
  champion   boolean not null default false,
  spoon      boolean not null default false,
  bank_end   bigint not null default 0,
  primary key (club_id, season_no)
);

-- ---------------------------------------------------------------------------
-- 6. THE SEASON ITSELF
--
-- One division, a title race and a wooden spoon. A season knows how long it
-- is, where it has got to, and how it ended.
-- ---------------------------------------------------------------------------
create table if not exists game.seasons (
  league_id     uuid not null references game.leagues(id) on delete cascade,
  season_no     int  not null,
  rounds        int  not null default 18,
  current_round int  not null default 0,
  state         text not null default 'running',
  champion      text,
  spoon         text,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  primary key (league_id, season_no)
);
alter table game.seasons drop constraint if exists seasons_state_ck;
alter table game.seasons add constraint seasons_state_ck
  check (state in ('preseason', 'running', 'closed'));

-- ---------------------------------------------------------------------------
-- 7. A CAREER, IN ONE READ
--
-- What a player page asks for: the man, and every season he has played, with
-- his batting average and his economy already worked out. Derived, so it can
-- never disagree with the rows underneath it.
-- ---------------------------------------------------------------------------
create or replace view game.careers as
select
  p.id                as player_id,
  p.club_id,
  p.name,
  p.role,
  p.age,
  p.rating,
  p.talent,
  p.status,
  p.debut_season,
  p.retired_season,
  p.contract_until,
  p.wage,
  s.season_no,
  s.ovr_start,
  s.ovr_end,
  s.matches,
  s.runs,
  s.balls,
  s.outs,
  s.high_score,
  s.fifties,
  s.hundreds,
  s.wickets,
  s.runs_conceded,
  s.balls_bowled,
  s.catches,
  case when s.outs > 0 then round(s.runs::numeric / s.outs, 2) end            as bat_average,
  case when s.balls > 0 then round(100 * s.runs::numeric / s.balls, 1) end    as strike_rate,
  case when s.wickets > 0 then round(s.runs_conceded::numeric / s.wickets, 2) end as bowl_average,
  case when s.balls_bowled > 0
       then round(6 * s.runs_conceded::numeric / s.balls_bowled, 2) end       as economy
from game.players p
left join game.player_seasons s on s.player_id = p.id;

-- ---------------------------------------------------------------------------
-- 8. GRANTS — reads are public, exactly as the rest of the spine
-- ---------------------------------------------------------------------------
grant usage on schema game to anon, authenticated;
grant select on game.player_seasons, game.player_events, game.club_seasons,
                game.seasons, game.careers
  to anon, authenticated;

-- the umpire writes with the service role, which bypasses RLS; everybody else
-- reads and nothing more, which is what keeps a career honest
alter table game.player_seasons enable row level security;
alter table game.player_events  enable row level security;
alter table game.club_seasons   enable row level security;
alter table game.seasons        enable row level security;

drop policy if exists player_seasons_read on game.player_seasons;
drop policy if exists player_events_read  on game.player_events;
drop policy if exists club_seasons_read   on game.club_seasons;
drop policy if exists seasons_read        on game.seasons;

create policy player_seasons_read on game.player_seasons for select using (true);
create policy player_events_read  on game.player_events  for select using (true);
create policy club_seasons_read   on game.club_seasons   for select using (true);
create policy seasons_read        on game.seasons        for select using (true);

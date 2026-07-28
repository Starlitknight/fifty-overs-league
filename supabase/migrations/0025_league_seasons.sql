-- ============================================================================
-- Fifty Overs — PHASE 1b: seasons in the relational spine.
--
-- 0024 stored one results row per completed match and derived the table from
-- them. It had no notion of a SEASON, so the first rollover would have carried
-- last season's wins into this season's table forever. The engine has always
-- stamped every result with its seasonNo; this migration stores it, makes it
-- part of a match's identity, and teaches the standings view to answer
-- "the table for league X, season N".
--
-- Safe to run on a database that already has 0024: the column is added with a
-- default of 1, so any rows already stored belong to season 1 — which they do.
--
-- OPERATOR NOTE — running this file is not enough on its own. PostgREST only
-- answers for schemas it has been told to expose. In the Supabase dashboard,
-- Settings -> API -> "Exposed schemas", add `game` alongside `app`. Until that
-- is done the umpire writes nothing to these tables and says so in its log
-- ("relational spine unavailable"); rounds resolve and publish exactly as
-- before, so nothing breaks — the rows simply do not appear.
-- ============================================================================

alter table game.results add column if not exists season_no int not null default 1;

-- A fixture is identified by its season as well as its round: rounds repeat
-- every season, and without this the second season's round 3 would overwrite
-- the first's.
alter table game.results drop constraint if exists results_league_id_comp_round_home_away_key;
alter table game.results drop constraint if exists results_season_key;
alter table game.results add constraint results_season_key
  unique (league_id, comp, season_no, round, home, away);

create index if not exists results_league_season on game.results (league_id, season_no, round);

-- The view gains a column, so it is replaced rather than patched (Postgres
-- will not let create-or-replace change a view's column list).
drop view if exists game.standings;
create view game.standings as
with seasons as (
  -- every season that has results, plus the season each league is playing now
  -- (so a table exists, all zeroes, from the moment a league is created)
  select league_id, season_no from game.results where comp = 'league'
  union
  select id, season_no from game.leagues
),
per_side as (
  select league_id, season_no, home as club, home_runs as rf,
         case when home_wkts >= 10 then 50.0 else home_balls / 6.0 end as ovf,
         away_runs as ra,
         case when away_wkts >= 10 then 50.0 else away_balls / 6.0 end as ova,
         case when winner is null then 't' when winner = home then 'w' else 'l' end as res
    from game.results where comp = 'league'
  union all
  select league_id, season_no, away, away_runs,
         case when away_wkts >= 10 then 50.0 else away_balls / 6.0 end,
         home_runs,
         case when home_wkts >= 10 then 50.0 else home_balls / 6.0 end,
         case when winner is null then 't' when winner = away then 'w' else 'l' end
    from game.results where comp = 'league'
),
grid as (
  select c.league_id, c.name as club, s.season_no
    from game.clubs c
    join seasons s on s.league_id = c.league_id
)
select g.league_id, g.season_no, g.club,
       count(p.club)::int                            as p,
       (count(*) filter (where p.res = 'w'))::int    as w,
       (count(*) filter (where p.res = 'l'))::int    as l,
       (count(*) filter (where p.res = 't'))::int    as t,
       (2 * count(*) filter (where p.res = 'w')
          + count(*) filter (where p.res = 't'))::int as pts,
       coalesce(sum(p.rf), 0)::int as rf,
       coalesce(sum(p.ra), 0)::int as ra,
       case when coalesce(sum(p.ovf), 0) > 0 and coalesce(sum(p.ova), 0) > 0
            then sum(p.rf) / sum(p.ovf) - sum(p.ra) / sum(p.ova)
            else 0 end as nrr
  from grid g
  left join per_side p
    on p.league_id = g.league_id and p.season_no = g.season_no and p.club = g.club
 group by g.league_id, g.season_no, g.club;

-- the view was dropped, so its grants went with it
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant select on game.standings to anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on game.standings to service_role';
  end if;
end $$;

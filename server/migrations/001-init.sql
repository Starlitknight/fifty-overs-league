-- 001-init.sql — the world's first schema. Additive-only by law (BLUEPRINT):
-- destructive migrations are forbidden; corrections are new migrations.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE worlds (
  id int PRIMARY KEY CHECK (id = 1),          -- one global world, by design
  epoch_ms bigint NOT NULL,                    -- world day 0 (16 May 2026 UTC)
  cycle_days int NOT NULL,
  league_rounds int NOT NULL,
  engine_version text NOT NULL
);
CREATE TABLE countries (
  id text PRIMARY KEY,                         -- 'eng'
  name text NOT NULL,
  play_hour_utc int NOT NULL,                  -- first ball, UTC
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE clubs (
  id serial PRIMARY KEY,
  country_id text NOT NULL REFERENCES countries(id),
  slot int NOT NULL,                           -- 0 = boss club, never claimable
  name text NOT NULL,
  ground text NOT NULL,
  is_boss boolean NOT NULL DEFAULT false,
  squad jsonb NOT NULL,                        -- engine-native players, generated once
  UNIQUE (country_id, slot)
);
CREATE TABLE seasons (
  id serial PRIMARY KEY,
  country_id text NOT NULL REFERENCES countries(id),
  season_no int NOT NULL,
  start_day int NOT NULL,                      -- world day of round 1
  schedule jsonb NOT NULL,                     -- [[ [homeSlot,awaySlot] x5 ] x18]
  UNIQUE (country_id, season_no)
);
CREATE TABLE matches (
  id text PRIMARY KEY,                         -- 'eng:s1:r3:h4a7' — seed derives from this
  country_id text NOT NULL REFERENCES countries(id),
  season_no int NOT NULL,
  round int NOT NULL,
  home_slot int NOT NULL,
  away_slot int NOT NULL,
  seed bigint NOT NULL,
  engine_version text NOT NULL,                -- stamped forever; never re-simulated
  pitch text NOT NULL,
  orders jsonb NOT NULL DEFAULT '{}'::jsonb,   -- frozen at window open (P3+: human orders)
  result jsonb NOT NULL,                       -- canonical engine output
  played_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, season_no, round, home_slot, away_slot)
);
CREATE TABLE ticks (
  key text PRIMARY KEY,                        -- 'eng:day:123' — the idempotency key
  status text NOT NULL CHECK (status IN ('running','done')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE snapshots (
  key text PRIMARY KEY,                        -- 'world/today', 'league/eng'
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_league_ix ON matches (country_id, season_no, round);

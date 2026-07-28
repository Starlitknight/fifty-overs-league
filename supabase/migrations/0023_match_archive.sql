-- ============================================================================
-- Fifty Overs — take the ball-by-ball out of the shared league state.
--
-- The league snapshot is downloaded, in full, by every device that opens the
-- game. Measured on a real league (10 clubs, 27 matches played) it is 1,897 KB,
-- and 1,145 KB of that — sixty per cent — is the ball-by-ball commentary log
-- and the ball-by-ball worm of a couple of matches. Nothing reads either one
-- until a manager opens that specific match's commentary. Everybody was
-- downloading them, on every load, for a page almost nobody opens.
--
-- They live here instead, one row per match, fetched only when asked for.
-- The snapshot keeps everything that gets read to draw a screen: the table,
-- the fixtures, the squads, the scorecards, the season aggregates.
-- ============================================================================

create table if not exists app.league_archive (
  league_id  uuid not null references app.leagues(id) on delete cascade,
  ix         int  not null,          -- index into the snapshot's results[], which is what #/scorecard?i= already uses
  sig        text not null,          -- home|away|round|season: proof this row is that match
  heavy      jsonb not null,         -- { log, worm } — whatever was lifted out
  updated_at timestamptz not null default now(),
  primary key (league_id, ix)
);

-- The index is only an identity while results[] is append-only. A relaunch
-- rebuilds it, and then row 12 is a different match than the one stored. The
-- signature is checked before anything is spliced in, so a stale row is
-- ignored rather than shown as the wrong match's commentary.

alter table app.league_archive enable row level security;

drop policy if exists la_read on app.league_archive;
create policy la_read on app.league_archive
  for select using (league_id in (select app.my_league_ids()));

-- Writes come from the resolver on the service role, which bypasses RLS.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on app.league_archive to service_role';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on app.league_archive to authenticated';
  end if;
end $$;

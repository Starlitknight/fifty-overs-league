-- ============================================================================
-- 0021: live-broadcast audience. Any league member on a live match view
-- heartbeats watch_match every ~25s; every member can read the roster, so
-- the broadcast hero can show who is watching right now and who dropped by.
-- Run in Supabase -> SQL Editor.
-- ============================================================================

create table if not exists app.league_watchers (
  league_id  uuid not null references app.leagues(id) on delete cascade,
  match_key  text not null,
  manager_id uuid not null,
  club       text not null default '',
  last_seen  timestamptz not null default now(),
  primary key (league_id, match_key, manager_id)
);

alter table app.league_watchers enable row level security;
drop policy if exists lw_read on app.league_watchers;
create policy lw_read on app.league_watchers for select
  using (league_id in (select app.my_league_ids()));
grant select on app.league_watchers to authenticated;

create or replace function app.watch_match(p_league_id uuid, p_key text, p_club text)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  insert into app.league_watchers(league_id, match_key, manager_id, club, last_seen)
    values (p_league_id, p_key, v_mid, coalesce(p_club, ''), now())
  on conflict (league_id, match_key, manager_id)
    do update set last_seen = now(), club = excluded.club;
end $$;
grant execute on function app.watch_match(uuid, text, text) to authenticated;

-- ============================================================================
-- 0022: cross-device cloud saves. One row per signed-in account holding the
-- device's fo_*/fol_* game state (career save, circuit progress, journey
-- flags). The client pushes after autosaves and offers to pull when another
-- device has written a newer copy. Owner-only via RLS on auth.uid().
-- Run in Supabase -> SQL Editor.
-- ============================================================================

create table if not exists app.player_saves (
  user_id    uuid primary key default auth.uid(),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app.player_saves enable row level security;
drop policy if exists ps_read on app.player_saves;
create policy ps_read on app.player_saves for select
  to authenticated using (user_id = auth.uid());
drop policy if exists ps_insert on app.player_saves;
create policy ps_insert on app.player_saves for insert
  to authenticated with check (user_id = auth.uid());
drop policy if exists ps_update on app.player_saves;
create policy ps_update on app.player_saves for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on app.player_saves to authenticated;

create or replace function app.tg_player_saves_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists player_saves_touch on app.player_saves;
create trigger player_saves_touch before update on app.player_saves
  for each row execute function app.tg_player_saves_touch();

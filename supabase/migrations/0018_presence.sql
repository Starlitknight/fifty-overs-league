-- 0018: manager presence. A tiny heartbeat so clubs can show whether their
-- manager is online. The game calls touch_presence every few minutes while
-- open; anything seen in the last 5 minutes reads as online.
alter table app.members add column if not exists last_seen timestamptz;

create or replace function app.touch_presence(p_league_id uuid)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  update app.members set last_seen = now() where id = v_mid;
end $$;

grant execute on function app.touch_presence(uuid) to authenticated;

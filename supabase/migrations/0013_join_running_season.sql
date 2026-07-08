-- ============================================================================
-- Fifty Overs — join a RUNNING season without the commissioner.
-- A member who has drafted their club may push an updated league snapshot in
-- which their club replaces a bot club. (push_league_state stays founder-only;
-- this is the one member-writable path, gated on having a drafted club.)
-- Run this in Supabase -> SQL Editor.
-- ============================================================================

create or replace function app.member_push_state(p_league_id uuid, p_snapshot jsonb, p_round int)
returns int language plpgsql security definer set search_path = app, public as $$
declare v_ver int; v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  if not exists (select 1 from app.league_clubs
                 where league_id = p_league_id and manager_id = v_mid) then
    raise exception 'draft your club before joining the season';
  end if;
  update app.league_state
     set snapshot = p_snapshot, version = version + 1, round = p_round,
         updated_by = v_mid, updated_at = now()
   where league_id = p_league_id
  returning version into v_ver;
  if v_ver is null then
    raise exception 'season has not started yet';
  end if;
  return v_ver;
end $$;

grant execute on function app.member_push_state(uuid, jsonb, int) to authenticated;

-- 0020: practice matches against computer clubs are recorded on the server
-- like challenge friendlies, so the live broadcast, the LIVE pill and the
-- Matches rows work on every device the manager signs in from (not just the
-- one that played the match). Practice games carry no league consequences,
-- so the client is trusted with the payload it just simulated.
create or replace function app.practice_record(
  p_league_id uuid, p_club text, p_opponent text, p_pitch text, p_weather text, p_result jsonb
) returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id); v_id uuid;
begin
  insert into app.league_challenges(league_id, challenger_mid, challenger_club, opponent_club, pitch, weather, play_at, status, result)
    values (p_league_id, v_mid, p_club, p_opponent, coalesce(p_pitch,'balanced'), coalesce(p_weather,'Sunny'), now(), 'played', p_result)
    returning id into v_id;
  return v_id;
end $$;
grant execute on function app.practice_record(uuid, text, text, text, text, jsonb) to authenticated;

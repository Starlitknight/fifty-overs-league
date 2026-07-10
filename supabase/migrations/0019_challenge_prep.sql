-- 0019: friendly lineups LOCK exactly one hour before kickoff. The resolver
-- only banks (resolves) a match after the lock, so a banked result always
-- uses exactly the lineups that were attached before it - a manager can
-- never attach a lineup and have the match play a different one.
create or replace function app.challenge_set_orders(p_id uuid, p_club text, p_orders jsonb)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_ch app.league_challenges; v_mid uuid;
begin
  select * into v_ch from app.league_challenges where id = p_id for update;
  if v_ch.id is null then raise exception 'challenge not found' using errcode = '22023'; end if;
  v_mid := app.resolve_manager_id(v_ch.league_id);   -- must be a league member
  if v_ch.status not in ('pending','accepted') then raise exception 'match already played' using errcode = '23505'; end if;
  if v_ch.play_at is not null and v_ch.play_at <= now() + interval '60 minutes' then
    raise exception 'lineups lock an hour before kickoff' using errcode = '23505';
  end if;
  update app.league_challenges set orders = orders || jsonb_build_object(p_club, p_orders) where id = p_id;
end $$;
grant execute on function app.challenge_set_orders(uuid, text, jsonb) to authenticated;

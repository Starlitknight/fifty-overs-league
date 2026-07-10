-- 0019: lineups may still be attached to a friendly that the resolver has
-- already banked, as long as kickoff is 15+ minutes away. The resolver
-- re-resolves banked challenges each pass (same deterministic seed), so a
-- late lineup replaces the auto-XI in the banked result.
create or replace function app.challenge_set_orders(p_id uuid, p_club text, p_orders jsonb)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_ch app.league_challenges; v_mid uuid;
begin
  select * into v_ch from app.league_challenges where id = p_id for update;
  if v_ch.id is null then raise exception 'challenge not found' using errcode = '22023'; end if;
  v_mid := app.resolve_manager_id(v_ch.league_id);   -- must be a league member
  if v_ch.status not in ('pending','accepted')
     and not (v_ch.status = 'played' and v_ch.play_at is not null and v_ch.play_at > now() + interval '15 minutes')
  then raise exception 'match already played' using errcode = '23505'; end if;
  update app.league_challenges set orders = orders || jsonb_build_object(p_club, p_orders) where id = p_id;
end $$;
grant execute on function app.challenge_set_orders(uuid, text, jsonb) to authenticated;

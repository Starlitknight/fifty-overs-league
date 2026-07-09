-- ============================================================================
-- Fifty Overs — human-vs-human challenge friendlies. The challenger names an
-- opponent club, pitch, weather and a play time; the opponent must accept
-- before the match is played. Both sides may attach a lineup until play time;
-- the resolver plays accepted challenges that have come due.
-- Run in Supabase -> SQL Editor.
-- ============================================================================

create table if not exists app.league_challenges (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references app.leagues(id) on delete cascade,
  challenger_mid  uuid not null,
  challenger_club text not null,
  opponent_club   text not null,
  pitch           text not null default 'balanced',
  weather         text not null default 'Sunny',
  play_at         timestamptz not null,
  status          text not null default 'pending',   -- pending/accepted/declined/played
  orders          jsonb not null default '{}'::jsonb, -- keyed by club name
  result          jsonb,
  created_at      timestamptz not null default now()
);

alter table app.league_challenges enable row level security;
drop policy if exists lc_read on app.league_challenges;
create policy lc_read on app.league_challenges for select
  using (league_id in (select app.my_league_ids()));
grant select on app.league_challenges to authenticated;

create or replace function app.challenge_create(
  p_league_id uuid, p_club text, p_opponent text, p_pitch text, p_weather text, p_play_at timestamptz
) returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id); v_id uuid;
begin
  if p_play_at < now() then raise exception 'pick a time in the future' using errcode = '22023'; end if;
  insert into app.league_challenges(league_id, challenger_mid, challenger_club, opponent_club, pitch, weather, play_at)
    values (p_league_id, v_mid, p_club, p_opponent, coalesce(p_pitch,'balanced'), coalesce(p_weather,'Sunny'), p_play_at)
    returning id into v_id;
  return v_id;
end $$;
grant execute on function app.challenge_create(uuid, text, text, text, text, timestamptz) to authenticated;

create or replace function app.challenge_respond(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_ch app.league_challenges; v_mid uuid;
begin
  select * into v_ch from app.league_challenges where id = p_id for update;
  if v_ch.id is null then raise exception 'challenge not found' using errcode = '22023'; end if;
  v_mid := app.resolve_manager_id(v_ch.league_id);
  if v_mid = v_ch.challenger_mid then raise exception 'you sent this challenge' using errcode = '42501'; end if;
  if v_ch.status <> 'pending' then raise exception 'already answered' using errcode = '23505'; end if;
  update app.league_challenges set status = case when p_accept then 'accepted' else 'declined' end where id = p_id;
end $$;
grant execute on function app.challenge_respond(uuid, boolean) to authenticated;

create or replace function app.challenge_set_orders(p_id uuid, p_club text, p_orders jsonb)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_ch app.league_challenges; v_mid uuid;
begin
  select * into v_ch from app.league_challenges where id = p_id for update;
  if v_ch.id is null then raise exception 'challenge not found' using errcode = '22023'; end if;
  v_mid := app.resolve_manager_id(v_ch.league_id);   -- must be a league member
  if v_ch.status not in ('pending','accepted') then raise exception 'match already played' using errcode = '23505'; end if;
  update app.league_challenges set orders = orders || jsonb_build_object(p_club, p_orders) where id = p_id;
end $$;
grant execute on function app.challenge_set_orders(uuid, text, jsonb) to authenticated;

-- resolver writes the result (service_role only)
create or replace function app.challenge_record_result(p_id uuid, p_result jsonb)
returns void language sql security definer set search_path = app, public as $$
  update app.league_challenges set result = p_result, status = 'played' where id = p_id;
$$;
revoke execute on function app.challenge_record_result(uuid, jsonb) from authenticated, anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant select on app.league_challenges to service_role';
    execute 'grant execute on function app.challenge_record_result(uuid, jsonb) to service_role';
  end if;
end $$;

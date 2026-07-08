-- ============================================================================
-- Fifty Overs — mid-season transfer market (computer-generated free agents).
-- The pool itself is generated deterministically on every client from the
-- league id + season, so only CLAIMS need the database: first successful
-- insert wins the player, everyone else sees "already claimed".
-- Run this in Supabase -> SQL Editor.
-- ============================================================================

create table if not exists app.league_market (
  league_id   uuid not null references app.leagues(id) on delete cascade,
  player_name text not null,
  player      jsonb not null,
  price       int  not null,
  manager_id  uuid not null,
  club        text not null,
  created_at  timestamptz not null default now(),
  primary key (league_id, player_name)
);

alter table app.league_market enable row level security;
drop policy if exists lm_read on app.league_market;
create policy lm_read on app.league_market for select
  using (league_id in (select app.my_league_ids()));
grant select on app.league_market to authenticated;

-- Atomic claim: the primary key makes double-claims impossible.
create or replace function app.market_claim(p_league_id uuid, p_player_name text, p_player jsonb, p_price int, p_club text)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  insert into app.league_market(league_id, player_name, player, price, manager_id, club)
    values (p_league_id, p_player_name, p_player, p_price, v_mid, p_club);
exception when unique_violation then
  raise exception 'already claimed';
end $$;

grant execute on function app.market_claim(uuid, text, jsonb, int, text) to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant select on app.league_market to service_role';
  end if;
end $$;

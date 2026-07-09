-- ============================================================================
-- Fifty Overs — predictions league. One row per manager per round; picks is
-- {"Home|Away": "predicted winner"}. Scored client-side against results.
-- Run this in Supabase -> SQL Editor.
-- ============================================================================

create table if not exists app.league_predictions (
  league_id   uuid not null references app.leagues(id) on delete cascade,
  manager_id  uuid not null,
  round       int  not null,
  picks       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (league_id, manager_id, round)
);

alter table app.league_predictions enable row level security;
drop policy if exists lp_read on app.league_predictions;
create policy lp_read on app.league_predictions for select
  using (league_id in (select app.my_league_ids()));
grant select on app.league_predictions to authenticated;

create or replace function app.predictions_submit(p_league_id uuid, p_round int, p_picks jsonb)
returns void language plpgsql security definer set search_path = app, public as $$
declare v_mid uuid := app.resolve_manager_id(p_league_id);
begin
  insert into app.league_predictions(league_id, manager_id, round, picks)
    values (p_league_id, v_mid, p_round, p_picks)
  on conflict (league_id, manager_id, round) do update set picks = excluded.picks;
end $$;

grant execute on function app.predictions_submit(uuid, int, jsonb) to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    execute 'grant select on app.league_predictions to service_role';
  end if;
end $$;

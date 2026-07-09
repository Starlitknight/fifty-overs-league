-- ============================================================================
-- Fifty Overs — one shareable league code. A multi-use invite (max_uses null
-- = unlimited) that every friend can redeem with the SAME code. Existing
-- invites stay single-use. Run in Supabase -> SQL Editor.
-- ============================================================================

alter table app.invites add column if not exists max_uses int;
alter table app.invites add column if not exists uses int not null default 0;
update app.invites set max_uses = 1 where max_uses is null;

-- Founder gets (or creates) the league's standing code.
create or replace function app.league_code(p_league_id uuid)
returns text language plpgsql security definer set search_path = app, public as $$
declare
  v_uid uuid := app.current_auth_uid();
  v_code text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from app.members where league_id = p_league_id and auth_uid = v_uid and role in ('founder','owner','admin')) then
    raise exception 'only the founder can issue the league code' using errcode = '42501';
  end if;
  select code into v_code from app.invites where league_id = p_league_id and max_uses is null limit 1;
  if v_code is not null then return v_code; end if;
  v_code := upper(substr(md5(p_league_id::text || clock_timestamp()::text), 1, 8));
  insert into app.invites(league_id, code, role, max_uses) values (p_league_id, v_code, 'manager', null);
  return v_code;
end $$;
grant execute on function app.league_code(uuid) to authenticated;

-- redeem_invite honours multi-use codes; single-use behaviour unchanged.
create or replace function app.redeem_invite(
  p_code text, p_display_name text, p_team_name text default null
) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare
  v_uid uuid := app.current_auth_uid();
  v_inv app.invites;
  v_mid uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_inv from app.invites where code = p_code for update;
  if v_inv.id is null then
    raise exception 'invalid invite code' using errcode = '22023';
  end if;
  if v_inv.max_uses = 1 and v_inv.redeemed_uid is not null then
    raise exception 'invite already redeemed' using errcode = '23505';
  end if;
  if v_inv.max_uses is not null and v_inv.max_uses > 1 and v_inv.uses >= v_inv.max_uses then
    raise exception 'invite code exhausted' using errcode = '23505';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'invite expired' using errcode = '22023';
  end if;
  if exists (select 1 from app.members where league_id = v_inv.league_id and auth_uid = v_uid) then
    raise exception 'already a member of this league' using errcode = '23505';
  end if;

  insert into app.members(league_id, auth_uid, role, display_name)
    values (v_inv.league_id, v_uid, v_inv.role, p_display_name)
    returning id into v_mid;

  insert into app.teams(league_id, manager_id, name, ground)
    values (v_inv.league_id, v_mid, coalesce(p_team_name, p_display_name || ' XI'), 'Neutral Ground');

  update app.invites
     set uses = uses + 1,
         redeemed_uid = case when max_uses = 1 then v_uid else redeemed_uid end,
         redeemed_by  = case when max_uses = 1 then v_mid else redeemed_by end,
         redeemed_at  = now()
   where id = v_inv.id;

  return v_mid;
end $$;

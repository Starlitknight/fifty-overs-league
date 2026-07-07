-- Create your FIRST league + founder, run once in the SQL Editor.
-- (create_league() normally needs a logged-in user; this bootstraps directly.)
--
-- Before running:
--  1) Sign up once: Dashboard → Authentication → Users → "Add user" (email +
--     password, tick "Auto Confirm User"), OR sign up from league.html. Then copy
--     that user's "User UID" from the Users list.
--  2) Replace PASTE_YOUR_USER_UID_HERE below (just once) with that UID.
--  3) (optional) change the league name / team name / match time / timezone.
--
-- The final line prints your LEAGUE ID — paste it into league.html.

with me as (select 'PASTE_YOUR_USER_UID_HERE'::uuid as uid),
new_league as (
  insert into app.leagues (name, founder_uid, build_hash, match_time, tz)
  select 'My League', uid,
         'e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff',  -- pinned engine build
         '17:00', 'UTC'
  from me
  returning id
),
new_member as (
  insert into app.members (league_id, auth_uid, role, display_name)
  select nl.id, me.uid, 'founder', 'Founder'
  from new_league nl, me
  returning id as manager_id, league_id
)
insert into app.teams (league_id, manager_id, name, ground)
select league_id, manager_id, 'Founder XI', 'Neutral Ground'
from new_member
returning league_id as your_league_id;

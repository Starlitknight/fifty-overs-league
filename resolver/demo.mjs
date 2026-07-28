// Set up and immediately play a DEMO match so a founder can watch a real game
// before inviting anyone: creates a demo opponent team, gives both teams a real
// engine squad, schedules a fixture due now, and resolves it.
//
//   node demo.mjs <league_id>
import { openEngine, resolveMatch, buildHash } from './resolve.mjs';
import { rpc, leaguePin, assertEnv } from './sbrest.mjs';
import { randomUUID } from 'node:crypto';

assertEnv();
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const leagueId = process.argv[2];
if (!leagueId) { console.error('usage: node demo.mjs <league_id>'); process.exit(1); }

const h = (extra) => Object.assign({
  apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json',
  'Content-Profile': 'app', 'Accept-Profile': 'app',
}, extra || {});
async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: h() });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return r.json();
}
async function insert(table, body, prefer) {
  const r = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: h({ Prefer: prefer || 'return=representation' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

// home = the founder's existing team
const teams = await get(`teams?league_id=eq.${leagueId}&select=id,manager_id,name,ground&order=created_at`);
if (!teams.length) throw new Error('no team in this league yet');
const home = teams[0];
console.log('home team:', home.name, home.id);

// a demo opponent (needs a member row to own the team)
const demoMember = (await insert('members', { league_id: leagueId, auth_uid: randomUUID(), role: 'manager', display_name: 'Demo Rivals' }))[0];
const demoTeam = (await insert('teams', { league_id: leagueId, manager_id: demoMember.id, name: 'Demo Rivals', ground: 'The Oval' }))[0];
console.log('demo opponent:', demoTeam.id);

// two real engine squads
const eng = await openEngine();
const pin = await leaguePin(leagueId);
const squads = await eng.page.evaluate(() => [GD.teams[0].players, GD.teams[1].players]);
await insert('squads?on_conflict=team_id', { team_id: home.id, league_id: leagueId, roster: squads[0], confirmed: true }, 'resolution=merge-duplicates,return=minimal');
await insert('squads?on_conflict=team_id', { team_id: demoTeam.id, league_id: leagueId, roster: squads[1], confirmed: true }, 'resolution=merge-duplicates,return=minimal');
console.log('squads set (both teams)');

// a fixture due one minute ago, then resolve it right now
const fx = (await insert('fixtures', {
  league_id: leagueId, season_no: 1, round: 1,
  home_team_id: home.id, away_team_id: demoTeam.id,
  ground: home.ground || 'Neutral Ground', pitch: 'balanced', weather: 'Sunny',
  seed: 424242, resolve_at: new Date(Date.now() - 60000).toISOString(), status: 'scheduled',
}))[0];
console.log('fixture:', fx.id);

await rpc('begin_resolve', { p_fixture_id: fx.id });
const inputs = await rpc('fixture_inputs', { p_fixture_id: fx.id });
const payload = await resolveMatch(eng.page, inputs, { pinnedHash: pin });
await rpc('store_official_result', { p_fixture_id: fx.id, p_payload: payload, p_build_hash: buildHash() });
await eng.close();
console.log('RESULT:', payload.result_text);
console.log('Done — open the app: Results + Table now show this match.');

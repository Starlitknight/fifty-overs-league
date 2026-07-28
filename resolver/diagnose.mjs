// Read-only diagnosis of a stuck league. Prints the facts that decide which
// branch of enterGame/syncTick a member lands in, so a hang can be reasoned
// about from evidence instead of guessed at. Writes nothing.
//
// Deliberately prints no secrets and no personal data beyond the club and
// manager names the game already shows every member in the league table.
//
//   node diagnose.mjs [leagueId]
import { assertEnv, rest } from './sbrest.mjs';

const kb = n => Math.round(n / 1024).toLocaleString() + ' KB';

(async () => {
  assertEnv();
  const only = process.argv[2] || null;
  const leagues = await rest('leagues?select=id,name,build_hash');
  const list = only ? (leagues || []).filter(l => l.id === only) : (leagues || []);

  for (const lg of list) {
    console.log('\n===== ' + lg.name + '  (' + lg.id + ')');

    // 1. the three calls enterGame makes before anything is drawn
    const teams = await rest(`teams?league_id=eq.${lg.id}&select=id,name,manager_id`);
    const members = await rest(`members?league_id=eq.${lg.id}&select=id,role,display_name`);
    console.log('teams: %d   members: %d', (teams || []).length, (members || []).length);
    for (const m of members || []) {
      const t = (teams || []).find(x => x.manager_id === m.id);
      console.log('   member %s  role=%-8s  team=%s', (m.display_name || '(no name)').padEnd(18), m.role, t ? t.name : '— NONE —');
    }

    // 2. the state the loader then waits on
    const st = (await rest(`league_state?league_id=eq.${lg.id}&select=snapshot,version,round`))[0];
    if (!st) { console.log('league_state: MISSING  -> every member goes to preStart (lobby)'); continue; }
    const snap = st.snapshot || {};
    const bytes = JSON.stringify(snap).length;
    console.log('league_state: version=%s round=%s  snapshot=%s  results=%d  teams-in-snap=%d',
      st.version, st.round, kb(bytes), (snap.results || []).length, (snap.teams || []).length);
    console.log('snapshot teams: %s', (snap.teams || []).map(t => t.name + (t.founded ? '*' : '')).join(', ') || '(none)');

    // 3. THE DECIDING QUESTION: is each member's club in that snapshot? A "no"
    //    sends them down the rejoin/relaunch path, which is where a member can
    //    be left staring at the loading card.
    const clubs = await rest(`league_clubs?league_id=eq.${lg.id}&select=manager_id,club`);
    for (const m of members || []) {
      const t = (teams || []).find(x => x.manager_id === m.id);
      const inSnap = t ? (snap.teams || []).some(s => s && s.name === t.name) : false;
      const row = (clubs || []).find(c => c.manager_id === m.id);
      const clubEpoch = row && row.club ? (row.club.__foEpoch || 0) : null;
      console.log('   %s  team=%-22s inSnapshot=%-5s  hasClubRow=%-5s  clubEpoch=%s',
        (m.display_name || '?').padEnd(18), t ? t.name : '(none)', inSnap, !!row, clubEpoch);
    }
    const snapEpoch = Math.max(0, ...(snap.teams || []).map(t => +(t && t.__foEpoch) || 0));
    console.log('snapshot epoch: %s  (a club whose epoch is older sees the relaunch gate)', snapEpoch || '(none)');

    // 4. anything that would make the first three calls fail rather than hang
    console.log('build_hash pinned on league: %s', lg.build_hash || '(none)');
  }
})();

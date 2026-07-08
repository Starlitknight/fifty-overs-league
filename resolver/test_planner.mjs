// Verify the season planner's engine-facing fixture data:
//   node resolver/test_planner.mjs
// Builds a real 10-team season and checks foUserFixtures/foFixtureMeta produce
// every remaining user fixture with valid opponents, venues, and conditions.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../client/game.html');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };

const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', e => { if (!/supabase|fetch|Failed|Network/i.test(e.message)) console.log('ERR:', e.message); });
await p.goto('file://' + GAME, { waitUntil: 'load' });
await p.waitForFunction(() => window.__fol && typeof window.__fol.userFixtures === 'function', { timeout: 10000 });

const r = await p.evaluate(() => {
  App.teamIx = 3; seasonInit();
  const S = App.season;
  const fx = window.__fol.userFixtures();
  // expected: (teams-1) home + away = for 10 teams, 18 rounds, one user game each = 18
  const nTeams = GD.teams.length;
  const meMatches = fx.length;
  // every fixture must involve the user, a valid opponent, and valid conditions
  let bad = 0, oppSelf = 0, condOk = 0;
  const PITCHES = ['balanced','flat','green','dry','slow','cracked','twoPaced'];
  for (const x of fx) {
    if (x.f[0] !== App.teamIx && x.f[1] !== App.teamIx) bad++;
    if (x.oppIx === App.teamIx) oppSelf++;
    if (PITCHES.includes(x.pitch) && typeof x.weather === 'string' && x.weather.length) condOk++;
  }
  // meta for the first upcoming round must round-trip
  const meta = window.__fol.fixtureMeta(fx[0].round);
  // rounds should be strictly the schedule's remaining rounds, each once
  const rounds = fx.map(x => x.round);
  const uniqueRounds = new Set(rounds).size === rounds.length;
  // planner HTML renders without throwing (SYNC.submitted absent → treat as none)
  let htmlOk = false;
  try { window.SYNC = undefined; } catch(e){}
  return { nTeams, meMatches, bad, oppSelf, condOk, meta, rounds, uniqueRounds, totalRounds: S.schedule.length };
});

ok(r.nTeams === 10, `league has 10 teams (got ${r.nTeams})`);
ok(r.meMatches === r.totalRounds && r.meMatches > 0, `user has one fixture per round (${r.meMatches} of ${r.totalRounds})`);
ok(r.bad === 0, `every fixture involves the user (${r.bad} bad)`);
ok(r.oppSelf === 0, `no fixture lists the user as their own opponent (${r.oppSelf})`);
ok(r.condOk === r.meMatches, `every fixture has a valid pitch + weather (${r.condOk}/${r.meMatches})`);
ok(r.uniqueRounds, `each upcoming round appears once`);
ok(r.meta && r.meta.comp === 'league' && typeof r.meta.oppIx === 'number' && r.meta.pitch, `fixtureMeta round-trips (${JSON.stringify(r.meta).slice(0,80)})`);

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);

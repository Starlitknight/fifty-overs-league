// Pure client-logic tests: hash-pin guard + renderers. No browser needed.
//   node client/tests/render.test.mjs
import { BUILD_HASH, guardBuildHash, renderStandings, renderFixtures, renderVerifyBadge, esc }
  from '../mp.js';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };

// ---- hash-pin guard ----
ok(guardBuildHash(BUILD_HASH).ok, 'matching build hash passes the guard');
const mism = guardBuildHash('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
ok(!mism.ok && /does not match/.test(mism.message), 'a mismatched league pin blocks the client');
ok(!guardBuildHash(null).ok, 'a league with no pin is blocked');
ok(!guardBuildHash('xxxx', 'yyyy').ok, 'explicit client hash is honored (xxxx != yyyy)');

// ---- escaping ----
ok(esc(`<script>&"'`) === '&lt;script&gt;&amp;&quot;&#39;', 'esc neutralizes HTML metacharacters');

// ---- standings render ----
const rows = [
  { pos: 1, team_id: 'A', team_name: 'Yorkshire', p: 2, w: 2, l: 0, t: 0, pts: 4, nrr: 1.234 },
  { pos: 2, team_id: 'B', team_name: 'Surrey', p: 2, w: 0, l: 2, t: 0, pts: 0, nrr: -1.234 },
];
const sHtml = renderStandings(rows, 'B');
ok(sHtml.includes('Yorkshire') && sHtml.includes('Surrey'), 'standings lists all teams');
ok(sHtml.includes('+1.234') && sHtml.includes('-1.234'), 'NRR is signed and 3dp');
ok(/<tr class="me"[^]*Surrey/.test(sHtml), 'my team row is highlighted');
ok(sHtml.includes('<b>4</b>'), 'points are shown');

// ---- fixtures render ----
const teamsById = { A: { name: 'Yorkshire' }, B: { name: 'Surrey' } };
const fixtures = [
  { id: 'f1', round: 1, home_team_id: 'A', away_team_id: 'B', resolve_at: '2026-07-04T17:00:00Z', status: 'resolved', result_text: 'Yorkshire win by 20 runs' },
  { id: 'f2', round: 2, home_team_id: 'B', away_team_id: 'A', resolve_at: '2026-07-05T17:00:00Z', status: 'scheduled' },
];
const fHtml = renderFixtures(fixtures, teamsById);
ok(fHtml.includes('Yorkshire win by 20 runs'), 'a resolved fixture shows its result text');
ok(fHtml.includes('badge scheduled'), 'a scheduled fixture shows a status badge');
ok(fHtml.includes('2026-07-04 17:00'), 'kickoff time is formatted');

// ---- verify badge ----
ok(renderVerifyBadge({ ok: true, reason: 'ok' }).includes('verified'), 'verified badge for honest result');
ok(renderVerifyBadge({ ok: false, reason: 'scorecard mismatch' }).includes('mismatch'), 'mismatch badge for tampered result');

console.log(`\n${pass} passed, ${fail} failed`);

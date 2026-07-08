// Verify the overlay's condition-aware "Suggest all" bowling planner:
//   node resolver/test_smart_bowling.mjs
// Loads the BUILT game (engine + overlay), makes a real team, and for a spread of
// pitches/weathers calls window.suggestOrders() and checks the resulting plan:
//   * exactly 50 overs covered, no gaps
//   * no bowler over 10 overs, none on back-to-back overs
//   * spell lengths are a varied mix within 2..5
//   * pace bowlers get the bulk on seaming decks, spin on turners
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../client/game.html');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => { if (!/supabase|fetch|Failed to|NetworkError/i.test(e.message)) console.log('PAGEERROR:', e.message); });
await page.goto('file://' + GAME, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.suggestOrders === 'function' && typeof window.genDraftPool === 'function', { timeout: 10000 });

// GD.teams is preloaded with the engine's default world; plan for its first club.
const boot = await page.evaluate(() => {
  App.teamIx = 0;
  App.orders = { batOrder: [], captain: null, keeper: null, spells: { north: [], south: [] }, grid: null };
  const xi = pickXI(userTeam());
  return { team: userTeam().name, xiLen: xi.length, bowlers: xi.filter(p => p.bowlType && !isPT(p)).length };
});
ok(boot.xiLen === 11, `${boot.team}: XI has 11 players (got ${boot.xiLen})`);
ok(boot.bowlers >= 5, `${boot.team}: XI has 5+ frontline bowlers (got ${boot.bowlers})`);

const SCENARIOS = [
  { pitch: 'green', weather: 'overcast', want: 'pace' },
  { pitch: 'dry', weather: 'hot', want: 'spin' },
  { pitch: 'flat', weather: 'sunny', want: null },
  { pitch: 'cracked', weather: 'humid', want: null },
  { pitch: 'balanced', weather: 'sunny', want: null },
];

for (const sc of SCENARIOS) {
  const r = await page.evaluate((sc) => {
    App.pending = { home: userTeam().name, away: 'Opp', ground: userTeam().ground, pitch: sc.pitch, weather: sc.weather, seed: 42, date: '2026-01-01' };
    App.orders.spells = { north: [], south: [] };
    App.orders.grid = null;
    window.suggestOrders();
    const sp = App.orders.spells;
    // rebuild the per-over plan the way compilePlan does
    const plan = new Array(51).fill(null);
    const tot = {}, lens = [];
    let backToBack = 0;
    for (const end of ['north', 'south']) {
      for (const s of sp[end]) {
        lens.push(s.n);
        for (let k = 0; k < s.n; k++) { const ov = s.first + 2 * k; if (ov >= 1 && ov <= 50) { plan[ov] = s.bowler; tot[s.bowler] = (tot[s.bowler] || 0) + 1; } }
      }
    }
    for (let o = 1; o < 50; o++) if (plan[o] && plan[o] === plan[o + 1]) backToBack++;
    const covered = plan.filter(Boolean).length;
    const maxOvers = Math.max(0, ...Object.values(tot));
    // conditions check: which bowler TYPE bowled the most overs
    const t = userTeam(), typeOf = {};
    t.players.forEach(p => { if (p.bowlType) typeOf[p.name] = window.typeClass(p.bowlType); });
    let paceOvers = 0, spinOvers = 0;
    for (const nm in tot) { if (typeOf[nm] === 'pace') paceOvers += tot[nm]; else if (typeOf[nm] === 'spin') spinOvers += tot[nm]; }
    // who takes the new ball (over 1 north / over 2 south)?
    const newBall = [plan[1], plan[2]].map(nm => typeOf[nm] || '?');
    // count spinners bowling in the first 10 overs (should be 0 when pace exists)
    const paceCount = t.players.filter(p => p.bowlType && window.typeClass(p.bowlType) === 'pace').length;
    let spinPowerplay = 0;
    for (let o = 1; o <= 10; o++) if (typeOf[plan[o]] === 'spin') spinPowerplay++;
    return { covered, maxOvers, backToBack, lens, minLen: Math.min(...lens), maxLen: Math.max(...lens), uniq: [...new Set(lens)].length, paceOvers, spinOvers, newBall, spinPowerplay, paceCount, spellCount: lens.length };
  }, sc);

  const tag = `[${sc.pitch}/${sc.weather}]`;
  ok(r.covered === 50, `${tag} covers all 50 overs (got ${r.covered})`);
  ok(r.maxOvers <= 10, `${tag} no bowler over 10 (max ${r.maxOvers})`);
  ok(r.backToBack === 0, `${tag} no back-to-back overs (${r.backToBack})`);
  ok(r.minLen >= 2 && r.maxLen <= 5, `${tag} spell lengths within 2..5 (${r.minLen}..${r.maxLen})`);
  ok(r.uniq >= 2, `${tag} varied spell lengths (${r.uniq} distinct: ${r.lens.join(',')})`);
  // On seaming decks a pace bowler should get the new ball; on turners spin gets a real share.
  if (sc.want === 'pace') ok(r.newBall.includes('pace'), `${tag} pace takes the new ball (${r.newBall.join('/')})`);
  if (sc.want === 'spin') ok(r.spinOvers >= paceFloor(r), `${tag} spin gets a real share (${r.spinOvers} spin vs ${r.paceOvers} pace)`);
  // No spinner in the powerplay whenever the side has 2+ seamers to cover both ends.
  if (r.paceCount >= 2) ok(r.spinPowerplay === 0, `${tag} no spin in overs 1-10 (${r.spinPowerplay} spin overs, ${r.paceCount} seamers)`);
}
function paceFloor(r) { return Math.min(r.paceOvers, 15); }

// Sweep every default club (varying bowler counts exercise the disjoint-group and
// straddler paths) and assert the core invariants hold for each.
const sweep = await page.evaluate(() => {
  const out = [];
  for (let i = 0; i < GD.teams.length; i++) {
    App.teamIx = i;
    App.orders = { batOrder: [], captain: null, keeper: null, spells: { north: [], south: [] }, grid: null };
    App.pending = { home: userTeam().name, away: 'Opp', ground: userTeam().ground, pitch: 'balanced', weather: 'sunny', seed: 1, date: 'x' };
    window.suggestOrders();
    const sp = App.orders.spells, plan = new Array(51).fill(null), tot = {}; let bad = 0, lens = [];
    for (const end of ['north', 'south']) for (const s of sp[end]) {
      lens.push(s.n);
      for (let k = 0; k < s.n; k++) { const ov = s.first + 2 * k; if (ov >= 1 && ov <= 50) { plan[ov] = s.bowler; tot[s.bowler] = (tot[s.bowler] || 0) + 1; } }
    }
    for (let o = 1; o < 50; o++) if (plan[o] && plan[o] === plan[o + 1]) bad++;
    const nb = App.teams ? 0 : 0;
    out.push({ team: userTeam().name, bowlers: pickXI(userTeam()).filter(p => p.bowlType && !isPT(p)).length, covered: plan.filter(Boolean).length, maxOvers: Math.max(0, ...Object.values(tot)), backToBack: bad, minLen: Math.min(...lens), maxLen: Math.max(...lens) });
  }
  return out;
});
for (const s of sweep) {
  const okAll = s.covered === 50 && s.maxOvers <= 10 && s.backToBack === 0 && s.minLen >= 2 && s.maxLen <= 5;
  ok(okAll, `sweep ${s.team} (${s.bowlers} bowlers): cover=${s.covered} max=${s.maxOvers} b2b=${s.backToBack} len=${s.minLen}..${s.maxLen}`);
}

// Synthetic all-rounder XI (many frontline bowlers) exercises the disjoint-group
// path where no straddler is needed.
const many = await page.evaluate(() => {
  const base = pickXI(GD.teams[0]).map(p => JSON.parse(JSON.stringify(p)));
  const types = ['fast', 'fastMedium', 'medium', 'wristSpin', 'fingerSpin'];
  base.forEach((p, i) => { p.bowlType = types[i % types.length]; p.bowlTypeFull = p.bowlType; p.threat = 40 + (i * 5) % 50; p.control = 45 + (i * 7) % 45; p.talents = p.talents || []; });
  GD.teams.push({ name: 'All-Rounders XI', ground: 'Test Park', homePitch: 'balanced', players: base, youth: [], bank: 300000 });
  App.teamIx = GD.teams.length - 1;
  App.orders = { batOrder: [], captain: null, keeper: null, spells: { north: [], south: [] }, grid: null };
  App.pending = { home: 'All-Rounders XI', away: 'Opp', ground: 'Test Park', pitch: 'green', weather: 'overcast', seed: 1, date: 'x' };
  window.suggestOrders();
  const sp = App.orders.spells, plan = new Array(51).fill(null), tot = {}; let bad = 0, lens = [];
  for (const end of ['north', 'south']) for (const s of sp[end]) { lens.push(s.n); for (let k = 0; k < s.n; k++) { const ov = s.first + 2 * k; if (ov >= 1 && ov <= 50) { plan[ov] = s.bowler; tot[s.bowler] = (tot[s.bowler] || 0) + 1; } } }
  for (let o = 1; o < 50; o++) if (plan[o] && plan[o] === plan[o + 1]) bad++;
  return { bowlers: pickXI(userTeam()).filter(p => p.bowlType && !isPT(p)).length, covered: plan.filter(Boolean).length, maxOvers: Math.max(0, ...Object.values(tot)), backToBack: bad, minLen: Math.min(...lens), maxLen: Math.max(...lens), used: Object.keys(tot).length };
});
ok(many.bowlers >= 6, `synthetic XI has 6+ frontline bowlers (got ${many.bowlers})`);
ok(many.covered === 50 && many.maxOvers <= 10 && many.backToBack === 0 && many.minLen >= 2 && many.maxLen <= 5,
  `disjoint path valid: cover=${many.covered} max=${many.maxOvers} b2b=${many.backToBack} len=${many.minLen}..${many.maxLen} used=${many.used}`);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);

#!/usr/bin/env node
/* tools/spell-probe.mjs — PHASE 2A'S INSTRUMENT: SPELLS AND REST, MEASURED.
 *
 * Phase 2A adds two connected mechanics (engine/src/00-core.js):
 *   1. the spell CONTINUATION GATE in aiPickBowler — this end's active
 *      bowler carries on while he scores within FO_SPELL.margin of the top
 *      of the captain's own ranking
 *   2. OFF-SPELL RECOVERY in apply() — every legal ball, bowling-side men
 *      who are not bowling and not mid-spell recover toward a floor of
 *      0.35 x their peak tank
 *
 * Both are runtime-switchable (__foSpellOff / __foRestOff) and runtime-
 * tunable (__foSpellMargin / __foRestR / __foRestFloor), so this probe can
 * sweep candidate laws against the SHIPPED build without rebuilding, and
 * A/B the finished engine against the audit baseline on paired seeds.
 *
 *   node tools/spell-probe.mjs --margins --n=80      # §1 margin sweep
 *   node tools/spell-probe.mjs --types --n=80        # §2 chosen margin x type x pitch
 *   node tools/spell-probe.mjs --laws                # §3 candidate recovery laws (pure math)
 *   node tools/spell-probe.mjs --return --n=150      # §4 forced rest/return scenarios
 *   node tools/spell-probe.mjs --cricket --n=200     # §5 five-v-six, stamina pair, death saver
 *   node tools/spell-probe.mjs --capt --n=240        # §6 captaincy re-measure
 *   node tools/spell-probe.mjs --orders              # §7 manual plans execute exactly
 *   node tools/spell-probe.mjs --ab --n=400          # §8 old-v-new environment
 *   node tools/spell-probe.mjs --all --json > evidence.json
 *
 * IT CHANGES NOTHING ITSELF: a reader of the built page, like every probe
 * in the audit family.
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, distStats, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '120'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const set = expr => vm.runInContext(expr, H.ctx);
const NEW = () => set('__foSpellOff=0;__foRestOff=0;__foSpellMargin=undefined;__foRestR=undefined;__foRestFloor=undefined;1');
const OLD = () => set('__foSpellOff=1;__foRestOff=1;1');

// spell ledger of one bowling innings: same-end runs of overs, exactly the
// engine's own definition (appearances two overs apart)
function spellsOf(inn) {
  const runs = {}, spells = [];
  for (let o = 0; o < inn.overBowl.length; o++) {
    const nm = inn.overBowl[o]; if (!nm) continue;
    const cur = runs[nm];
    if (cur && cur.last === o - 2) { cur.len++; cur.last = o; }
    else { if (cur) spells.push({ nm, len: cur.len }); runs[nm] = { len: 1, last: o }; }
  }
  for (const nm in runs) spells.push({ nm, len: runs[nm].len });
  return spells;
}
function spellStats(allSpells, maxes) {
  const n = allSpells.length || 1;
  const share = pred => allSpells.filter(pred).length / n;
  return {
    one: share(s => s.len === 1), two: share(s => s.len === 2),
    mid: share(s => s.len >= 3 && s.len <= 5), long: share(s => s.len >= 6),
    mean: allSpells.reduce((a, s) => a + s.len, 0) / n,
    maxMean: summary(maxes).mean,
    over36: maxes.filter(x => x >= 36).length / Math.max(1, maxes.length)
  };
}
function collectSpells(A, B, n, opts, seed0) {
  const all = [], maxes = [], con = [], ow = [], win = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, (seed0 || 700001) + i * 104729, opts || {});
    if (!r) continue;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;
      all.push(...spellsOf(inn));
      for (const nm in inn.bowlers) maxes.push(inn.bowlers[nm].maxSpell || 0);
      con.push(per50(inn.runs, inn.legal)); ow.push(inn.wkts);
    }
    win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
  }
  return { ...spellStats(all, maxes), conceded: summary(con), oppWkts: summary(ow), win: summary(win) };
}
const line = (lbl, s) =>
  `  ${lbl.padEnd(16)} 1ov ${f(s.one * 100, 1)}%  2ov ${f(s.two * 100, 1)}%  3-5 ${f(s.mid * 100, 1)}%  6+ ${f(s.long * 100, 1)}%  mean ${f(s.mean, 2)}  maxSpB ${f(s.maxMean, 1)}  >=36 ${f(s.over36 * 100, 1)}%  conc ${f(s.conceded.mean, 1)}  wk ${f(s.oppWkts.mean, 2)}`;

// ---------------------------------------------------------------------------
// §1 THE MARGIN, SWEPT. Continuation margin x captaincy on the ordinary
// side, recovery ON at its default so the two mechanics are judged together.
// The OFF row is the audit baseline.
// ---------------------------------------------------------------------------
if (has('margins') || has('all')) {
  say('\n=== §1 CONTINUATION MARGIN x CAPTAINCY (N=' + N + ', balanced) ===');
  const B0 = H.side('B', {});
  out.margins = [];
  for (const capt of [20, 40, 60, 80, 95]) {
    const A = H.side('A', { slots: [{ slot: 0, capt }] });
    say(`  capt ${capt}:`);
    for (const mg of ['OFF', 0, 4, 8, 12, 16]) {
      if (mg === 'OFF') OLD(); else { NEW(); set('__foSpellMargin=' + mg + ';1'); }
      const s = collectSpells(A, B0, N, {});
      say(line('   margin ' + mg, s));
      out.margins.push({ capt, margin: mg, ...s });
    }
  }
  NEW();
}

// ---------------------------------------------------------------------------
// §2 THE CHOSEN LAW BY TRADE AND SURFACE. Spell length per bowling type at
// the default margin — does a spinner naturally hold a longer spell on dry
// without any type-specific rule?
// ---------------------------------------------------------------------------
if (has('types') || has('all')) {
  say('\n=== §2 SPELLS BY TYPE x PITCH (default law, capt 60, N=' + N + ') ===');
  NEW();
  const B0 = H.side('B', {});
  const A = H.side('A', { slots: [{ slot: 0, capt: 60 }] });
  out.types = [];
  for (const pitch of ['balanced', 'green', 'dry', 'flat']) {
    const perType = {};
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 700001 + i * 104729, { pitch });
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        for (const s of spellsOf(inn)) (perType[s.nm] = perType[s.nm] || []).push(s.len);
      }
    }
    const TY = { 'A-bowl0': 'fastMedium', 'A-bowl1': 'fast', 'A-bowl2': 'medium',
      'A-bowl3': 'fingerSpin', 'A-bowl4': 'wristSpin' };
    say(`  ${pitch}:`);
    for (const nm in TY) {
      const xs = perType[nm] || [];
      const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
      const long = xs.length ? xs.filter(x => x >= 6).length / xs.length : 0;
      const tot = xs.reduce((a, b) => a + b, 0) / Math.max(1, N);   // overs/innings (both innings pooled /N fixtures)
      say(`    ${TY[nm].padEnd(11)} mean spell ${f(mean, 2)}  6+ ${f(long * 100, 1)}%  overs/fixture ${f(tot, 2)}`);
      out.types.push({ pitch, type: TY[nm], meanSpell: mean, longShare: long, oversPerFixture: tot });
    }
  }
}

// ---------------------------------------------------------------------------
// §3 CANDIDATE RECOVERY LAWS, PURE ARITHMETIC. The accrual law is the
// engine's own (fatLaws); the candidate decay laws are simulated over the
// brief's rest patterns, and the resulting tanks priced by exact ballDist.
// This is where "should stamina touch recovery" is answered.
// ---------------------------------------------------------------------------
if (has('laws') || has('all')) {
  say('\n=== §3 CANDIDATE RECOVERY LAWS (exact) ===');
  const perBall = st => H.fatLaws({ bowlTypeFull: 'seamFast', age: 27, skills: { stamina: st } }).perBallBowl;
  const play = (st, spellOvers, restOvers, law) => {
    let fat = 0, pk = 0;
    const acc = perBall(st);
    for (let b = 0; b < spellOvers * 6; b++) { fat += acc; if (fat > pk) pk = fat; }
    for (let b = 0; b < restOvers * 6; b++) {
      const r = law.stam ? law.r * (0.7 + st / 150) : law.r;
      const fl = law.floor * pk;
      if (fat > fl) fat = fl + (fat - fl) * (1 - r);
    }
    return { fat, pk };
  };
  const LAWS = [
    ['none (audit)', { r: 0, floor: 0 }],
    ['r .008 fl .35', { r: 0.008, floor: 0.35 }],
    ['r .0165 fl .35', { r: 0.0165, floor: 0.35 }],
    ['r .030 fl .35', { r: 0.030, floor: 0.35 }],
    ['r .0165 fl .20', { r: 0.0165, floor: 0.20 }],
    ['r .0165 fl .50', { r: 0.0165, floor: 0.50 }],
    ['r .0165 stamina-scaled', { r: 0.0165, floor: 0.35, stam: true }]
  ];
  out.laws = [];
  say('  after a 5-over spell (stamina 55), tank by overs rested / RPO on return:');
  say('  law                    rest2   rest5   rest10  rest20   rpo@rest5');
  for (const [lbl, law] of LAWS) {
    const row = [2, 5, 10, 20].map(ro => play(55, 5, ro, law).fat);
    const rpo = distStats(H.dist({}, { bowlTypeFull: 'seamFast' }, { over: 35, faced: 30, bowlFat: row[1] })).rpo;
    say(`  ${lbl.padEnd(22)} ${row.map(x => f(x, 3)).join(' ')}  ${f(rpo)}`);
    out.laws.push({ lbl, tanks: row, rpoAtRest5: rpo });
  }
  say('\n  stamina x recovery under the flat default v the stamina-scaled candidate');
  say('  (7-over spell then 10 off; tank on return):');
  say('  stamina    flat     scaled   [accrual alone already separates them]');
  out.lawsStam = [];
  for (const st of [30, 45, 60, 75, 90]) {
    const a = play(st, 7, 10, { r: 0.0165, floor: 0.35 }).fat;
    const b = play(st, 7, 10, { r: 0.0165, floor: 0.35, stam: true }).fat;
    say(`    ${String(st).padStart(2)}    ${f(a, 3)}  ${f(b, 3)}`);
    out.lawsStam.push({ st, flat: a, scaled: b });
  }
}

// ---------------------------------------------------------------------------
// §4 FORCED REST-AND-RETURN (manual plans, so the pattern is exact).
// The new-ball quick bowls three plans; his death effectiveness and tank
// tell whether preserving him now means anything. OLD v NEW on each plan.
// ---------------------------------------------------------------------------
// A COMPLETE fifty-over plan from same-end blocks. Every over is named, so
// the AI cannot quietly hand the studied bowler extra overs outside his
// pattern. blocks: [[name, startIdx(0-based over), overs]], each occupying
// startIdx, startIdx+2, ... — one end. Validates the laws it must obey.
function mkPlan(blocks) {
  const compiled = new Array(50).fill(null);
  for (const [nm, start, n] of blocks)
    for (let k = 0; k < n; k++) {
      const o = start + 2 * k;
      if (compiled[o]) throw new Error('plan collision at over ' + o);
      compiled[o] = nm;
    }
  const tally = {};
  compiled.forEach((nm, o) => {
    if (!nm) throw new Error('plan leaves over ' + o + ' open');
    tally[nm] = (tally[nm] || 0) + 1;
    if (o > 0 && compiled[o - 1] === nm) throw new Error(nm + ' bowls consecutive overs at ' + o);
  });
  for (const nm in tally) if (tally[nm] > 10) throw new Error(nm + ' has ' + tally[nm] + ' overs');
  return { compiled };
}
// the standing fill around A-bowl0's pattern: a six-option side (the No.5
// bat bowls part-time seam) so the other end and the leftovers stay legal
// whatever pattern the studied man bowls
const FILL = {
  b1: 'A-bowl1', b2: 'A-bowl2', b3: 'A-bowl3', b4: 'A-bowl4', b6: 'A-bat4'
};
function deathEconOf(inn, nm) {
  let runs = 0, balls = 0;
  for (let o = 40; o < inn.overBowl.length; o++) {
    if (inn.overBowl[o] !== nm) continue;
    const prev = o > 0 ? (inn.cumRuns[o - 1] ?? 0) : 0;
    runs += (inn.cumRuns[o] ?? prev) - prev; balls += 6;
  }
  return balls ? { rpo: runs * 6 / balls, overs: balls / 6 } : null;
}
if (has('return') || has('all')) {
  say('\n=== §4 REST AND RETURN, ORDERED EXACTLY (N=' + Math.min(N, 150) + ') ===');
  const B0 = H.side('B', {});
  const A = H.side('A', { sixth: true, sixthLevel: 52 });
  const { b1, b2, b3, b4, b6 } = FILL;
  const B0P = 'A-bowl0';
  const PLANS = [
    // every plan covers all fifty overs; only A-bowl0's pattern varies
    ['6 straight, done', mkPlan([[B0P, 0, 6], [b2, 12, 10], [b6, 32, 9],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])],
    ['4 on, 10 off, 2 on', mkPlan([[B0P, 0, 4], [b2, 8, 10], [B0P, 28, 2], [b6, 32, 9],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])],
    ['4 on, back at death', mkPlan([[B0P, 0, 4], [b2, 8, 10], [b6, 28, 9], [B0P, 46, 2],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])],
    ['10 straight', mkPlan([[B0P, 0, 10], [b2, 20, 10], [b6, 40, 5],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])],
    ['death only 41-50', mkPlan([[b2, 0, 10], [b6, 20, 10], [B0P, 40, 5],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])]
  ];
  out.ret = [];
  for (const [mode, fn] of [['OLD', OLD], ['NEW', NEW]]) {
    fn();
    say(`  ${mode}:`);
    for (const [lbl, plan] of PLANS) {
      const econ = [], dEcon = [], dTank = [], wk = [];
      for (let i = 0; i < Math.min(N, 150); i++) {
        const r = H.run(A, B0, 700001 + i * 104729, { ordersA: plan, traceFat: 'A-bowl0' });
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam === 'A') continue;
          const b = inn.bowlers['A-bowl0'];
          if (b && b.b > 0) { econ.push(b.r * 6 / b.b); wk.push(b.w); }
          const d = deathEconOf(inn, 'A-bowl0');
          if (d) dEcon.push(d.rpo);
        }
        const t45 = (r.trace || []).find(t => t.over === 45);
        if (t45) dTank.push(t45.fat);
      }
      const E = summary(econ), D = summary(dEcon), T = summary(dTank), W = summary(wk);
      say(`    ${lbl.padEnd(22)} econ ${f(E.mean)}±${E.se.toFixed(2)}  wk/inn ${f(W.mean, 2)}  death rpo ${dEcon.length ? f(D.mean) + '±' + D.se.toFixed(2) : '   -  '}  tank@45 ${f(T.mean, 3)}`);
      out.ret.push({ mode, lbl, econ: E, deathRpo: dEcon.length ? D : null, tank45: T, wkts: W });
    }
  }
  NEW();
}

// ---------------------------------------------------------------------------
// §5 THE CRICKET TESTS: stamina pair under natural management, five-v-six
// revisited, and the tired-quick variants.
// ---------------------------------------------------------------------------
if (has('cricket') || has('all')) {
  const M0 = Math.min(N, 220);
  say('\n=== §5 CRICKET TESTS (N=' + M0 + ') ===');
  NEW();
  const B0 = H.side('B', {});
  say('\n  A. same quick, stamina 35 v 85, captain manages naturally:');
  out.stamPair = [];
  for (const st of [35, 85]) {
    const A = H.side('A', { slots: [{ slot: 7, skills: { stamina: st } }] });
    const ov = [], econ = [], mx = [], pk = [];
    for (let i = 0; i < M0; i++) {
      const r = H.run(A, B0, 700001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        const b = inn.bowlers['A-bowl1'];
        if (b && b.b > 0) { ov.push(b.b / 6); econ.push(b.r * 6 / b.b); mx.push(b.maxSpell); }
      }
      pk.push(r.fatPeak['A-bowl1'] || 0);
    }
    say(`    stamina ${st}: overs/inn ${f(summary(ov).mean, 2)}  econ ${f(summary(econ).mean)}  longest spell ${f(summary(mx).mean / 6, 2)} ov  peak tank ${f(summary(pk).mean, 3)}`);
    out.stamPair.push({ st, overs: summary(ov), econ: summary(econ), maxSpell: summary(mx), peak: summary(pk) });
  }
  say('\n  B. five v six bowlers, OLD v NEW, by scenario:');
  out.fiveSix = [];
  for (const [scn, sideOpts, runOpts] of [
    ['fresh/balanced', {}, {}],
    ['one weary quick', { slots: [{ slot: 6, fatigue: 'weary' }] }, {}],
    ['two weary quicks', { slots: [{ slot: 6, fatigue: 'weary' }, { slot: 7, fatigue: 'weary' }] }, {}],
    ['green', {}, { pitch: 'green' }],
    ['flat', {}, { pitch: 'flat' }]]) {
    for (const [mode, fn] of [['OLD', OLD], ['NEW', NEW]]) {
      fn();
      const res = {};
      for (const sixth of [false, true]) {
        const A = H.side('A', Object.assign({ sixth, sixthLevel: 52 }, sideOpts));
        const con = [], win = [];
        for (let i = 0; i < M0; i++) {
          const r = H.run(A, B0, 700001 + i * 104729, runOpts);
          if (!r) continue;
          for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== 'A') con.push(per50(inn.runs, inn.legal));
          win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
        }
        res[sixth ? 'six' : 'five'] = { conceded: summary(con), win: summary(win) };
      }
      const dC = res.five.conceded.mean - res.six.conceded.mean;
      const dW = (res.six.win.mean - res.five.win.mean) * 100;
      say(`    ${scn.padEnd(17)} ${mode}: 6th saves ${f(dC)} runs, ${f(dW, 1)} win pts`);
      out.fiveSix.push({ scn, mode, ...res, sixthRuns: dC, sixthWin: dW });
    }
  }
  NEW();
}

// ---------------------------------------------------------------------------
// §6 CAPTAINCY, RE-MEASURED ON THE NEW ENGINE. Stickiness must not have
// turned captaincy into a spell-length stat — value should stay the same
// order, and every level should now bowl recognisable spells.
// ---------------------------------------------------------------------------
if (has('capt') || has('all')) {
  const M0 = Math.min(N, 300);
  say('\n=== §6 CAPTAINCY 20..95 ON THE NEW ENGINE (N=' + M0 + ') ===');
  NEW();
  const B0 = H.side('B', { slots: [{ slot: 0, capt: 50 }] });
  out.capt = [];
  for (const capt of [20, 40, 60, 80, 95]) {
    const A = H.side('A', { slots: [{ slot: 0, capt }] });
    const s = collectSpells(A, B0, M0, {}, 900001);
    say(line('  capt ' + capt, s) + `  win ${f(s.win.mean * 100, 1)}±${(s.win.se * 100).toFixed(1)}`);
    out.capt.push({ capt, ...s });
  }
}

// ---------------------------------------------------------------------------
// §7 MANUAL ORDERS ARE LAW. A filed plan must execute over-for-over, old
// engine or new — with the physics applying to the men it names.
// ---------------------------------------------------------------------------
if (has('orders') || has('all')) {
  say('\n=== §7 MANUAL PLANS EXECUTE EXACTLY ===');
  NEW();
  const B0 = H.side('B', {});
  const A = H.side('A', { sixth: true, sixthLevel: 52 });
  const { b1, b2, b3, b4, b6 } = FILL;
  const plans = [
    ['7-over opening spell', mkPlan([['A-bowl0', 0, 7], [b2, 14, 9], [b6, 32, 9],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])],
    ['4 on, rest, 4 on', mkPlan([['A-bowl0', 0, 4], [b2, 8, 7], ['A-bowl0', 22, 4], [b6, 30, 10],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])],
    ['saved for the death', mkPlan([['A-bowl0', 0, 2], [b2, 4, 10], [b6, 24, 9], ['A-bowl0', 42, 4],
      [b1, 1, 10], [b3, 21, 10], [b4, 41, 5]])]
  ];
  out.orders = [];
  for (const [lbl, plan] of plans) {
    let exact = 0, total = 0;
    for (let i = 0; i < 40; i++) {
      const r = H.run(A, B0, 700001 + i * 104729, { ordersA: plan });
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        total++;
        let ok = true;
        plan.compiled.forEach((nm, o) => {
          if (nm && o < inn.overBowl.length && inn.overBowl[o] !== nm) ok = false;
        });
        if (ok) exact++;
      }
    }
    say(`  ${lbl.padEnd(22)} executed exactly in ${exact}/${total} innings`);
    out.orders.push({ lbl, exact, total });
  }
}

// ---------------------------------------------------------------------------
// §8 THE ENVIRONMENT, OLD v NEW. Paired seeds; the numbers calibration will
// ask about.
// ---------------------------------------------------------------------------
if (has('ab') || has('all')) {
  const M0 = Math.min(N, 400);
  say('\n=== §8 SCORING ENVIRONMENT, OLD v NEW (paired, N=' + M0 + ') ===');
  const A = H.side('A', {}), B0 = H.side('B', {});
  out.ab = [];
  for (const [mode, fn] of [['OLD', OLD], ['NEW', NEW]]) {
    fn();
    const runs = [], wkts = [], ao = [], pp = [], mid = [], death = [];
    for (let i = 0; i < M0; i++) {
      const r = H.run(A, B0, 700001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        runs.push(per50(inn.runs, inn.legal)); wkts.push(inn.wkts);
        ao.push(inn.wkts >= 10 ? 1 : 0);
        if (inn.ph_b && inn.ph_b.pp) pp.push(inn.ph_r.pp * 6 / inn.ph_b.pp);
        if (inn.ph_b && inn.ph_b.mid) mid.push(inn.ph_r.mid * 6 / inn.ph_b.mid);
        if (inn.ph_b && inn.ph_b.death) death.push(inn.ph_r.death * 6 / inn.ph_b.death);
      }
    }
    const R = summary(runs), W = summary(wkts), AO = summary(ao);
    say(`  ${mode}: runs/50 ${f(R.mean, 1)}±${R.se.toFixed(1)}  wkts ${f(W.mean, 2)}  allout ${f(AO.mean * 100, 1)}%  pp ${f(summary(pp).mean)}  mid ${f(summary(mid).mean)}  death ${f(summary(death).mean)}`);
    out.ab.push({ mode, runs: R, wkts: W, allout: AO, pp: summary(pp), mid: summary(mid), death: summary(death) });
  }
  NEW();
}

if (has('json')) console.log(JSON.stringify(out, null, 1));

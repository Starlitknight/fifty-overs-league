// matchday-probe.mjs — WHAT THE BALL MODEL ACTUALLY REWARDS.
//
//   node tools/matchday-probe.mjs                 # the whole sweep
//   node tools/matchday-probe.mjs --section bowl  # one section
//
// The match-day coach (engine/src/league/60-matchday-coach.js) picks a side by
// asking the REAL ball model what each cricketer is worth in today's
// conditions. This probe is how that claim was checked, and how the numbers
// quoted in the coach's comments were obtained: it drives ballDist() - the
// shipped one, out of the built page, through the same VM the golden-master
// replays use - over a grid of phases and reads the distribution back.
//
// It measures rather than asserts. Nothing here is a coefficient the coach
// consumes; the coach calls the same function this probe calls. What the probe
// is for is PROVING the relationships exist and have the size the design
// assumes, so a future change to the engine that quietly reverses one of them
// shows up as a changed table rather than as a mysteriously worse side.
//
// UNITS. Everything is per over of six legal balls:
//   wkts/over   6 x P(wicket on a ball)     - the wicket-taking channel
//   runs/over   6 x E(runs off a ball)      - the economy channel
// A bowler's "value" line is the pair; a batsman's is runs per dismissal,
// which is the only batting number that combines both halves honestly.
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const SECTION = arg('section', 'all');

const eng = makeEngine();
// every measurement runs inside the VM and comes back as plain JSON
const run = code => JSON.parse(vm.runInContext('JSON.stringify((function(){' + code + '})())', eng.ctx));

// ---------------------------------------------------------------------------
// THE HARNESS, inside the VM. Reference cricketers are CLONES of real
// generated men with single fields overridden, because a hand-built object is
// missing skills the model reads and silently produces NaN.
// ---------------------------------------------------------------------------
vm.runInContext(`
var __P = (function(){
  var t = GD.teams[0], u = GD.teams[1];
  var all = t.players.concat(u.players);
  function clone(p){ return JSON.parse(JSON.stringify(p)); }
  // a median professional, level across the board: every skill 50, no talents,
  // no form or fatigue, so a measurement moves only for the reason under test
  function flat(src, over){
    var p = clone(src);
    p.talents = []; p.formWord = 'steady'; p.formIx = 3;
    p.fatigue = 'rested'; p.fatWord = 'rested'; p.fatN = 0;
    for (var k in p.skills) p.skills[k] = 50;
    p.bat = 50; p.power = 50; p.rotation = 50; p.temperament = 50;
    p.vsPace = 50; p.vsSpin = 50; p.threat = 50; p.control = 50;
    p.field = 50; p.keeping = 50; p.capt = 50; p.exp = 50;
    for (var k2 in (over||{})) {
      if (k2 === 'skills') { for (var s in over.skills) p.skills[s] = over.skills[s]; }
      else p[k2] = over[k2];
    }
    return p;
  }
  var BAT = flat(all.filter(function(p){return !p.keeper})[0]);
  var BOWL = flat(all.filter(function(p){return p.bowlType})[0]);
  // the phases, weighted the way a 50-over innings actually spends its overs
  var GRID = [[2,'pp'],[5,'pp'],[8,'pp'],[13,'mid'],[19,'mid'],[25,'mid'],[31,'mid'],[37,'mid'],[43,'death'],[47,'death'],[49,'death']];
  function ctxOf(wx, extra){
    var c = { weather: wx || 'sunny', pship: 20, chase: false, bballs: 12, ballsThisSpell: 6,
              wkts: 3, since: 40, std: 0, fieldAvg: 50, keeperQuality: 74, keeperStump: 50,
              keeperCatch: 50, rocketArms: 0, lightningKeeper: false, mixed: false,
              batFat: 0, bowlFat: 0, captBowl: 50, captBat: 50 };
    for (var k in (extra||{})) c[k] = extra[k];
    return c;
  }
  // one (bowler, batsman) pairing under one set of conditions, averaged over
  // the grid: the two numbers that describe every contest in this game
  function measure(bat, bowl, pitch, wx, extra, intent){
    var W = 0, R = 0, n = 0;
    for (var i = 0; i < GRID.length; i++){
      var over = GRID[i][0], ph = GRID[i][1];
      var d = ballDist(bat, bowl, ph, 25, intent||0, 0, pitch, 'bal', over, ctxOf(wx, extra));
      var w = (d.wC||0)+(d.wB||0)+(d.wLBW||0)+(d.wRO||0)+(d.wST||0);
      var r = (d['1']||0)+2*(d['2']||0)+3*(d['3']||0)+4*(d['4']||0)+6*(d['6']||0)
            + (d.wide||0)+(d.noball||0)+(d.bye||0)+(d.legbye||0);
      W += w; R += r; n++;
    }
    return { w: 6*W/n, r: 6*R/n };
  }
  return { clone: clone, flat: flat, BAT: BAT, BOWL: BOWL, measure: measure, ctxOf: ctxOf, all: all };
})();
`, eng.ctx);

const PITCHES = ['balanced', 'green', 'dry', 'flat', 'slow', 'cracked', 'twoPaced'];
const WEATHER = ['sunny', 'overcast', 'humid', 'misty', 'hot', 'scorching', 'drizzle', 'windy', 'chilly', 'dew later'];
const TYPES = ['fast', 'fastMedium', 'medium', 'fingerSpin', 'offSpin', 'wristSpin'];
const f2 = v => (v >= 0 ? ' ' : '') + v.toFixed(2);
const f3 = v => (v >= 0 ? '+' : '') + v.toFixed(3);

function bowlSweep() {
  console.log('\n=== 1. THE BOWLER, BY PITCH ===');
  console.log('wickets per over against a median batsman (delta vs the same bowler on a balanced pitch)\n');
  const rows = run(`
    var out = {};
    for (var ti = 0; ti < ${JSON.stringify(TYPES)}.length; ti++){
      var bt = ${JSON.stringify(TYPES)}[ti];
      var b = __P.flat(__P.BOWL, { bowlType: bt, bowlTypeFull: bt });
      out[bt] = {};
      var ps = ${JSON.stringify(PITCHES)};
      for (var pi = 0; pi < ps.length; pi++) out[bt][ps[pi]] = __P.measure(__P.BAT, b, ps[pi], 'sunny');
    }
    return out;`);
  console.log('type'.padEnd(12) + PITCHES.map(p => p.slice(0, 8).padStart(9)).join(''));
  for (const t of TYPES) {
    const base = rows[t].balanced.w;
    console.log(t.padEnd(12) + PITCHES.map(p =>
      (p === 'balanced' ? rows[t][p].w.toFixed(3) : f3(rows[t][p].w - base)).padStart(9)).join(''));
  }
  console.log('\nruns per over, same sweep');
  console.log('type'.padEnd(12) + PITCHES.map(p => p.slice(0, 8).padStart(9)).join(''));
  for (const t of TYPES) {
    const base = rows[t].balanced.r;
    console.log(t.padEnd(12) + PITCHES.map(p =>
      (p === 'balanced' ? rows[t][p].r.toFixed(2) : f3(rows[t][p].r - base)).padStart(9)).join(''));
  }

  console.log('\n=== 2. THE BOWLER, BY WEATHER (balanced pitch) ===');
  const wrows = run(`
    var out = {};
    var ts = ${JSON.stringify(TYPES)}, ws = ${JSON.stringify(WEATHER)};
    for (var ti = 0; ti < ts.length; ti++){
      var b = __P.flat(__P.BOWL, { bowlType: ts[ti], bowlTypeFull: ts[ti] });
      out[ts[ti]] = {};
      for (var wi = 0; wi < ws.length; wi++) out[ts[ti]][ws[wi]] = __P.measure(__P.BAT, b, 'balanced', ws[wi]);
    }
    return out;`);
  console.log('type'.padEnd(12) + WEATHER.map(w => w.slice(0, 7).padStart(9)).join(''));
  for (const t of TYPES) {
    const base = wrows[t].sunny.w;
    console.log(t.padEnd(12) + WEATHER.map(w =>
      (w === 'sunny' ? wrows[t][w].w.toFixed(3) : f3(wrows[t][w].w - base)).padStart(9)).join(''));
  }

  console.log('\n=== 3. THE COMBINATION THAT MATTERS: green + swing weather ===');
  const comb = run(`
    var out = [];
    var combos = [['balanced','sunny'],['green','sunny'],['balanced','overcast'],['green','overcast'],
                  ['green','humid'],['green','misty'],['dry','sunny'],['dry','hot'],['cracked','sunny'],
                  ['slow','sunny'],['twoPaced','sunny'],['flat','sunny'],['dry','dew later']];
    for (var i = 0; i < combos.length; i++){
      var pit = combos[i][0], wx = combos[i][1], row = { pitch: pit, wx: wx };
      var ts = ${JSON.stringify(TYPES)};
      for (var ti = 0; ti < ts.length; ti++){
        var b = __P.flat(__P.BOWL, { bowlType: ts[ti], bowlTypeFull: ts[ti] });
        // dew's spin penalty is written for the CHASE, so measure it there
        row[ts[ti]] = __P.measure(__P.BAT, b, pit, wx, { chase: wx === 'dew later' }).w;
      }
      out.push(row);
    }
    return out;`);
  console.log('pitch/weather'.padEnd(22) + TYPES.map(t => t.slice(0, 8).padStart(10)).join('') + '   best');
  for (const r of comb) {
    let best = TYPES[0];
    for (const t of TYPES) if (r[t] > r[best]) best = t;
    console.log((r.pitch + ' / ' + r.wx).padEnd(22) +
      TYPES.map(t => r[t].toFixed(3).padStart(10)).join('') + '   ' + best);
  }
}

function batSweep() {
  console.log('\n=== 4. THE BATSMAN: what vsPace and vsSpin are worth, by conditions ===');
  console.log('runs per dismissal for a median batsman, and for one +15 on the named lean\n');
  const rows = run(`
    var out = [];
    var combos = [['balanced','sunny'],['green','overcast'],['green','humid'],['dry','sunny'],
                  ['cracked','sunny'],['slow','sunny'],['twoPaced','sunny'],['flat','sunny']];
    var PACE = __P.flat(__P.BOWL, { bowlType: 'fastMedium', bowlTypeFull: 'fastMedium' });
    var SPIN = __P.flat(__P.BOWL, { bowlType: 'fingerSpin', bowlTypeFull: 'fingerSpin' });
    for (var i = 0; i < combos.length; i++){
      var pit = combos[i][0], wx = combos[i][1];
      var flat0 = __P.BAT;
      var vp = __P.flat(__P.BAT, { vsPace: 65, skills: { vsPace: 65 } });
      var vs = __P.flat(__P.BAT, { vsSpin: 65, skills: { vsSpin: 65 } });
      function rpd(bat, bowl){ var m = __P.measure(bat, bowl, pit, wx); return m.r / Math.max(1e-6, m.w); }
      out.push({ pitch: pit, wx: wx,
        basePace: rpd(flat0, PACE), leanPace: rpd(vp, PACE),
        baseSpin: rpd(flat0, SPIN), leanSpin: rpd(vs, SPIN) });
    }
    return out;`);
  console.log('pitch/weather'.padEnd(22) + 'vPACE base   +15   gain |  vSPIN base   +15   gain');
  for (const r of rows) {
    console.log((r.pitch + ' / ' + r.wx).padEnd(22) +
      r.basePace.toFixed(1).padStart(10) + r.leanPace.toFixed(1).padStart(6) +
      ((r.leanPace - r.basePace) >= 0 ? '+' : '') + (r.leanPace - r.basePace).toFixed(1).padStart(6) + ' |' +
      r.baseSpin.toFixed(1).padStart(11) + r.leanSpin.toFixed(1).padStart(6) +
      ((r.leanSpin - r.baseSpin) >= 0 ? '+' : '') + (r.leanSpin - r.baseSpin).toFixed(1).padStart(6));
  }

  console.log('\n=== 5. THE BATTING SKILLS, priced against each other (balanced/sunny) ===');
  console.log('runs per dismissal when ONE skill is lifted 50 -> 65\n');
  const sk = run(`
    var PACE = __P.flat(__P.BOWL, { bowlType: 'fastMedium', bowlTypeFull: 'fastMedium' });
    var keys = ['bat','power','rotation','temperament','vsPace'];
    var out = [];
    function rpd(bat, ph){
      var m = __P.measure(bat, PACE, 'balanced', 'sunny');
      return m.r / Math.max(1e-6, m.w);
    }
    var base = rpd(__P.BAT);
    for (var i = 0; i < keys.length; i++){
      var o = {}; o[keys[i]] = 65; o.skills = {}; o.skills[keys[i]] = 65;
      out.push({ skill: keys[i], rpd: rpd(__P.flat(__P.BAT, o)), base: base });
    }
    return out;`);
  for (const r of sk) console.log('  ' + r.skill.padEnd(14) + r.rpd.toFixed(1).padStart(7) +
    '   (' + ((r.rpd - r.base) >= 0 ? '+' : '') + (r.rpd - r.base).toFixed(1) + ' vs level)');
}

function fatigueSweep() {
  console.log('\n=== 6. FATIGUE: what the engine actually takes off a tired man ===');
  console.log('the law is foFatiguePenalty (skill points off bat/threat) and the in-match batFat/bowlFat channel\n');
  const rows = run(`
    var LADDER = ['rested','revived','energetic','passable','satisfactory','moderate','weary','listless','exhausted','shattered','clinically dead'];
    var out = [];
    var PACE = __P.flat(__P.BOWL, { bowlType: 'fastMedium', bowlTypeFull: 'fastMedium' });
    for (var i = 0; i < LADDER.length; i++){
      var w = LADDER[i];
      var b = __P.flat(__P.BAT, { fatigue: w, fatWord: w });
      var bo = __P.flat(__P.BOWL, { fatigue: w, fatWord: w, bowlType: 'fastMedium', bowlTypeFull: 'fastMedium' });
      // the pre-match law, as withForm applies it
      var penB = foFatiguePenalty(b), load = foFatigueLoad(b);
      // and what that costs at the crease / at the top of the mark.
      // BATTING REACHES THE MODEL THROUGH _batAdj AND NOWHERE ELSE: ballDist
      // never reads p.bat, so withForm's batting adjustment IS the channel.
      var batAdj = __P.flat(__P.BAT, { _batAdj: -penB });
      var bowlAdj = __P.flat(__P.BOWL, { bowlType:'fastMedium', bowlTypeFull:'fastMedium',
                                         threat: 50 - penB*0.92, control: 50 - penB*0.92*0.58 });
      var mb = __P.measure(batAdj, PACE, 'balanced', 'sunny');
      var mw = __P.measure(__P.BAT, bowlAdj, 'balanced', 'sunny');
      out.push({ word: w, pen: penB, load: load,
                 batRpd: mb.r / Math.max(1e-6, mb.w), bowlW: mw.w, bowlR: mw.r });
    }
    return out;`);
  console.log('  fatigue'.padEnd(20) + 'penalty   load |  bat runs/dismissal   bowl wkts/over  runs/over');
  const b0 = rows[0];
  for (const r of rows) {
    console.log('  ' + r.word.padEnd(18) + r.pen.toFixed(2).padStart(6) + r.load.toFixed(3).padStart(7) + ' |' +
      r.batRpd.toFixed(1).padStart(15) + ' (' + f2(r.batRpd - b0.batRpd) + ')' +
      r.bowlW.toFixed(3).padStart(12) + r.bowlR.toFixed(2).padStart(11));
  }
}

function keeperSweep() {
  console.log('\n=== 7. THE KEEPER: what the gloves are worth against what the bat is worth ===');
  console.log('the keeper reaches the ball model through ctx.keeperQuality/keeperCatch/keeperStump (par ' +
    run('return FO_KQ_PAR;') + ')\n');
  const rows = run(`
    var out = [];
    var SPIN = __P.flat(__P.BOWL, { bowlType: 'fingerSpin', bowlTypeFull: 'fingerSpin' });
    var PACE = __P.flat(__P.BOWL, { bowlType: 'fastMedium', bowlTypeFull: 'fastMedium' });
    var qs = [40, 55, 70, 74, 85, 95];
    for (var i = 0; i < qs.length; i++){
      var q = qs[i];
      var mS = __P.measure(__P.BAT, SPIN, 'dry', 'sunny', { keeperQuality: q, keeperCatch: q, keeperStump: q });
      var mP = __P.measure(__P.BAT, PACE, 'green', 'sunny', { keeperQuality: q, keeperCatch: q, keeperStump: q });
      out.push({ q: q, spinW: mS.w, paceW: mP.w });
    }
    return out;`);
  const par = rows.find(r => r.q === 74);
  console.log('  keeping quality   wkts/over (spin, dry)   wkts/over (pace, green)');
  for (const r of rows) {
    console.log('  ' + String(r.q).padEnd(17) + r.spinW.toFixed(4).padStart(12) +
      ' (' + f3(r.spinW - par.spinW) + ')' + r.paceW.toFixed(4).padStart(14) + ' (' + f3(r.paceW - par.paceW) + ')');
  }
  console.log('\n  and the batting side of the same man: runs per dismissal by batting skill');
  const bat = run(`
    var PACE = __P.flat(__P.BOWL, { bowlType: 'fastMedium', bowlTypeFull: 'fastMedium' });
    var out = [], bs = [30, 40, 50, 60, 70];
    for (var i = 0; i < bs.length; i++){
      var m = __P.measure(__P.flat(__P.BAT, { bat: bs[i] }), PACE, 'balanced', 'sunny');
      out.push({ bat: bs[i], rpd: m.r / Math.max(1e-6, m.w) });
    }
    return out;`);
  for (const r of bat) console.log('  bat ' + String(r.bat).padEnd(13) + r.rpd.toFixed(1).padStart(12));
}

function talentSweep() {
  console.log('\n=== 8. TALENTS with a conditions story ===');
  const rows = run(`
    var out = [];
    var cases = [
      ['newBallSpecialist','bowl','green','overcast',3,'pp'],
      ['deathSpecialist','bowl','flat','sunny',47,'death'],
      ['partnershipBreaker','bowl','balanced','sunny',25,'mid'],
      ['bouncer','bowl','green','sunny',8,'pp'],
      ['miser','bowl','flat','sunny',25,'mid'],
      ['spinKiller','bat','dry','sunny',25,'mid'],
      ['paceHunter','bat','green','overcast',5,'pp'],
      ['finisher','bat','flat','sunny',46,'death'],
      ['sixMachine','bat','flat','sunny',46,'death'],
      ['anchor','bat','green','overcast',15,'mid']
    ];
    for (var i = 0; i < cases.length; i++){
      var c = cases[i], tal = c[0], side = c[1], pit = c[2], wx = c[3], over = c[4], ph = c[5];
      var bat = __P.BAT, bowl = __P.flat(__P.BOWL, { bowlType: (pit==='dry'?'fingerSpin':'fastMedium'),
                                                     bowlTypeFull: (pit==='dry'?'fingerSpin':'fastMedium') });
      var batT = bat, bowlT = bowl;
      if (side === 'bat') batT = __P.flat(bat, { talents: [tal] });
      else bowlT = __P.flat(bowl, { talents: [tal], bowlType: bowl.bowlType, bowlTypeFull: bowl.bowlTypeFull });
      var ctx = __P.ctxOf(wx, { pship: tal === 'partnershipBreaker' ? 60 : 20, chase: false });
      function one(b, w){
        var d = ballDist(b, w, ph, 25, (tal==='sixMachine'?1:0), 0, pit, 'bal', over, ctx);
        var wk = (d.wC||0)+(d.wB||0)+(d.wLBW||0)+(d.wRO||0)+(d.wST||0);
        var r = (d['1']||0)+2*(d['2']||0)+3*(d['3']||0)+4*(d['4']||0)+6*(d['6']||0);
        return { w: 6*wk, r: 6*r };
      }
      var a = one(bat, bowl), b2 = one(batT, bowlT);
      out.push({ tal: tal, side: side, cond: pit + '/' + wx + ' ov' + over,
                 dW: b2.w - a.w, dR: b2.r - a.r });
    }
    return out;`);
  console.log('  talent'.padEnd(24) + 'side  conditions'.padEnd(28) + 'd wkts/over   d runs/over');
  for (const r of rows) console.log('  ' + r.tal.padEnd(22) + r.side.padEnd(6) + r.cond.padEnd(26) +
    f3(r.dW).padStart(9) + f2(r.dR).padStart(14));
}

console.log('=== MATCH-DAY PROBE: the shipped ball model, measured ===');
console.log('every figure below is ballDist() out of the built page, averaged over an 11-point phase grid');
if (SECTION === 'all' || SECTION === 'bowl') bowlSweep();
if (SECTION === 'all' || SECTION === 'bat') batSweep();
if (SECTION === 'all' || SECTION === 'fatigue') fatigueSweep();
if (SECTION === 'all' || SECTION === 'keeper') keeperSweep();
if (SECTION === 'all' || SECTION === 'talent') talentSweep();

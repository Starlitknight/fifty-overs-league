// matchday-selection.mjs — WHAT THE COACH PICKS, AND WHY.
//
//   node tools/matchday-selection.mjs                 # the thirteen scenarios
//   node tools/matchday-selection.mjs --squad 3       # a different club
//
// The brief's validation instrument: one representative squad, thirteen sets
// of conditions, and for each the XI, what changed against the balanced
// baseline and why, the attack's shape, the top seven, the keeper, the
// captain, the batting order, the overs the coach painted, the overs it left
// to the captain, and the toss call.
//
// It reads the coach out of the BUILT page - the same planMatchDay the umpire
// and the browser call - so what it prints is what the world will do.
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const SQUAD = +arg('squad', 0);

const eng = makeEngine();
const plan = (opts) => JSON.parse(vm.runInContext(
  'JSON.stringify((function(o){var t=GD.teams[' + SQUAD + '];' +
  'var men=JSON.parse(JSON.stringify(t.players));' +
  'if(o.tire){for(var i=0;i<men.length;i++){if(men[i].name===o.tire){men[i].fatigue=o.tireWord||"exhausted";men[i].fatWord=o.tireWord||"exhausted";}}}' +
  'return planMatchDay({team:{name:t.name,players:men},pitch:o.pitch,weather:o.weather,' +
  'oppositionScout:o.scout||null,doctrine:o.doctrine||null});' +
  '})(' + JSON.stringify(opts) + '))', eng.ctx));

const squadInfo = JSON.parse(vm.runInContext(
  'JSON.stringify((function(){var t=GD.teams[' + SQUAD + '];return {name:t.name,n:t.players.length,' +
  'men:t.players.map(function(p){return {name:p.name,type:p.bowlType||"-",keeper:!!p.keeper,' +
  'rating:Math.round((p.rating||0)/1000),form:p.formWord,fat:p.fatigue};})};})())', eng.ctx));

const SCENARIOS = [
  ['1. balanced + sunny (baseline)', { pitch: 'balanced', weather: 'Sunny' }],
  ['2. green + overcast', { pitch: 'green', weather: 'Overcast' }],
  ['3. green + humid', { pitch: 'green', weather: 'Humid' }],
  ['4. dry + sunny', { pitch: 'dry', weather: 'Sunny' }],
  ['5. cracked', { pitch: 'cracked', weather: 'Sunny' }],
  ['6. slow', { pitch: 'slow', weather: 'Sunny' }],
  ['7. two-paced', { pitch: 'twoPaced', weather: 'Sunny' }],
  ['8. flat', { pitch: 'flat', weather: 'Sunny' }],
  ['9. dew later', { pitch: 'dry', weather: 'Dew later' }],
  ['10. baseline, frontline quick exhausted', { pitch: 'balanced', weather: 'Sunny', tire: '@QUICK' }],
  ['11. baseline, star batter exhausted', { pitch: 'balanced', weather: 'Sunny', tire: '@BAT' }],
  ['12. opposition weak vs spin', { pitch: 'balanced', weather: 'Sunny',
        scout: { attack: 'Pace-leaning', weakVsSpin: true } }],
  ['13. opposition weak vs pace', { pitch: 'balanced', weather: 'Sunny',
        scout: { attack: 'Spin-leaning', weakVsPace: true } }]
];

console.log('=== MATCH-DAY SELECTION DIAGNOSTIC ===');
console.log('club: ' + squadInfo.name + '  (' + squadInfo.n + ' men)\n');

// who the "frontline quick" and "star batter" are, for scenarios 10 and 11
const base = plan({ pitch: 'balanced', weather: 'Sunny' });
const cardOf = {};
base.explanation.cards.forEach(c => { cardOf[c.name] = c; });
const quick = base.explanation.attack.filter(a => a.cls === 'pace')
  .sort((a, b) => b.value - a.value)[0];
const starBat = base.explanation.cards.filter(c => c.picked)
  .sort((a, b) => b.rpd - a.rpd)[0];
console.log('scenario 10 tires the best frontline quick : ' + (quick ? quick.name : '(none)'));
console.log('scenario 11 tires the best batsman         : ' + (starBat ? starBat.name : '(none)'));

const short = n => n.split(' ').slice(-1)[0];
const baseSet = new Set(base.xi);

for (const [label, opts] of SCENARIOS) {
  const o = { ...opts };
  if (o.tire === '@QUICK') o.tire = quick && quick.name;
  if (o.tire === '@BAT') o.tire = starBat && starBat.name;
  const p = plan(o);
  const set = new Set(p.xi);
  const inn = p.xi.filter(n => !baseSet.has(n));
  const out = base.xi.filter(n => !set.has(n));
  const e = p.explanation;

  console.log('\n' + '-'.repeat(74));
  console.log(label + '   [' + e.conditions + ']');
  console.log('-'.repeat(74));
  console.log('  XI changes vs baseline : ' +
    (inn.length ? 'IN  ' + inn.map(short).join(', ') + '   OUT ' + out.map(short).join(', ') : 'none'));
  if (inn.length) {
    inn.forEach(n => {
      const c = e.cards.find(x => x.name === n) || {};
      const b = cardOf[n] || {};
      console.log('      in : ' + short(n).padEnd(12) +
        ' bowl value ' + String(c.bowl).padStart(7) + ' (baseline ' + String(b.bowl).padStart(7) + ')' +
        '  runs/dismissal ' + String(c.rpd).padStart(5));
    });
    out.forEach(n => {
      const c = e.cards.find(x => x.name === n) || {};
      const b = cardOf[n] || {};
      console.log('      out: ' + short(n).padEnd(12) +
        ' bowl value ' + String(c.bowl).padStart(7) + ' (baseline ' + String(b.bowl).padStart(7) + ')' +
        '  runs/dismissal ' + String(c.rpd).padStart(5) +
        (c.fatPen ? '  fatigue -' + c.fatPen : ''));
    });
  }
  console.log('  attack                 : ' + e.pace + ' pace, ' + e.spin + ' spin  ->  ' +
    e.attack.sort((a, b) => b.value - a.value)
      .map(a => short(a.name) + '(' + a.type + ' ' + a.value.toFixed(1) + ')').join(', '));
  console.log('  top seven              : ' + p.battingOrder.slice(0, 7).map(short).join(' > '));
  console.log('  tail                   : ' + p.battingOrder.slice(7).map(short).join(' > '));
  console.log('  keeper                 : ' + short(p.keeper) + '  (glove quality ' + e.keeperQuality + ')');
  console.log('  captain                : ' + short(p.captain));
  console.log('  coach painted          : ' + p.assignedOvers + ' overs');
  e.bowlingNotes.forEach(n => console.log('      · ' + n));
  console.log('  left to the captain    : ' + p.openOvers + ' overs');
  console.log('  toss                   : ' + p.tossDecision +
    ' (margin ' + e.tossMargin + ')');
}

console.log('\n' + '='.repeat(74));
console.log('every figure above comes from the shipped ball model via planMatchDay()');

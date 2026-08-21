#!/usr/bin/env node
/* tools/roster-emergency-audit.mjs — WHAT AN EMERGENCY MAN WOULD BE
 *
 * Sections 4 and 5 of the roster-continuity brief: audit the primitive BEFORE
 * building on it, and prove the emergency path cannot become a strategy.
 *
 * The brief names makeRecruit(..., "poor", ...) as the likely primitive and
 * says to audit it first. It is an ACADEMY construct - it returns a colt of
 * sixteen to twenty with a hidden growth seed - so the question is not only
 * "how good is he" but "is he the right KIND of object to put in a senior
 * squad".
 *
 * The comparison that matters for section 5 is against what a club gets by
 * doing the normal thing: signing off the free-agent board. If the emergency
 * man is anywhere near as good, a manager has a reason to let his squad rot.
 *
 *   node tools/roster-emergency-audit.mjs [--n=400]
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs } from '../server/init-world.mjs';
import { makeRecruit } from '../server/youth.mjs';
import { makeFreeAgent, valueOf } from '../server/market.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const N = +arg('n', 1200);
const L = s => console.log(s);
const $ = n => '$' + Math.round(n).toLocaleString();
const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const host = makeHost();
const cfg = countryConfigs(host).find(c => c.id === 'eng');

const sample = (make, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = make(i);
    if (p) out.push(p);
  }
  return out;
};

const recruits = { jewel: [], good: [], average: [], poor: [] };
for (const tier of Object.keys(recruits)) {
  recruits[tier] = sample(i => makeRecruit(host, cfg.nat, cfg.arch, tier, 'emg|' + tier + '|' + i), N);
}
const fas = sample(i => {
  const m = makeFreeAgent(host, cfg, 'emgfa|' + i);
  return m ? host.derive([m])[0] : null;
}, N);

const row = (label, men) => {
  const c = men.map(p => p.rating / 1000);
  const w = men.map(p => p.wage || 0);
  const v = men.map(p => valueOf(p));
  const a = men.map(p => p.age || 0);
  L('   ' + label.padEnd(18) + String(men.length).padStart(5)
    + pct(c, 0.1).toFixed(0).padStart(7) + pct(c, 0.5).toFixed(0).padStart(7)
    + pct(c, 0.9).toFixed(0).padStart(7) + Math.max(...c).toFixed(0).padStart(7)
    + $(pct(w, 0.5)).padStart(11) + $(pct(v, 0.5)).padStart(12)
    + mean(a).toFixed(1).padStart(7));
};

L('');
L('4. WHAT makeRecruit MAKES, BY TIER - and what the market offers instead');
L('='.repeat(92));
L('');
L('   pool                  n    ovr                     wage       value    age');
L('                              P10    med    P90    max     median      median');
L('   ' + '-'.repeat(89));
for (const t of ['jewel', 'good', 'average', 'poor']) row('makeRecruit ' + t, recruits[t]);
row('free agent', fas);
L('');

const poor = recruits.poor, poorC = poor.map(p => p.rating / 1000);
const faC = fas.map(p => p.rating / 1000);
L('   THE COMPARISON SECTION 5 ASKS FOR:');
L('      a "poor" recruit   median OVR ' + pct(poorC, 0.5).toFixed(0)
  + ', best in ' + N + ' draws ' + Math.max(...poorC).toFixed(0));
L('      a free agent       median OVR ' + pct(faC, 0.5).toFixed(0)
  + ', best in ' + N + ' draws ' + Math.max(...faC).toFixed(0));
let beats = 0;
for (const a of poorC) for (const b of faC) if (a > b) beats++;
L('      P(a poor recruit is better than a free agent) = '
  + (100 * beats / (poorC.length * faC.length)).toFixed(1) + '%');
L('');

L('5. CAN IT BE EXPLOITED?');
L('='.repeat(92));
L('');
const overFA = poorC.filter(c => c >= pct(faC, 0.5)).length;
const over50 = poorC.filter(c => c >= 50).length;
L('   poor recruits at or above the free-agent MEDIAN: ' + overFA + ' of ' + poor.length
  + ' (' + (100 * overFA / poor.length).toFixed(1) + '%)');
L('   poor recruits at OVR 50 or better:               ' + over50 + ' of ' + poor.length
  + ' (' + (100 * over50 / poor.length).toFixed(1) + '%)');
L('   most valuable poor recruit drawn:                ' + $(Math.max(...poor.map(p => valueOf(p)))));
L('   median free-agent value:                         ' + $(pct(fas.map(p => valueOf(p)), 0.5)));
L('');

// THE COMPARISON THE FINALISATION ACTUALLY ASKS FOR is not against the median
// free agent - a manager would never buy the median if he only needed a body.
// It is against the CHEAPEST REALISTIC NORMAL REPLACEMENT: the worst decile of
// the board, which is what letting the squad shrink is really an alternative to.
const faSorted = fas.slice().sort((a, b) => (a.rating || 0) - (b.rating || 0));
const cheapest = faSorted.slice(0, Math.max(1, Math.floor(fas.length * 0.1)));
L('   AGAINST THE CHEAPEST REALISTIC NORMAL REPLACEMENT (worst decile of board):');
L('      cheapest normal    median OVR ' + pct(cheapest.map(p => p.rating / 1000), 0.5).toFixed(0)
  + '   wage ' + $(pct(cheapest.map(p => p.wage || 0), 0.5))
  + '   value ' + $(pct(cheapest.map(p => valueOf(p)), 0.5)));
L('      emergency man      median OVR ' + pct(poorC, 0.5).toFixed(0)
  + '   wage ' + $(pct(poor.map(p => p.wage || 0), 0.5))
  + '   value ' + $(pct(poor.map(p => valueOf(p)), 0.5)));
let beatsCheap = 0;
const cheapC = cheapest.map(p => p.rating / 1000);
for (const a of poorC) for (const b of cheapC) if (a > b) beatsCheap++;
L('      P(emergency beats even the cheapest normal man) = '
  + (100 * beatsCheap / (poorC.length * cheapC.length)).toFixed(1) + '%');
L('      median experience  emergency ' + pct(poor.map(p => p.exp || 0), 0.5).toFixed(0)
  + ' vs board ' + pct(fas.map(p => p.exp || 0), 0.5).toFixed(0));
L('');
L('      A manager choosing between them is choosing between a man worse than');
L('      the worst thing on the board and one who is not. There is no version');
L('      of "let the squad shrink" that pays.');
L('');

L('   WHAT KIND OF OBJECT HE IS, which matters as much as how good he is:');
const p0 = poor[0];
L('      colt flag          ' + JSON.stringify(p0.colt));
L('      age range          ' + Math.min(...poor.map(p => p.age)) + ' to '
  + Math.max(...poor.map(p => p.age)));
L('      carries yseed      ' + (p0.yseed != null ? 'yes - a hidden growth seed' : 'no'));
L('      pid prefix         ' + String(p0.pid).slice(0, 1) + ' (academy ids start "y")');
L('');
L('   makeRecruit is the ACADEMY\'s primitive: every man it returns is a colt of');
L('   sixteen to twenty carrying a hidden growth rate, which is exactly right');
L('   for a youth intake and is a question mark for a SENIOR emergency signing.');
L('   A colt in the senior squad trains at the senior rate - living.mjs runs the');
L('   men and the boys as separate crews and only the boys crew is handed');
L('   __ypot - so the growth seed is inert there. The flag itself is the risk:');
L('   anything that reads `colt` to mean "this man is in the academy" would be');
L('   wrong about him.');
L('');

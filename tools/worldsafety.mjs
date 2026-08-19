/* PART A §5. The world's overall strength, measured the same way on both
 * builds. Changing a bowling-type array must not change how good the world is.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';
import { dealWorld } from './bowling-type-probe.mjs';
const eng = makeEngine(); const g = k => vm.runInContext(k, eng.ctx);
const clubs = dealWorld();
const ovr = p => Math.max(0, Math.min(100, Math.round(JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr)));
const all = [], wages = [], byDiv = {};
for (const c of clubs) {
  const os = c.players.map(ovr);
  all.push(...os);
  wages.push(...c.players.map(p => +p.wage || 0));
  const d = byDiv[c.div] = byDiv[c.div] || { ovr: [], wage: 0, n: 0 };
  d.ovr.push(...os); d.wage += c.players.reduce((a,p)=>a+(+p.wage||0),0); d.n++;
}
const pct=(a,q)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(q*(s.length-1))]};
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log('men', all.length, 'clubs', clubs.length);
console.log('OVR   mean', mean(all).toFixed(2), 'p5', pct(all,.05), 'p50', pct(all,.5),
  'p90', pct(all,.90), 'p95', pct(all,.95), 'p99', pct(all,.99), 'max', Math.max(...all),
  '>=80', all.filter(v=>v>=80).length, '>=90', all.filter(v=>v>=90).length);
console.log('WAGE  total $' + wages.reduce((a,b)=>a+b,0).toLocaleString(),
  ' median $' + pct(wages,.5).toLocaleString(),
  ' p90 $' + pct(wages,.90).toLocaleString(),
  ' p99 $' + pct(wages,.99).toLocaleString(),
  ' top $' + Math.max(...wages).toLocaleString());
for (const d of Object.keys(byDiv).sort())
  console.log(`div ${d}  clubs ${byDiv[d].n}  mean OVR ${mean(byDiv[d].ovr).toFixed(2)}  payroll/club $${Math.round(byDiv[d].wage/byDiv[d].n).toLocaleString()}`);

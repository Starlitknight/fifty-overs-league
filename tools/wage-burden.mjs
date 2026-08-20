// wage-burden.mjs — WHAT PAYROLL COSTS UNDER THE FINISHED ECONOMY, AND WHAT
// AN ABSOLUTE RE-ANCHOR WOULD DO ABOUT IT.
//
// Sections 8 and 11-15. Everything here runs on the SHIPPED Phase-4 operations
// law (base $11,700 + seats x $3.10 + following x $2.00 + a $30,000 top-flight
// premium) through the seat model in economy-audit.mjs, which walks the same
// laws economy.mjs walks and has an oracle against a real settled database.
//
// THE ANCHOR IS SWEPT AS A SCALAR ON FO_WAGE_MID AND NOTHING ELSE. foWageOf is
// FO_WAGE_MID x (card/50)^K, so scaling the midpoint scales every wage in the
// world by exactly that factor and leaves every ratio between two players
// untouched. That is what makes "scale" and "shape" separable, and it is why
// this sweep can be done without regenerating a single cricketer: the dealt
// squads are fixed, and a candidate multiplies the bill they cost.
//
//   node tools/wage-burden.mjs [--nations=N]
//
// Reads shipped laws. Changes nothing.
import { makeHost } from '../server/enginehost.mjs';
import { tierOfClub, countryConfigs } from '../server/init-world.mjs';
import { seasonOf, $, mean } from './economy-audit.mjs';
import { foundingSeats, foundingSupport } from '../server/economy.mjs';

const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const NAT = Math.max(1, parseInt(arg('nations') || '8', 10));
const L = s => console.log(s);
const pctOf = (a, b) => (b > 0 ? (100 * a / b).toFixed(1) + '%' : '-');

const host = makeHost();
const nations = countryConfigs(host).slice(0, NAT);

// ---------------------------------------------------------------------------
// THE DEALT PAYROLL. One number per seat per nation: what the fifteen men the
// generator gives that seat cost a round at the shipped law.
// ---------------------------------------------------------------------------
const dealt = [];
for (const cfg of nations) {
  for (const club of cfg.clubs) {
    const sq = host.genSquad('world1|' + cfg.id + '|' + club.slot, cfg.nat,
      club.arch || cfg.arch, club.boss ? cfg.capt : 'general', 1, tierOfClub(cfg, club)) || [];
    if (!sq.length) continue;
    const men = host.derive(sq);
    dealt.push({
      nat: cfg.id, slot: club.slot, isBoss: !!club.boss,
      div: club.div || (club.slot < 8 ? 1 : 2),
      wageRound: men.reduce((a, p) => a + (p.wage || 0), 0)
    });
  }
}

// A SEAT FINISHES WHERE ITS SEAT FINISHES. Modelling every club as mid-table
// would flatter the weak and punish the strong; the seat ladder is the closest
// honest default, and the archetype runs below vary it deliberately.
const posOf = slot => (slot < 8 ? slot + 1 : slot - 7);
const winsOf = pos => Math.max(2, 12 - Math.round(1.4 * (pos - 1)));

const season = (d, scale, extra) => seasonOf({
  slot: d.slot, isBoss: d.isBoss, div: d.div, country: d.nat,
  wageRound: Math.round(d.wageRound * scale),
  pos: posOf(d.slot), wins: winsOf(posOf(d.slot)),
  seats: foundingSeats(d.slot, d.isBoss), support: foundingSupport(d.slot, d.isBoss),
  bank0: 0, ...(extra || {})
});

L('');
L('8. THE PAYROLL BURDEN UNDER THE SHIPPED ECONOMY');
L('='.repeat(94));
L('   ' + dealt.length + ' club-seasons, Phase-4 operations, shipped wage law');
L('');
L('   slot div        revenue         wages           ops       upkeep'
  + '        net    wage/rev  wage/cost');
L('   ' + '-'.repeat(91));
const base = {};
for (let slot = 0; slot < 16; slot++) {
  const at = dealt.filter(d => d.slot === slot);
  if (!at.length) continue;
  const rs = at.map(d => season(d, 1));
  const m = f => mean(rs.map(f));
  base[slot] = {
    revenue: m(r => r.revenue), wages: m(r => r.wages), ops: m(r => r.ops),
    upkeep: m(r => r.upkeep), net: m(r => r.net), cost: m(r => r.cost), div: at[0].div
  };
  const b = base[slot];
  L('   ' + String(slot).padStart(4) + String(b.div).padStart(4)
    + $(b.revenue).padStart(15) + $(b.wages).padStart(14) + $(b.ops).padStart(14)
    + $(b.upkeep).padStart(13) + $(b.net).padStart(13)
    + pctOf(b.wages, b.revenue).padStart(11) + pctOf(b.wages, b.cost).padStart(11));
}
const under = Object.entries(base).filter(([, b]) => b.net < 0).map(([s]) => +s);
L('');
L('   under water: ' + (under.length ? under.join(', ') : 'none')
  + '   (' + under.length + ' of 16 seats)');
L('   wage/revenue across the ladder: '
  + Math.min(...Object.values(base).map(b => 100 * b.wages / b.revenue)).toFixed(0) + '% to '
  + Math.max(...Object.values(base).map(b => 100 * b.wages / b.revenue)).toFixed(0) + '%');
L('');
L('   THE DESIGN TARGET THE MIDPOINT WAS FITTED TO was "about 65% of income",');
L('   stated in 00-core.js beside FO_WAGE_MID. The world-wide mean here is '
  + (100 * mean(Object.values(base).map(b => b.wages)) / mean(Object.values(base).map(b => b.revenue))).toFixed(1) + '%.');
L('');

// ---------------------------------------------------------------------------
// 11. THE ANCHOR-ONLY SWEEP. Shape fixed, level swept.
// ---------------------------------------------------------------------------
const SCALES = [1.00, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60];
L('11. ANCHOR-ONLY SWEEP - FO_WAGE_MID scaled, K and the ladder untouched');
L('='.repeat(94));
L('');
L('   scale    MID   med wage   D1 payroll   D2 payroll   D1 net/yr   D2 net/yr'
  + '   wage/rev   under');
L('   ' + '-'.repeat(91));
const arms = [];
for (const sc of SCALES) {
  const rows = dealt.map(d => ({ d, r: season(d, sc) }));
  const d1 = rows.filter(x => x.d.div === 1), d2 = rows.filter(x => x.d.div === 2);
  const bySeat = {};
  for (let slot = 0; slot < 16; slot++) {
    const at = rows.filter(x => x.d.slot === slot);
    if (at.length) bySeat[slot] = mean(at.map(x => x.r.net));
  }
  const nUnder = Object.values(bySeat).filter(n => n < 0).length;
  const wrev = 100 * mean(rows.map(x => x.r.wages)) / mean(rows.map(x => x.r.revenue));
  const arm = {
    scale: sc, mid: Math.round(9290 * sc),
    medWage: Math.round(9860 * sc),
    d1pay: mean(d1.map(x => x.r.wages)), d2pay: mean(d2.map(x => x.r.wages)),
    d1net: mean(d1.map(x => x.r.net)), d2net: mean(d2.map(x => x.r.net)),
    wrev, nUnder, bySeat
  };
  arms.push(arm);
  L('   ' + sc.toFixed(2).padStart(5) + String(arm.mid).padStart(7)
    + $(arm.medWage).padStart(11) + $(arm.d1pay).padStart(13) + $(arm.d2pay).padStart(13)
    + $(arm.d1net).padStart(12) + $(arm.d2net).padStart(12)
    + wrev.toFixed(1).padStart(10) + '%' + String(nUnder).padStart(8));
}
L('');

// ---------------------------------------------------------------------------
// 13 + 14. THE TWO TAILS, SEAT BY SEAT.
// ---------------------------------------------------------------------------
L('13 + 14. THE TAILS, SEAT BY SEAT (annual net)');
L('='.repeat(94));
L('');
L('   slot' + SCALES.map(s => ('x' + s.toFixed(2)).padStart(12)).join(''));
L('   ' + '-'.repeat(91));
for (let slot = 0; slot < 16; slot++) {
  if (base[slot] == null) continue;
  L('   ' + String(slot).padStart(4)
    + arms.map(a => $(a.bySeat[slot]).padStart(12)).join(''));
}
L('');

// ---------------------------------------------------------------------------
// 12 + 15. BEHAVIOUR, NOT PARITY. Three managements at four club sizes, and
// what the flagship banks over five and ten seasons.
// ---------------------------------------------------------------------------
L('12 + 15. MANAGEMENT ARCHETYPES AND FLAGSHIP ACCUMULATION');
L('='.repeat(94));
L('');
L('   FRUGAL is a squad 20% under what its seat is dealt; NORMAL is the dealt');
L('   squad; AGGRESSIVE is 45% over it - a contender buying a title.');
L('');
const ARCH = [['frugal', 0.80], ['normal', 1.00], ['aggressive', 1.45]];
const SIZES = [['flagship', 0], ['mid D1', 5], ['top D2', 9], ['minnow', 15]];
for (const sc of [1.00, 0.85, 0.75, 0.65]) {
  L('   at scale x' + sc.toFixed(2) + ':');
  L('      club          ' + ARCH.map(a => a[0].padStart(14)).join(''));
  for (const [label, slot] of SIZES) {
    const at = dealt.filter(d => d.slot === slot);
    const cells = ARCH.map(([, mult]) =>
      $(mean(at.map(d => season({ ...d, wageRound: d.wageRound * mult }, sc).net))).padStart(14));
    L('      ' + label.padEnd(14) + cells.join(''));
  }
  const flag = dealt.filter(d => d.slot === 0);
  const yr = mean(flag.map(d => season(d, sc).net));
  L('      flagship treasury after 5 seasons ' + $(5 * yr)
    + ', after 10 ' + $(10 * yr));
  L('');
}
L('   (a straight-line projection, deliberately: the moving-pyramid run in');
L('    wage-pyramid.mjs is what actually answers section 19, and it promotes');
L('    and relegates. This is the same-seat comparison and nothing more.)');
L('');

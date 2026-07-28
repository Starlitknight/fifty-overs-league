// Probe: fo_market packets are applied at round resolution — first claim wins,
// fee deducts from the settled bank, squad cap and bank floor respected.
import { openEngine } from './resolve.mjs';
const { page, close } = await openEngine();
const r = await page.evaluate(() => {
  App.teamIx = 0; seasonInit(); econInit();
  const A = GD.teams[0], B = GD.teams[1], C = GD.teams[2];
  const mk = (name, fee) => ({ name, age: 24, fee, wage: 900, bat: 60, bowl: 55, keep: 20, capt: 40, exp: 45, skills: { batting: 60, bowling: 55, keeping: 20, technique: 58, power: 52, endurance: 61, fielding: 57 } });
  // C: squad already at cap 18
  while ((C.players || []).length < 18) C.players.push(JSON.parse(JSON.stringify(C.players[0])) && Object.assign(JSON.parse(JSON.stringify(C.players[0])), { name: 'Filler ' + C.players.length }));
  window.__FO_PKTS = [
    { club: A.name, fo_market: [mk('Marco Testman', 60000), mk('Broke Buyer', 99999999)] },
    { club: B.name, fo_market: [mk('Marco Testman', 60000), mk('Solo Signing', 40000)] },
    { club: C.name, fo_market: [mk('Cap Blocked', 30000)] },
  ];
  const preA = A.bank, preB = B.bank;
  window.completeRound();
  const has = (t, nm) => !!(t.players || []).find(p => p.name === nm);
  return {
    aGotMarco: has(A, 'Marco Testman'),
    bGotMarco: has(B, 'Marco Testman'),          // must be false: A's packet ran first
    aGotBroke: has(A, 'Broke Buyer'),            // must be false: fee > bank
    bGotSolo: has(B, 'Solo Signing'),
    cGotCap: has(C, 'Cap Blocked'),              // must be false: squad at 18
    aFeeOk: (preA - A.bank) !== 0,               // bank moved (round economy also moves it; check report instead)
    aReport: (A._trainReport && A._trainReport.signings) || [],
    bReport: (B._trainReport && B._trainReport.signings) || [],
    aSquad: A.players.length, cSquad: C.players.length,
    marcoFeeGone: !((A.players.find(p => p.name === 'Marco Testman') || {}).fee),
  };
});
await close();
const checks = [
  ['A signed Marco Testman', r.aGotMarco === true],
  ['B blocked on Marco (first claim wins)', r.bGotMarco === false],
  ['A blocked on unaffordable Broke Buyer', r.aGotBroke === false],
  ['B signed Solo Signing', r.bGotSolo === true],
  ['C blocked at squad cap 18', r.cGotCap === false && r.cSquad === 18],
  ['fee stripped from roster copy', r.marcoFeeGone === true],
  ['A report mentions signing', r.aReport.some(s => /Marco Testman/.test(s))],
  ['B report mentions Solo Signing', r.bReport.some(s => /Solo Signing/.test(s))],
];
let fail = 0;
for (const [nm, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${nm}`); if (!ok) fail++; }
console.log('A signings:', JSON.stringify(r.aReport), '| B signings:', JSON.stringify(r.bReport));
process.exit(fail ? 1 : 0);

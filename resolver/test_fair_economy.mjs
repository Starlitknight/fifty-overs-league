import { openEngine } from './resolve.mjs';
const { page, close } = await openEngine();
const r = await page.evaluate(() => {
  App.teamIx = 0; seasonInit(); econInit();
  // give two clubs explicit sponsor deals; rest default to community
  GD.teams[0].sponsorDeal = { id: 'contender' };
  GD.teams[1].sponsorDeal = { id: 'results' };
  const pre = GD.teams.map(t => ({ nm: t.name, bank: t.bank, wages: t.players.reduce((s, p) => s + (+p.wage || 0), 0), seats: t.seats, aY: t.acadY, aS: t.acadS, sup: t.supporters, mood: t.mood }));
  window.completeRound();
  const round0 = App.results.filter(x => x.comp === 'league' && x.round === 0);
  const AC = [0, 4000, 8000, 14000, 22000, 32000];
  const DEALS = { community: { base: 45000, win: 0 }, results: { base: 38000, win: 13000 }, contender: { base: 30000, win: 16000 } };
  const audit = GD.teams.map((t, i) => {
    const p = pre[i];
    const deal = DEALS[(t.sponsorDeal && t.sponsorDeal.id) || 'community'];
    const r = round0.find(x => x.home === t.name || x.away === t.name);
    let expect = deal.base - p.wages - (p.seats || 9000) - AC[p.aY] - AC[p.aS];
    if (r && r.home === t.name) expect += Math.min(t.seats, Math.round(p.sup * (0.55 + 0.13 * (t.name === userTeam().name ? p.mood : p.mood)))) * 9;
    if (r && r.result && r.result.winner === t.name) expect += deal.win;
    return { nm: t.name, deal: (t.sponsorDeal && t.sponsorDeal.id) || 'community', delta: t.bank - p.bank, expect, ok: Math.abs((t.bank - p.bank) - expect) <= 50 };
  });
  return { audit, finBank: App.fin.bank, myBank: userTeam().bank, finMatches: App.fin.bank === userTeam().bank };
});
let pass = 0, fail = 0;
for (const a of r.audit) { console.log(`${a.ok ? 'PASS' : 'FAIL'}  ${a.nm} (${a.deal}): delta=${a.delta} expect=${a.expect}`); a.ok ? pass++ : fail++; }
console.log(`fin.bank mirrors club bank: ${r.finMatches} (${r.finBank})`);
console.log(`${pass} pass, ${fail} fail`);
await close();
process.exit(fail ? 1 : 0);

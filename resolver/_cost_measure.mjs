import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file:///home/user/fifty-overs-league/index.html'); await p.waitForTimeout(1800);
console.log(JSON.stringify(await p.evaluate(() => {
  const rows = [];
  const comps = {
    n11: { bat: 4, pace: 3, spin: 1, ar: 1, wk: 2 },
    n15: null,   // archetype default
    n18: { bat: 7, pace: 4, spin: 2, ar: 3, wk: 2 }
  };
  for (const arch of ['express', 'rock', 'engine', 'prodigy']) {
    for (const key in comps) {
      const g = window.__foGenArchetypeSquad('m1', 'England', arch, 'general', comps[key]);
      const fees = g.players.reduce((s, x) => s + (x.fee || 0), 0);
      const wages = g.players.reduce((s, x) => s + (x.wage || 0), 0);
      rows.push({ arch, key, n: g.players.length, fees, wages, bank: 1000000 - fees });
    }
  }
  return rows;
}), null, 1));
await b.close();

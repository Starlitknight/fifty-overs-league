import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file:///home/user/fifty-overs-league/index.html'); await p.waitForTimeout(1800);
console.log(JSON.stringify(await p.evaluate(() => {
  const checks = [];
  for (const arch of ['wizard', 'express', 'rock', 'engine']) for (const seed of ['s1', 's2', 's3']) {
    const pool = window.__foGenCaptainPool(seed, 'England', arch);
    const ovr = pool.map(x => x.rating);
    const talTop = ovr[1] === Math.max(...ovr);
    const det = window.__foGenArchetypeSquad(seed, 'England', arch, 'talisman').players[0].name === pool[1].name;
    checks.push({ arch, seed, talTop, det });
  }
  return { allTalTop: checks.every(c => c.talTop), allDet: checks.every(c => c.det) };
})));
await b.close();

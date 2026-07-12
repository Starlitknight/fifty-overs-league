// mixed-flavour sanity: every squad led by a rotating captain flavour
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const GAME = '/home/user/fifty-overs-league/client/game.html';
const HARNESS = '/home/user/fifty-overs-league/resolver/resolve-harness.js';
const REPS = 12, WORKERS = 6;
const wins = {}, games = {};
await Promise.all([...Array(WORKERS).keys()].map(async wIx => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + GAME, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__foGenArchetypeSquad === 'function', { timeout: 15000 });
  await page.addScriptTag({ content: readFileSync(HARNESS, 'utf8') });
  await page.waitForFunction(() => window.__FO_RESOLVE_READY === true);
  for (let rep = wIx; rep < REPS; rep += WORKERS) {
    const res = await page.evaluate(({ rep }) => {
      const A = window.__foArchetypes.map(a => a.id);
      const FL = window.__foCaptFlavours.map(f => f.id);
      const squads = {};
      A.forEach((id, i) => squads[id] = { name: id, ground: 'Neutral Ground',
        players: window.__foGenArchetypeSquad('mx-r' + rep, 'England', id, FL[(rep + i) % FL.length]).players });
      const out = [];
      for (let i = 0; i < A.length; i++) for (let j = 0; j < A.length; j++) {
        if (i === j) continue;
        const r = window.__resolveMatch(squads[A[i]], squads[A[j]], null, null,
          { pitch: 'balanced', weather: 'Sunny', ground: 'Neutral Ground', friendly: true, seed: (rep * 91 + i * 17 + j) >>> 0 });
        out.push([A[i], A[j], r.winner_team === A[i] ? 1 : (r.winner_team === A[j] ? 0 : 0.5)]);
      }
      return out;
    }, { rep });
    for (const [h, a, w] of res) {
      (wins[h] = wins[h] || { w: 0, g: 0 }).w += w; wins[h].g++;
      (wins[a] = wins[a] || { w: 0, g: 0 }).w += 1 - w; wins[a].g++;
    }
  }
  await browser.close();
}));
const rows = Object.keys(wins).map(k => [k, (100 * wins[k].w / wins[k].g).toFixed(1)]);
rows.sort((a, b) => b[1] - a[1]);
console.log('MIXED FLAVOURS (' + REPS + ' RRs):', rows.map(r => r[0] + ' ' + r[1] + '%').join(' · '));
const vals = rows.map(r => +r[1]);
console.log('spread', Math.min(...vals) + '% .. ' + Math.max(...vals) + '%', (Math.min(...vals) >= 38 && Math.max(...vals) <= 62) ? 'OK' : 'CHECK');

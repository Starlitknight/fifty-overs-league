// Balance probe: play N full 18-round seasons with a mix of sponsor deals and
// report each club's wins, wage bill, gate, and final bank. Answers: does any
// deal dominate? can a club go broke? how wide is the top-vs-bottom spread?
import { openEngine } from './resolve.mjs';

const SEASONS = 3;
for (let s = 0; s < SEASONS; s++) {
  const { page, close } = await openEngine();
  const r = await page.evaluate((seasonIx) => {
    App.teamIx = 0; seasonInit(); econInit();
    // deal mix: 0-3 community, 4-6 results, 7-9 contender; club 9 also runs
    // maxed academies to test the bankruptcy lever
    const DEAL = i => i <= 3 ? 'community' : i <= 6 ? 'results' : 'contender';
    GD.teams.forEach((t, i) => {
      t.sponsorDeal = { id: DEAL(i) };
      if (i === 9) { t.acadY = 3; t.acadS = 3; }   // 14k+14k = 28k/matchday
      if (i === 3) { t.acadY = 1; t.acadS = 1; }   // modest academy
      t._start = { bank: t.bank, wages: t.players.reduce((a, p) => a + (+p.wage || 0), 0) };
    });
    // shuffle relative strength across seasons by rotating who bats where is
    // not possible without RNG; instead vary the seed by playing rounds — the
    // engine already varies match outcomes per season via its own seeding.
    const total = App.season.schedule.length;
    for (let rd = 0; rd < total; rd++) window.completeRound();
    const rows = leagueRows();
    return GD.teams.map((t, i) => {
      const row = rows.find(x => x.nm === t.name) || { w: 0, l: 0, pts: 0 };
      const pos = rows.findIndex(x => x.nm === t.name) + 1;
      return {
        nm: t.name, deal: DEAL(i), acad: (t.acadY || 0) + (t.acadS || 0),
        wins: row.w, pos,
        wages: t._start.wages, start: t._start.bank, end: t.bank,
        delta: t.bank - t._start.bank,
        mood: t.mood, sup: t.supporters,
      };
    }).sort((a, b) => a.pos - b.pos);
  }, s);
  await close();
  console.log(`\n=== season ${s + 1} (18 rounds) — sorted by finish ===`);
  console.log('pos club                deal        acad wins  wages/md  start bank  end bank    season net');
  for (const t of r) {
    console.log(
      String(t.pos).padStart(2) + '  ' + t.nm.padEnd(19) + t.deal.padEnd(11) +
      String(t.acad).padStart(3) + String(t.wins).padStart(6) +
      ('$' + t.wages.toLocaleString()).padStart(10) +
      ('$' + t.start.toLocaleString()).padStart(12) +
      ('$' + t.end.toLocaleString()).padStart(12) +
      ((t.delta >= 0 ? '+$' : '-$') + Math.abs(t.delta).toLocaleString()).padStart(13)
    );
  }
  const best = r.reduce((a, b) => a.end > b.end ? a : b), worst = r.reduce((a, b) => a.end < b.end ? a : b);
  console.log(`richest ${best.nm} $${best.end.toLocaleString()} | poorest ${worst.nm} $${worst.end.toLocaleString()} | spread $${(best.end - worst.end).toLocaleString()}`);
}

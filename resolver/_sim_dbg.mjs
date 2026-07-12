import { chromium } from 'playwright';
const root = '/home/user/fifty-overs-league';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); } catch (e) {} });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(2200);
await page.evaluate(() => {
  const w = document.getElementById('folWrap'); if (w) w.remove();
  // start a friendly directly: pending + suggested orders -> match
  const me = userTeam();
  let ix = -1; GD.teams.forEach((t, i) => { if (ix < 0 && t.name !== me.name) ix = i; });
  M = null; App.tossState = null;
  App.pending = { oppIx: ix, home: me.name, away: GD.teams[ix].name, ground: me.ground, pitch: 'balanced', weather: 'Sunny', seed: 4242, comp: 'friendly', __friendly: true, __tut: 1 };
  suggestOrders(); App.orders.saved = true;
  location.hash = '#/match'; route();
});
await page.waitForTimeout(2500);
console.log('state', JSON.stringify(await page.evaluate(() => ({
  live: typeof M !== 'undefined' && !!M && !M.done, btn: !!document.getElementById('fo-simres')
}))));
await page.click('#fo-simres');
await page.waitForTimeout(1000);
console.log('t+1s', JSON.stringify(await page.evaluate(() => ({
  btnTxt: (document.getElementById('fo-simres') || {}).textContent || null,
  done: typeof M !== 'undefined' && M && M.done, legal: typeof M !== 'undefined' && M && M.innings && M.innings[M.inns] && M.innings[M.inns].legal
}))));
for (const t of [4000, 8000, 15000]) {
  await page.waitForTimeout(t - (t === 4000 ? 1000 : t === 8000 ? 4000 : 8000));
  console.log('t+' + t / 1000 + 's', JSON.stringify(await page.evaluate(() => ({
    done: typeof M !== 'undefined' && M && M.done,
    result: (typeof M !== 'undefined' && M && M.result && M.result.text) || null
  }))));
}
if (errs.length) console.log('ERRORS:', errs.slice(0, 5));
await browser.close();

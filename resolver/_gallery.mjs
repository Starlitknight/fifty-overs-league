// Render every page of the game (desktop + phone) for the design-review gallery.
import { chromium } from 'playwright';
const OUT = process.argv[2];
const browser = await chromium.launch();

async function shoot(viewport, tag, mobile) {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await page.goto('file:///home/user/fifty-overs-league/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    App.teamIx = 0; seasonInit(); econInit();
    window.completeRound(); window.completeRound();
    const t = GD.teams[App.teamIx];
    t._trainReport = { round: 2, gains: [t.players[0].name + ': batting vs pace +1', t.players[2].name + ': stamina +1'], recovery: [], signings: [] };
    try { window.store('fo_welcomed', '1'); } catch (e) {}
    const w = document.getElementById('folWrap'); if (w) w.remove();
  });
  const shots = [
    ['club', async () => { await page.evaluate(() => { location.hash = '#/club'; window.route(); setTimeout(() => window.pgClub(), 250); }); }],
    ['squad', async () => { await page.evaluate(() => { location.hash = '#/squad'; window.route(); }); }],
    ['matches', async () => { await page.evaluate(() => { location.hash = '#/matches'; window.route(); }); }],
    ['orders', async () => { await page.evaluate(() => { location.hash = '#/orders'; window.route(); }); }],
    ['matchday', async () => { await page.evaluate(() => { location.hash = '#/matchday'; window.route(); setTimeout(() => { const b = document.getElementById('fo-md-skip'); b && b.click(); }, 300); }); }],
    ['scorecard', async () => { await page.evaluate(() => { location.hash = '#/scorecard?i=0'; window.route(); }); }],
    ['training', async () => { await page.evaluate(() => { location.hash = '#/training'; window.route(); }); }],
    ['transfers', async () => { await page.evaluate(() => { location.hash = '#/transfers'; window.route(); }); }],
    ['office', async () => { await page.evaluate(() => { location.hash = '#/office'; window.route(); }); }],
    ['guide', async () => { await page.evaluate(() => { location.hash = '#/guide'; window.route(); }); }],
    ['onboarding', async () => { await page.evaluate(() => { window.__folOnbPreview(); }); }],
  ];
  for (const [nm, fn] of shots) {
    await fn(); await page.waitForTimeout(650);
    await page.screenshot({ path: `${OUT}/${nm}-${tag}.jpg`, type: 'jpeg', quality: 45 });
    console.log(nm, tag, 'ok');
  }
  await page.close();
}
await shoot({ width: 1366, height: 980 }, 'desktop', false);
await shoot({ width: 390, height: 844 }, 'phone', true);
await browser.close();

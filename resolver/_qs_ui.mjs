import { chromium } from 'playwright';
const root = '/home/user/fifty-overs-league';
const out = '/tmp/claude-0/-home-user-fifty-overs-league/fd97e4c6-7fde-5c2d-80af-769250de90c8/scratchpad';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); } catch (e) {} });
await page.goto('file://' + root + '/index.html');
await page.waitForTimeout(2200);
await page.evaluate(() => { const w = document.getElementById('folWrap'); if (w) w.remove(); });
await page.evaluate(() => window.__foQs.start({ name: '', country: 'India', draft_seed: 987654, id: 't1' }));
await page.waitForTimeout(300);
await page.type('#fo-qs-nm', 'Harbor Heights CC', { delay: 10 });
await page.waitForTimeout(200);
console.log('STEP1 abbr auto =', await page.inputValue('#fo-qs-ab'));
await page.screenshot({ path: out + '/qs1-name.png' });
await page.click('#fo-qs-c1'); await page.waitForTimeout(300);
await page.click('.fo-qs-pitch[data-p="dry"]'); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/qs2-pitch.png' });
await page.click('#fo-qs-c2'); await page.waitForTimeout(300);
console.log('STEP3', JSON.stringify(await page.evaluate(() => ({
  cards: document.querySelectorAll('.fo-qs-arch').length,
  names: [...document.querySelectorAll('.fo-qs-anm')].slice(0, 4).map(x => x.textContent),
  wizardSyn: (document.querySelector('.fo-qs-arch[data-a="wizard"] .fo-qs-syn') || {}).textContent || null,
  ctaDisabled: document.querySelector('#fo-qs-go').disabled
}))));
await page.screenshot({ path: out + '/qs3-starters.png' });
await page.click('.fo-qs-arch[data-a="wizard"]'); await page.waitForTimeout(250);
await page.screenshot({ path: out + '/qs3b-selected.png' });
await page.click('#fo-qs-go'); await page.waitForTimeout(900);
console.log('CONFIRM', JSON.stringify(await page.evaluate(() => ({
  h1: (document.querySelector('#fo-onb .fo-ob-h1') || {}).textContent,
  starter: (document.querySelector('.fo-qs-star-nm') || {}).textContent,
  shape: [...document.querySelectorAll('.fo-qs-shape span')].map(x => x.textContent),
  tal: [...document.querySelectorAll('.fo-qs-star-tal i')].map(x => x.textContent)
}))));
await page.screenshot({ path: out + '/qs4-confirm.png' });
await page.click('#fo-qs-enter'); await page.waitForTimeout(1200);
console.log('WORLD', JSON.stringify(await page.evaluate(() => {
  const t = GD.teams[App.teamIx || 0];
  const star = (t.players || []).find(p => p.origin_tag);
  return { club: t.name, n: (t.players || []).length, arch: t.archetype, bank: App.fin && App.fin.bank,
    star: star && star.name, tag: star && star.origin_tag, wk: t.players.filter(p => p.keeper).length };
})));
await page.evaluate(() => { location.hash = '#/club'; if (typeof route === 'function') route(); });
await page.waitForTimeout(900);
const gold = await page.evaluate(() => window.__foQs.goldenTest('Meow Monks'));
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/qs6-golden.png' });
await page.click('#fo-qs-gold-btn').catch(e => console.log('gold click fail', e.message));
await page.waitForTimeout(500);
console.log('GOLDEN AFTER', JSON.stringify(await page.evaluate(() => ({
  ok: !!document.querySelector('.fo-qs-gold-ok'),
  captain: App.orders && App.orders.captain
}))));
await page.screenshot({ path: out + '/qs7-golden-done.png' });
const tk = await page.evaluate(() => {
  const bot = JSON.parse(JSON.stringify(GD.teams[2] || GD.teams[1]));
  window.__foTk.test(bot);
  return bot.name;
});
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/tk1-name.png' });
await page.click('#fo-tk-c1'); await page.waitForTimeout(300);
await page.screenshot({ path: out + '/tk2-offers.png' });
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => window.__foQs.start({ name: 'Harbor Heights CC', country: 'India', draft_seed: 987654, id: 't1' }));
await page.waitForTimeout(200);
await page.evaluate(() => { window.__foQs.state().pitch = 'dry'; window.__foQs.starter(); });
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/qs3-desktop.png' });
if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 8).join(' | '));
await browser.close();

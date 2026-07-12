import { chromium } from 'playwright';
const root = '/home/user/fifty-overs-league';
const out = '/tmp/claude-0/-home-user-fifty-overs-league/fd97e4c6-7fde-5c2d-80af-769250de90c8/scratchpad';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); localStorage.setItem('fo_onb_done', '1'); } catch (e) {} });
await page.goto('file://' + root + '/index.html');
await page.waitForTimeout(2200);

// epoch helper sanity
console.log('EPOCH', JSON.stringify(await page.evaluate(() => ({
  none: window.__foRelaunch.epochOf({ teams: [{}, {}] }),
  some: window.__foRelaunch.epochOf({ teams: [{ __foEpoch: 5 }, { __foEpoch: 9 }, {}] })
}))));

// the relaunch gate message screen (real render path)
await page.evaluate(() => window.__foRelaunch.gate(1752300000000));
await page.waitForTimeout(400);
console.log('GATE', JSON.stringify(await page.evaluate(() => ({
  visible: document.getElementById('folWrap').classList.contains('on'),
  h1: (document.querySelector('#folWrap h1') || {}).textContent,
  cta: !!document.querySelector('[data-act="refound"]'),
  epoch: window.__foRelaunchEpoch
}))));
await page.screenshot({ path: out + '/rl1-gate.png' });

// tap "Found my new club" -> old flags cleared -> quick-start opens
await page.click('[data-act="refound"]');
await page.waitForTimeout(500);
console.log('REFOUND', JSON.stringify(await page.evaluate(() => ({
  qsOpen: !!document.querySelector('#fo-onb .fo-qs-wrap'),
  onbDone: localStorage.getItem('fo_onb_done') || '(cleared)',
  step1: (document.querySelector('#fo-onb .fo-ob-h1') || {}).textContent
}))));

// walk the flow to commit; club must carry the relaunch era + open sponsor slot
await page.evaluate(() => { window.__foQs.start({ name: '', country: 'India', draft_seed: 424242, id: 't9' }); });
await page.waitForTimeout(200);
await page.type('#fo-qs-nm', 'Phoenix Rising CC');
await page.click('#fo-qs-c1'); await page.waitForTimeout(200);
await page.click('.fo-qs-pitch[data-p="green"]'); await page.click('#fo-qs-c2'); await page.waitForTimeout(200);
await page.click('.fo-qs-arch[data-a="express"]'); await page.click('#fo-qs-go'); await page.waitForTimeout(800);
await page.click('#fo-qs-enter'); await page.waitForTimeout(1000);
console.log('COMMIT', JSON.stringify(await page.evaluate(() => {
  const t = GD.teams[App.teamIx || 0];
  return { club: t.name, epoch: t.__foEpoch, sponsor: t.sponsor === undefined ? '(open)' : t.sponsor,
    deal: t.sponsorDeal === undefined ? '(open)' : t.sponsorDeal, bank: App.fin && App.fin.bank };
})));

// the Office must offer the one-time sponsor signing for a deal-less club
await page.evaluate(() => { location.hash = '#/office'; if (typeof route === 'function') route(); });
await page.waitForTimeout(1500);
const office = await page.evaluate(() => {
  const txt = (document.getElementById('page').textContent || '');
  return { hasPicker: /sponsor/i.test(txt) && (/sign/i.test(txt) || /deal/i.test(txt)),
    snippet: (txt.match(/.{0,120}sponsor.{0,160}/i) || [''])[0].replace(/\s+/g, ' ') };
});
console.log('OFFICE', JSON.stringify(office));
await page.screenshot({ path: out + '/rl2-office-sponsor.png' });
if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 6).join(' | '));
await browser.close();

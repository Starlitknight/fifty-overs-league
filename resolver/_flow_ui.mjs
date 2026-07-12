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
const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: out + '/ob' + n + '.png' }); };

// enter the real onboarding with a ready team row (no network needed)
await page.evaluate(() => window.__foOnb.start({ name: 'Harbor Heights CC', country: 'India', draft_seed: 987654, id: 't1' }));
await shot('01-create');
await page.click('#fo-ob-c1'); await shot('02-charter');           // create -> charter
await page.click('#fo-ob-c'); await shot('03-money');              // charter -> money
await page.click('#fo-ob-c'); await shot('04-sponsor');            // money -> sponsor
await page.click('.fo-pk[data-sp="results"]'); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/ob04b-sponsor-picked.png' });
await page.click('#fo-ob-c'); await shot('05-players');            // sponsor -> player primer 1
for (let i = 0; i < 3; i++) { await page.click('#fo-ob-c'); await page.waitForTimeout(250); }
await shot('05d-allrounder');
await page.click('#fo-ob-c'); await shot('06-conditions');         // -> conditions
await page.click('#fo-ob-c'); await shot('07-team');               // -> squad builder 1/3
await page.click('.fo-qs-arch[data-a="express"]'); await page.waitForTimeout(200);
await page.click('#fo-ob-c'); await shot('08-captains');           // -> captains 2/3
await page.click('.fo-qs-capt[data-c="ironman"]'); await page.waitForTimeout(200);
await page.click('#fo-ob-c'); await page.waitForTimeout(600); await shot('09-comp');   // -> composition 3/3
console.log('COMP0', JSON.stringify(await page.evaluate(() => ({
  money: (document.getElementById('fo-comp-money') || {}).textContent,
  comp: window.__foQs.state().comp
}))));
// grow the squad to 18: +2 batters +1 seamer, then try to break the rules
for (let i = 0; i < 2; i++) await page.click('.fo-comp-btn[data-k="bat"][data-d="1"]');
await page.click('.fo-comp-btn[data-k="pace"][data-d="1"]');
await page.waitForTimeout(600);
console.log('COMP18', JSON.stringify(await page.evaluate(() => ({
  money: (document.getElementById('fo-comp-money') || {}).textContent,
  comp: window.__foQs.state().comp
}))));
await page.click('.fo-comp-btn[data-k="wk"][data-d="1"]');  // would make 19 -> blocked
await page.waitForTimeout(200);
console.log('BLOCK19', JSON.stringify(await page.evaluate(() => ({
  note: (document.getElementById('fo-comp-note') || {}).textContent,
  total: (o => Object.values(o).reduce((s, v) => s + v, 0))(window.__foQs.state().comp)
}))));
await page.screenshot({ path: out + '/ob09b-comp18.png' });
await page.click('#fo-ob-c'); await page.waitForTimeout(800); await shot('10-report');  // sign -> report (or risk)
console.log('REPORT', JSON.stringify(await page.evaluate(() => ({
  h1: (document.querySelector('#fo-onb .fo-ob-h1') || {}).textContent,
  facts: [...document.querySelectorAll('.fo-fact')].map(x => x.textContent.replace(/\s+/g, ' ')).slice(0, 5),
  picked: App.founder.picked.length,
  fees: App.founder.picked.reduce((s, p) => s + (p.fee || 0), 0)
}))));
// commit (solo: engine founderConfirm only)
await page.click('#fo-ob-done'); await page.waitForTimeout(1200);
console.log('WORLD', JSON.stringify(await page.evaluate(() => {
  const t = GD.teams[App.teamIx || 0];
  const cap = (t.players || []).find(p => p.origin_tag && /Franchise captain/.test(p.origin_tag));
  return { club: t.name, n: t.players.length, arch: t.archetype, pitch: t.homePitch, sponsor: t.sponsor,
    bank: App.fin && App.fin.bank, cap: cap && cap.name, capFlav: cap && cap.captFlavour,
    tut: localStorage.getItem('fo_qs_tut'), gold: localStorage.getItem('fo_qs_new') };
})));
await page.evaluate(() => { location.hash = '#/club'; if (typeof route === 'function') route(); });
await page.waitForTimeout(1400);
console.log('TUT', JSON.stringify(await page.evaluate(() => ({
  open: !!document.getElementById('fo-tut'), plans: document.querySelectorAll('.fo-tut-plan').length
}))));
await page.screenshot({ path: out + '/ob11-tutorial.png' });
await page.click('.fo-tut-plan[data-p="attack"]'); await page.waitForTimeout(1500);
await page.evaluate(() => { try { let g = 0; while (typeof M !== 'undefined' && M && !M.done && g++ < 3000) { autoPick(); stepBall(); } } catch (e) {} });
await page.waitForTimeout(5500);
console.log('FULLTIME', JSON.stringify(await page.evaluate(() => ({
  modal: !!document.getElementById('fo-tut2'), txt: (document.querySelector('#fo-tut2 h3') || {}).textContent
}))));
await page.screenshot({ path: out + '/ob12-fulltime.png' });
await page.click('#fo-tut2-go').catch(() => {});
await page.waitForTimeout(900);
await page.evaluate(() => { location.hash = '#/squad'; if (typeof route === 'function') route(); });
await page.waitForTimeout(1200);
console.log('SQUAD', JSON.stringify(await page.evaluate(() => ({
  chip: document.querySelectorAll('#page .fo-capt-chip').length, glow: document.querySelectorAll('#page .fo-capt-glow').length,
  n: GD.teams[App.teamIx].players.length
}))));
await page.screenshot({ path: out + '/ob13-squad.png' });
if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 8).join(' | '));
await browser.close();

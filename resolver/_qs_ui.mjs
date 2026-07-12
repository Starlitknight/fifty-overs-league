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

// determinism: pool card === squad captain, for every flavour
console.log('DET', JSON.stringify(await page.evaluate(() => {
  const pool = window.__foGenCaptainPool('seed-777', 'Australia', 'blade');
  const names = pool.map(p => p.name);
  const uniq = new Set(names).size === 6;
  const match = window.__foCaptFlavours.every((F, i) =>
    window.__foGenArchetypeSquad('seed-777', 'Australia', 'blade', F.id).players[0].name === names[i]);
  const ages = pool.map(p => p.age), capts = pool.map(p => p.capt);
  return { uniqNames: uniq, poolMatchesSquad: match, ages, capts };
})));

// flow: name -> pitch -> team -> captain -> confirm
await page.evaluate(() => window.__foQs.start({ name: '', country: 'India', draft_seed: 987654, id: 't1' }));
await page.waitForTimeout(250);
await page.type('#fo-qs-nm', 'Harbor Heights CC');
await page.click('#fo-qs-c1'); await page.waitForTimeout(250);
await page.click('.fo-qs-pitch[data-p="dry"]'); await page.click('#fo-qs-c2'); await page.waitForTimeout(250);
await page.click('.fo-qs-arch[data-a="wizard"]'); await page.waitForTimeout(150);
await page.click('#fo-qs-go'); await page.waitForTimeout(500);   // -> captain step (no setup needed)
console.log('CAPT STEP', JSON.stringify(await page.evaluate(() => ({
  cards: document.querySelectorAll('.fo-qs-capt').length,
  h1: (document.querySelector('#fo-onb .fo-ob-h1') || {}).textContent,
  first: (document.querySelector('.fo-qs-capt .fo-qs-cnm') || {}).textContent,
  ctaDisabled: document.querySelector('#fo-qs-cgo').disabled
}))));
await page.screenshot({ path: out + '/qs4-captains.png' });
await page.click('.fo-qs-capt[data-c="master"]'); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/qs4b-captain-sel.png' });
await page.click('#fo-qs-cgo'); await page.waitForTimeout(700);
console.log('CONFIRM', JSON.stringify(await page.evaluate(() => ({
  starter: (document.querySelector('.fo-qs-star-nm') || {}).textContent,
  tag: (document.querySelectorAll('.fo-qs-star-tag')[1] || {}).textContent,
  story: !!document.querySelector('.fo-qs-star .fo-qs-star-meta[style*="italic"]'),
  ctas: [(document.querySelector('#fo-qs-enter') || {}).textContent, (document.querySelector('#fo-qs-skip') || {}).textContent]
}))));
await page.screenshot({ path: out + '/qs5-confirm.png' });

// warm-up path: commit + tutorial
await page.click('#fo-qs-enter'); await page.waitForTimeout(1200);
const world = await page.evaluate(() => {
  const t = GD.teams[App.teamIx || 0];
  const cap = (t.players || []).find(p => p.origin_tag && /Franchise captain/.test(p.origin_tag));
  return { club: t.name, n: t.players.length, cap: cap && cap.name, capAge: cap && cap.age, capt: cap && cap.capt,
    tag: cap && cap.origin_tag, story: !!(cap && cap.backstory), tutFlag: localStorage.getItem('fo_qs_tut') };
});
console.log('WORLD', JSON.stringify(world));
await page.evaluate(() => { location.hash = '#/club'; if (typeof route === 'function') route(); });
await page.waitForTimeout(1400);
console.log('TUT MODAL', JSON.stringify(await page.evaluate(() => ({
  open: !!document.getElementById('fo-tut'),
  h3: (document.querySelector('#fo-tut h3') || {}).textContent,
  plans: document.querySelectorAll('.fo-tut-plan').length,
  fit: (document.querySelector('.fo-tut-fit') || {}).textContent || null
}))));
await page.screenshot({ path: out + '/qs6-tutorial-call.png' });
// pick the recommended plan -> match page
await page.click('.fo-tut-plan[data-p="squeeze"]'); await page.waitForTimeout(1500);
console.log('MATCH', JSON.stringify(await page.evaluate(() => ({
  hash: location.hash, pending: !!(App.pending && App.pending.__tut), ordersSaved: App.orders && App.orders.saved,
  pi: App.orders && App.orders.phaseIntent, started: typeof M !== 'undefined' && !!M
}))));
// sim the match to completion in-page (the engine's own loop functions)
await page.evaluate(() => { try { let g = 0; while (typeof M !== 'undefined' && M && !M.done && g++ < 3000) { autoPick(); stepBall(); } } catch (e) {} });
await page.waitForTimeout(5500);   // tut watcher (2s poll) + 2.2s delay
console.log('FULLTIME', JSON.stringify(await page.evaluate(() => ({
  done: typeof M !== 'undefined' && M && M.done,
  modal: !!document.getElementById('fo-tut2'),
  txt: (document.querySelector('#fo-tut2 h3') || {}).textContent
}))));
await page.screenshot({ path: out + '/qs7-fulltime.png' });
await page.click('#fo-tut2-go').catch(() => {});
await page.waitForTimeout(900);
// captain glow on squad page
await page.evaluate(() => { location.hash = '#/squad'; if (typeof route === 'function') route(); });
await page.waitForTimeout(1200);
console.log('SQUAD', JSON.stringify(await page.evaluate(() => ({
  chip: document.querySelectorAll('#page .fo-capt-chip').length,
  glow: document.querySelectorAll('#page .fo-capt-glow').length
}))));
await page.screenshot({ path: out + '/qs8-squad-captain.png' });
if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 8).join(' | '));
await browser.close();

import { chromium } from 'playwright';
const root = '/home/user/fifty-overs-league';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); } catch (e) {} });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(2200);
await page.evaluate(() => {
  const w = document.getElementById('folWrap'); if (w) w.remove();
  localStorage.setItem((typeof lsGet === 'function' ? '' : '') + 'fo_qs_tut', '1');   // may be prefixed - set raw too
  location.hash = '#/club'; route();
});
await page.waitForTimeout(1500);
console.log('tut modal', await page.evaluate(() => !!document.getElementById('fo-tut')));
// if the raw key didn't match the overlay's prefix, force the tutorial directly
await page.evaluate(() => { if (!document.getElementById('fo-tut') && window.__foQs) { try { window.__foQsTutorial && window.__foQsTutorial(); } catch (e) {} } });
await page.waitForTimeout(600);
const open = await page.evaluate(() => !!document.getElementById('fo-tut'));
console.log('tut open', open);
if (open) {
  await page.click('.fo-tut-plan[data-p="attack"]');
  await page.waitForTimeout(2000);
  console.log('pre-sim', JSON.stringify(await page.evaluate(() => ({ live: !!M && !M.done, iv: !!window.__foTutIv, btn: !!document.getElementById('fo-simres') }))));
  await page.click('#fo-simres');
  await page.waitForTimeout(1500);
  console.log('post-sim', JSON.stringify(await page.evaluate(() => ({ done: !!M && M.done, iv: !!window.__foTutIv }))));
  await page.waitForTimeout(6000);
  console.log('modal', JSON.stringify(await page.evaluate(() => ({ tut2: !!document.getElementById('fo-tut2'), hash: location.hash }))));
}
if (errs.length) console.log('ERRORS:', errs.slice(0, 5));
await browser.close();

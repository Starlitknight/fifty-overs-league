import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); } catch (e) {} });
await page.goto('file://' + path.join(root, 'index.html') + '#/matches');
await page.waitForTimeout(2500);
await page.evaluate(() => { const w = document.getElementById('folWrap'); if (w) w.style.display = 'none'; location.hash = '#/matches'; route(); });
await page.waitForTimeout(1800);
const r = await page.evaluate(() => ({
  panel: !!document.getElementById('fo-frs'),
  fxHeader: (() => { let t = null; document.querySelectorAll('.panel').forEach(pn => { const h = pn.querySelector('h4'); if (h && /Fixtures & results/i.test(h.textContent)) t = pn.querySelector('table'); }); return t ? t.rows[0].textContent.trim().replace(/\s+/g, '|') : null; })(),
}));
// orders page renders
await page.evaluate(() => { location.hash = '#/orders'; route(); });
await page.waitForTimeout(900);
const r2 = await page.evaluate(() => ({
  ordersBar: !!document.querySelector('.fo-orders-bar'),
  crumb: (document.querySelector('.crumb') || {}).textContent || null
}));
console.log(JSON.stringify({ ...r, ...r2, errs }, null, 1));
await browser.close();

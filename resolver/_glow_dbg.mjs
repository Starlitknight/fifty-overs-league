import { chromium } from 'playwright';
const root = '/home/user/fifty-overs-league';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => { try { localStorage.setItem('fo_welcomed', '1'); localStorage.setItem('fo_club', '0'); } catch (e) {} });
await page.goto('file://' + root + '/index.html'); await page.waitForTimeout(2000);
await page.evaluate(() => {
  const w = document.getElementById('folWrap'); if (w) w.remove();
  const g = window.__foGenArchetypeSquad('s1', 'India', 'rock', 'master');
  const t = GD.teams[0]; t.players = g.players; App.teamIx = 0;
  location.hash = '#/squad'; if (typeof route === 'function') route();
});
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(() => {
  const chip = document.querySelector('#page .fo-capt-chip');
  if (!chip) return { chip: false };
  const chain = [];
  let el = chip;
  for (let i = 0; i < 7 && el; i++) { chain.push(el.tagName + '.' + (el.className && el.className.baseVal !== undefined ? '(svg)' : el.className)); el = el.parentElement; }
  return { chip: true, chain };
}), null, 1));
await b.close();

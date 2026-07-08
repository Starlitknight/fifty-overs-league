// Simulate the production "new member joins a started league" flow end-to-end
// with a mocked Supabase, and assert the panel is never blank.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../client/game.html');
const SB = 'https://egaipdksvztqqgouriyc.supabase.co';

const browser = await chromium.launch();
const ctx = await browser.newContext();

// A started league whose snapshot contains OTHER clubs, not the new member's.
const SNAP = { v: 2, seasonNo: 1, teamIx: 0, teams: [
  { name: 'Admin XI', ground: 'HQ', players: [], youth: [], bank: 1, founded: true },
  { name: 'Bot Rovers', ground: 'X', players: [], youth: [], bank: 1 },
], season: { round: 3 }, round: 3, results: [], news: [], history: [], fin: { bank: 1 } };

function json(body) { return { status: 200, contentType: 'application/json', body: JSON.stringify(body) }; }

async function run(label, { drafted, mineInSnap }) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route(SB + '/**', route => {
    const u = route.request().url();
    if (u.includes('/rest/v1/leagues')) return route.fulfill(json([{ id: 'L1', name: 'Test League', status: 'started', build_hash: null, draft_budget: 1000000, season_no: 1 }]));
    if (u.includes('/rest/v1/teams')) return route.fulfill(json([
      { id: 'T1', name: 'Admin XI', country: 'ENG', draft_seed: 's1', manager_id: 'M1' },
      { id: 'T2', name: 'Newbie CC', country: 'ENG', draft_seed: 's2', manager_id: 'M2' },
    ]));
    if (u.includes('/rest/v1/members')) return route.fulfill(json([
      { id: 'M1', role: 'founder', display_name: 'Admin' },
      { id: 'M2', role: 'member', display_name: 'Newbie' },
    ]));
    if (u.includes('/rpc/resolve_manager_id')) return route.fulfill(json('M2'));
    if (u.includes('/rest/v1/league_state')) {
      const snap = JSON.parse(JSON.stringify(SNAP));
      if (mineInSnap) snap.teams.push({ name: 'Newbie CC', ground: 'N', players: [], youth: [], bank: 1, founded: true });
      return route.fulfill(json([{ snapshot: snap, version: 7, round: 3 }]));
    }
    if (u.includes('/rest/v1/league_clubs')) return route.fulfill(json(drafted ? [{ manager_id: 'M2' }] : []));
    if (u.includes('/auth/')) return route.fulfill(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
    return route.fulfill(json([]));
  });
  // logged-in session, token valid for an hour
  await page.addInitScript(() => localStorage.setItem('fol_session', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Date.now() + 3600e3 })));
  await page.goto('file://' + GAME, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const main = document.querySelector('#folMain');
    const wrapOn = document.querySelector('#folWrap').classList.contains('on');
    return {
      wrapOn,
      onb: !!document.querySelector('#fo-onb'),
      onbText: (document.querySelector('#fo-onb') || { textContent: '' }).textContent.replace(/\s+/g, ' ').slice(0, 60),
      mainText: main.textContent.replace(/\s+/g, ' ').trim().slice(0, 140),
      mainEmpty: !main.innerHTML.trim(),
      hash: location.hash,
      pageLen: (document.querySelector('#page') || { innerHTML: '' }).innerHTML.length,
    };
  });
  console.log(`\n[${label}]`);
  console.log(`  wrapOn=${r.wrapOn} mainEmpty=${r.mainEmpty} onboarding=${r.onb} hash=${r.hash} pageLen=${r.pageLen}`);
  console.log(`  main: ${r.mainText || '(empty)'}`);
  if (r.onb) console.log(`  onb: ${r.onbText}`);
  console.log(`  errors: ${errs.length ? errs.join(' | ').slice(0, 200) : '(none)'}`);
  await page.close();
  return r;
}

// Case 1: user's exact bug — joined after kick-off, hasn't drafted → must get draft/onboarding, NOT blank
const a = await run('late joiner, undrafted', { drafted: false, mineInSnap: false });
// Case 2: late joiner who HAS drafted → waiting lobby with 'season already running' note
const b = await run('late joiner, drafted', { drafted: true, mineInSnap: false });
// Case 3: normal member in snapshot → enters the game (wrap closes)
const c = await run('member in snapshot', { drafted: true, mineInSnap: true });

let ok = true;
const chk = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) ok = false; };
chk(!a.mainEmpty || a.onb, 'undrafted late joiner: never blank (draft or message shown)');
chk(a.onb || /draft/i.test(a.mainText), 'undrafted late joiner: sent to draft flow');
chk(!b.mainEmpty && /already running|Waiting|restart/i.test(b.mainText), 'drafted late joiner: waiting lobby with restart note');
chk(!c.wrapOn && c.pageLen > 500, 'member in snapshot: enters the game');
process.exit(ok ? 0 : 1);

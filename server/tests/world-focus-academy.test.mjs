// world-focus-academy.test.mjs — A FOCUS, A TALLER ACADEMY, AND A BOOK.
//
// Three additions to the training ground, and one obligation shared by all of
// them: training_rounds banks the plan and the academy level in force every
// round, and living.mjs replays those rounds from the founding to rebuild
// every squad. So nothing here may change what an ALREADY BANKED plan means
// or what an ALREADY BANKED level is worth. Every test below is either about
// the new thing working, or about the old thing not moving.
//
//   1. a bare programme name still trains exactly as it always did;
//   2. a focus doubles that skill's share and rescales the rest - the session
//      is the same size, only its aim has moved;
//   3. a focus naming a skill the programme does not train is ignored;
//   4. levels one to five keep their exact rate, fee and upkeep;
//   5. six to ten exist, climb, and are priced the same in SQL and in JS;
//   6. a better academy really does train faster;
//   7. the book of the nets is written from the replay, and reading it back
//      reconstructs the squad the umpire actually built.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { academyRate, ACADEMY_MAX, evolveCountry } from '../living.mjs';
import { academyUpkeep, academyBuild } from '../economy.mjs';
import { tierOdds, dealYouthToAll } from '../youth.mjs';
import { runDue } from '../tick.mjs';
import { EPOCH, DAY, natHour } from '../clock.mjs';

const DB = 'fofocus_test';
let pool, host;
const UID = '55555555-5555-5555-5555-555555555555';
const START = 101;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;

const rested = p => Object.assign({}, p, { fatN: 0, fatWord: 'rested', fatigue: 'rested', trainProgress: {} });
const banked = p => { const t = {}; const tp = p.trainProgress || {}; for (const k in tp) t[k] = tp[k]; return t; };
const total = t => Object.values(t).reduce((a, b) => a + b, 0);

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  // 075 founds the world with empty academies; the youth-training tests
  // below cover the RETAINED machinery, so this file deals the boys itself
  await dealYouthToAll(pool, host, 'eng', {});
  await pool.query(`INSERT INTO claims(user_id, country_id, slot, display_name) VALUES ($1,'eng',1,'Tester')`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
});
after(async () => { if (pool) await pool.end(); });

// ---------------------------------------------------------------------------
// THE FOCUS
// ---------------------------------------------------------------------------
test('a bare programme name trains exactly as it always did', () => {
  const men = host.genSquad('focus|old', 'England', 'balanced', 'general').slice(0, 5).map(rested);
  const plan = {}; men.forEach(p => { plan[p.name] = 'Batting'; });
  const a = host.trainRound(men.map(rested), plan, 1, null).players.map(banked);
  // the same plan filed the NEW way with no focus named must be identical:
  // that is the promise the old shape makes to every round already banked
  const plan2 = {}; men.forEach(p => { plan2[p.name] = { p: 'Batting', f: null }; });
  const b = host.trainRound(men.map(rested), plan2, 1, null).players.map(banked);
  for (let i = 0; i < men.length; i++) {
    assert.deepEqual(Object.keys(a[i]).sort(), Object.keys(b[i]).sort(), men[i].name + ' works the same skills');
    for (const k in a[i]) {
      assert.ok(Math.abs(a[i][k] - b[i][k]) < 1e-9,
        men[i].name + ' banks the same in ' + k + ' (' + a[i][k] + ' vs ' + b[i][k] + ')');
    }
  }
});

test('a focus doubles that skill\'s share and rescales the rest', () => {
  // THE ARITHMETIC, NOT ONE PROGRAMME'S ARITHMETIC. A focus doubles the named
  // skill's WEIGHT and the session is renormalised, so every other skill gives
  // up ground proportionally. The shares are read off the programme itself:
  // Batting has gained a share for the hands since this was written, and a
  // test that had memorised its old fractions would call that a regression.
  const men = host.genSquad('focus|spin', 'England', 'balanced', 'general')
    .filter(p => p.skills && p.skills.vsSpin != null && p.skills.vsPace != null).slice(0, 6).map(rested);
  assert.ok(men.length >= 3, 'found batters with both skills to read');
  const auto = {}, focused = {};
  men.forEach(p => { auto[p.name] = 'Batting'; focused[p.name] = { p: 'Batting', f: 'vsSpin' }; });
  const A = host.trainRound(men.map(rested), auto, 1, null).players.map(banked);
  const F = host.trainRound(men.map(rested), focused, 1, null).players.map(banked);
  const BAT = host.trainProgs ? host.trainProgs()['Batting'] : null;
  const sum = w => Object.values(w).reduce((a, b) => a + b, 0);
  const wantAuto = BAT ? BAT.vsSpin / sum(BAT) : 0.25;
  const wantFocus = BAT ? (2 * BAT.vsSpin) / (sum(BAT) + BAT.vsSpin) : 0.40;
  const wantPace = BAT ? BAT.vsPace / (sum(BAT) + BAT.vsSpin) : 0.20;
  let checked = 0;
  for (let i = 0; i < men.length; i++) {
    const ta = total(A[i]), tf = total(F[i]);
    if (ta < 1) continue;                         // a man who popped a skill mid-round
    // THE SESSION IS THE SAME SIZE. Focus moves work, it does not create it.
    assert.ok(Math.abs(ta - tf) / ta < 0.02,
      men[i].name + ': the session is the same size (' + ta.toFixed(1) + ' vs ' + tf.toFixed(1) + ')');
    const shareA = A[i].vsSpin / ta, shareF = F[i].vsSpin / tf;
    assert.ok(Math.abs(shareA - wantAuto) < 0.02,
      men[i].name + ': auto sends the programme\'s own share to spin (' +
      shareA.toFixed(3) + ' against ' + wantAuto.toFixed(3) + ')');
    assert.ok(Math.abs(shareF - wantFocus) < 0.02,
      men[i].name + ': focused sends double the weight (' +
      shareF.toFixed(3) + ' against ' + wantFocus.toFixed(3) + ')');
    // and the others fall proportionally to pay for it
    const paceF = F[i].vsPace / tf;
    assert.ok(Math.abs(paceF - wantPace) < 0.02,
      men[i].name + ': pace gives up ground to pay for it (' +
      paceF.toFixed(3) + ' against ' + wantPace.toFixed(3) + ')');
    checked++;
  }
  assert.ok(checked >= 3, 'the arithmetic was checkable on several men (' + checked + ')');
});

test('a focus on a skill the programme does not train changes nothing', () => {
  const men = host.genSquad('focus|junk', 'England', 'balanced', 'general').slice(0, 5).map(rested);
  const plain = {}, junk = {};
  men.forEach(p => { plain[p.name] = 'Batting'; junk[p.name] = { p: 'Batting', f: 'keeping' }; });
  const A = host.trainRound(men.map(rested), plain, 1, null).players.map(banked);
  const B = host.trainRound(men.map(rested), junk, 1, null).players.map(banked);
  for (let i = 0; i < men.length; i++) {
    for (const k in A[i]) {
      assert.ok(Math.abs(A[i][k] - B[i][k]) < 1e-9,
        men[i].name + ': a focus outside the programme is no focus at all (' + k + ')');
    }
  }
});

// ---------------------------------------------------------------------------
// THE ACADEMY AT TEN
// ---------------------------------------------------------------------------
test('levels one to five have not moved by a penny or a percent', () => {
  // the exact figures 040/018 shipped. If any of these change, every bank
  // settled and every session worked at that level is quietly re-priced.
  const RATE = { 1: 0.92, 2: 1.00, 3: 1.08, 4: 1.16, 5: 1.24 };
  const UPKEEP = { 1: 6000, 2: 14000, 3: 26000, 4: 44000, 5: 70000 };
  const STEP = { 1: 400000, 2: 900000, 3: 1800000, 4: 3200000 };
  for (let lv = 1; lv <= 5; lv++) {
    assert.ok(Math.abs(academyRate(lv) - RATE[lv]) < 1e-9, 'rate at level ' + lv);
    assert.equal(academyUpkeep(lv), UPKEEP[lv], 'upkeep at level ' + lv);
    if (STEP[lv]) assert.equal(academyBuild(lv, lv + 1), STEP[lv], 'the step from ' + lv + ' to ' + (lv + 1));
  }
});

test('six to ten exist, climb, and never get cheaper', () => {
  assert.equal(ACADEMY_MAX, 10);
  for (let lv = 6; lv <= 10; lv++) {
    assert.ok(Math.abs(academyRate(lv) - (1.24 + 0.05 * (lv - 5))) < 1e-9, 'five per cent a rung at ' + lv);
    assert.ok(academyRate(lv) > academyRate(lv - 1), 'level ' + lv + ' trains faster than ' + (lv - 1));
    assert.ok(academyUpkeep(lv) > academyUpkeep(lv - 1), 'level ' + lv + ' costs more to run than ' + (lv - 1));
    assert.ok(academyBuild(lv - 1, lv) >= academyBuild(lv - 2, lv - 1), 'the steps never get cheaper at ' + lv);
  }
  assert.ok(Math.abs(academyRate(10) - 1.49) < 1e-9, 'the top of the ladder is +49%');
  // and the tier ladder carries up with it, monotonically
  let lastJ = 0, lastG = 0;
  for (let lv = 1; lv <= 10; lv++) {
    const [j, g, av] = tierOdds(lv);
    assert.ok(j >= lastJ && g >= lastG, 'jewels and good boys no rarer at level ' + lv);
    assert.ok(j + g + av <= 1, 'the odds at level ' + lv + ' still leave room for a poor boy');
    lastJ = j; lastG = g;
  }
});

test('the SQL and the JavaScript quote the same prices all the way up', async () => {
  for (let lv = 1; lv <= 10; lv++) {
    const up = Number((await pool.query('SELECT academy_upkeep($1) u', [lv])).rows[0].u);
    assert.equal(up, academyUpkeep(lv), 'upkeep at level ' + lv);
    for (let to = lv + 1; to <= 10; to++) {
      const c = Number((await pool.query('SELECT academy_build_cost($1,$2) c', [lv, to])).rows[0].c);
      assert.equal(c, academyBuild(lv, to), 'build ' + lv + ' -> ' + to);
    }
  }
  assert.equal(Number((await pool.query('SELECT academy_max() m')).rows[0].m), ACADEMY_MAX);
});

test('a club can build past five, and is never sold back down', async () => {
  await pool.query(`UPDATE clubs SET bank=90000000 WHERE country_id='eng' AND slot=1`);
  const r = (await pool.query(`SELECT world_set_academy(8) r`)).rows[0].r;
  assert.equal(Number(r.academy), 8);
  assert.equal(Number(r.cost), academyBuild(2, 8));
  const c = (await pool.query(`SELECT academy, bank, academy_paid FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(c.academy, 8, 'the level stands at eight');
  assert.equal(Number(c.bank), 90000000 - academyBuild(2, 8), 'and the treasury paid for it');
  await assert.rejects(() => pool.query(`SELECT world_set_academy(7)`), /never sold back/);
  await assert.rejects(() => pool.query(`SELECT world_set_academy(11)`), /1 to 10/);
  const st = (await pool.query(`SELECT world_my_academy() a`)).rows[0].a;
  assert.equal(Number(st.maxLevel), 10);
  assert.equal(Number(st.upkeep), academyUpkeep(8));
  assert.equal(Number(st.nextUpkeep), academyUpkeep(9));
  assert.equal(Number(st.nextCost), academyBuild(8, 9));
  await pool.query(`UPDATE clubs SET academy=2, academy_paid=0, bank=2500000 WHERE country_id='eng' AND slot=1`);
});

test('a taller academy really does bank more work in a round', () => {
  const men = host.genSquad('acad|ten', 'England', 'balanced', 'general').slice(0, 8);
  const sum = rate => host.trainRound(men.map(rested), {}, rate, null)
    .players.reduce((t, p) => t + total(banked(p)), 0);
  const two = sum(academyRate(2)), ten = sum(academyRate(10));
  assert.ok(ten > two * 1.4, 'level ten outworks level two by about half (' + (ten / two).toFixed(2) + 'x)');
});

// ---------------------------------------------------------------------------
// THE BOOK OF THE NETS
// ---------------------------------------------------------------------------
test('the book is written from the replay, and reads back to the real squad', async () => {
  assert.equal(natHour('eng'), 14, 'the test clock assumes the 14:00 league');
  const PREBANK = EPOCH + START * DAY + 14 * 3600000 - 3600000 + 4 * 60000;
  await runDue(pool, host, 'eng', { now: PREBANK });
  // A SKILL MOVES SLOWLY ON PURPOSE. A session banks about twenty-four points
  // spread over five skills, against a threshold of eighty plus one and a
  // half times the skill - so a man needs twenty or thirty rounds to step up
  // once, and a fortnight of nets would leave the rewind below proving
  // nothing. Bank a season and a half of the same standing plan directly,
  // which is exactly what the umpire does at every settle, and replay those.
  for (let rd = 2; rd <= 46; rd++) {
    await pool.query(
      `INSERT INTO training_rounds(country_id, slot, season_no, round, plan, academy, coach, xi)
       SELECT c.country_id, c.slot, 1, $2, coalesce(c.training,'{}'::jsonb), c.academy, 0, NULL
         FROM clubs c WHERE c.country_id=$1
       ON CONFLICT (country_id, slot, season_no, round) DO NOTHING`, ['eng', rd]);
  }
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);

  const mine = (await pool.query(
    `SELECT squad, nets_history FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const bk = mine.nets_history;
  assert.ok(bk, 'the managed club has a book');
  assert.ok(Array.isArray(bk.steps), 'and it is a list of steps');
  // EVERY ROUND THE CLUB TRAINED IS IN IT. Not "most" and not "the recent
  // ones": the book is the replay, and the replay starts at the founding.
  const bankedRounds = +(await pool.query(
    `SELECT count(*)::int n FROM training_rounds WHERE country_id='eng' AND slot=1`)).rows[0].n;
  assert.ok(bankedRounds >= 40, 'the club has a stretch of rounds banked (' + bankedRounds + ')');
  assert.equal(bk.rounds.length, bankedRounds, 'every banked round is tallied in the book');
  // every round tallied names programmes real men were really set to
  for (const r of bk.rounds) {
    assert.ok(Object.keys(r.p).length >= 1, 'season ' + r.s + ' round ' + r.r + ' has programmes');
    assert.ok(r.a >= 1 && r.a <= 10, 'and the academy level in force is on the record');
  }
  // AN UNMANAGED CLUB GETS NONE. Nobody reads it, so nobody pays for it.
  const other = (await pool.query(
    `SELECT nets_history FROM clubs WHERE country_id='eng' AND slot=2`)).rows[0];
  assert.equal(other.nets_history, null, 'a club nobody manages keeps no book');

  // THE REWIND. The page reconstructs any past round by walking the steps
  // backwards from today - a step to `to` means the man stood at `to - 1`
  // before it. Prove the arithmetic closes: rewinding EVERY step off today's
  // squad must land on the club's untouched baseline skills.
  const now = new Map((mine.squad || []).map(p => [p.name, Object.assign({}, p.skills)]));
  for (const g of bk.steps.slice().reverse()) {
    const s = now.get(g.n);
    if (s && s[g.k] !== undefined) s[g.k] = g.to - 1;
  }
  let compared = 0;
  for (const p of (mine.squad || [])) {
    const base = p.baseSkills; if (!base) continue;
    for (const k in base) {
      assert.equal(now.get(p.name)[k], Math.round(base[k]),
        p.name + ': rewinding ' + k + ' lands on the baseline the world generated');
      compared++;
    }
  }
  assert.ok(compared >= 50, 'the rewind was checked across the squad (' + compared + ' skills)');
  assert.ok(bk.steps.length >= 5, 'and men stepped up over the rounds worked (' + bk.steps.length + ')');
  for (const g of bk.steps) {
    assert.ok(g.s >= 1 && g.r >= 1 && g.n && g.k && g.to >= 1,
      'every step names a season, a round, a man, a skill and the figure he reached');
  }

  // the book reaches a manager through his own status and nobody else's
  const st = (await pool.query(`SELECT world_my_status() s`)).rows[0].s;
  assert.ok(st.netsHistory, 'world_my_status carries the book');
  assert.equal(st.netsHistory.steps.length, bk.steps.length);
  assert.equal(Number(st.academyMax), 10, 'and says how tall the ladder is');
});

test('the book is rebuilt whole, never appended to', async () => {
  const before = (await pool.query(
    `SELECT nets_history FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].nets_history;
  // settle the very same evening again: a cache of a derivation must settle
  // the identical figure, or it is a second record and it will drift
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);
  const after2 = (await pool.query(
    `SELECT nets_history FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].nets_history;
  assert.deepEqual(after2, before, 're-settling the same evening writes the same book');
});

// ---------------------------------------------------------------------------
// THE BOYS TRAIN (059)
// ---------------------------------------------------------------------------
test('a colt goes through the nets like anybody else', async () => {
  const before = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].youth;
  const boys = before.filter(y => y && y.baseSkills);
  assert.ok(boys.length >= 5, 'there are boys on the books to read (' + boys.length + ')');

  // the founding sixteen arrived with the world and carry no joining round,
  // so every one of the rounds banked above is a round they were here for
  const moved = boys.filter(y => {
    for (const k in (y.baseSkills || {})) {
      if (Math.round(y.skills[k] || 0) !== Math.round(y.baseSkills[k] || 0)) return true;
    }
    return false;
  });
  assert.ok(moved.length >= 1,
    'at least one boy has stepped up over the rounds worked (' + moved.length + ' of ' + boys.length + ')');
  const banked = boys.filter(y => y.trainProgress && Object.keys(y.trainProgress).length);
  assert.equal(banked.length, boys.length, 'and every boy has work banked, not just the ones who popped');

  // A BOY IS NEVER STRONGER THAN THE NETS MADE HIM. His skills are his
  // baseline plus the rounds he worked, and nothing else touches them.
  for (const y of boys) {
    for (const k in (y.baseSkills || {})) {
      assert.ok(Math.round(y.skills[k] || 0) >= Math.round(y.baseSkills[k] || 0),
        y.name + ' never went backwards in ' + k);
    }
  }
});

test('a boy signed today is not handed the seasons before he arrived', async () => {
  // THE WHOLE POINT OF THE JOINING STAMP. Drop a fresh colt onto the books
  // with a joining round of NOW, settle, and he must have done nothing - the
  // club has forty-six rounds banked and not one of them is his.
  const club = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const s = +(await pool.query(
    `SELECT coalesce(max(season_no),1) s FROM seasons WHERE country_id='eng'`)).rows[0].s;
  const r = +(await pool.query(
    `SELECT coalesce(max(round),0)+1 r FROM training_rounds WHERE country_id='eng' AND slot=1 AND season_no=$1`,
    [s])).rows[0].r;
  const fresh = JSON.parse(JSON.stringify(club.youth[0]));
  fresh.name = 'Newcomer Lad';
  fresh.skills = JSON.parse(JSON.stringify(fresh.baseSkills));
  delete fresh.trainProgress;
  fresh.joined = { s, r };
  await pool.query(
    `UPDATE clubs SET youth = youth || $2::jsonb WHERE country_id='eng' AND slot=$1`,
    [1, JSON.stringify([fresh])]);
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);

  const after = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].youth
    .find(y => y.name === 'Newcomer Lad');
  assert.ok(after, 'he is on the books');
  const banked = Object.values(after.trainProgress || {}).reduce((a, b) => a + b, 0);
  assert.equal(banked, 0, 'and has done not one session of work he was not there for');
  for (const k in (after.baseSkills || {})) {
    assert.equal(Math.round(after.skills[k] || 0), Math.round(after.baseSkills[k] || 0),
      'his ' + k + ' is exactly what he walked in with');
  }
});

test('a club nobody manages has its boys trained too', async () => {
  // an offline club must never be a worse club for being offline: the umpire
  // runs its nets whether anyone is watching or not
  const other = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=2`)).rows[0].youth;
  const worked = (other || []).filter(y => y.trainProgress && Object.keys(y.trainProgress).length);
  assert.ok(worked.length >= 5, 'slot 2 has boys with work banked (' + worked.length + ')');
});

test('the promoted boy keeps every session he ever did', async () => {
  // THE TRAP. A promotion moves him from clubs.youth to clubs.squad, and the
  // two are replayed separately from their own baselines. Without freezing
  // what the academy made of him, three seasons of nets vanish on the morning
  // he is handed a shirt - the club's reward for developing him being to
  // undevelop him.
  const club = (await pool.query(
    `SELECT youth, squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const boy = club.youth.find(y => {
    for (const k in (y.baseSkills || {})) {
      if (Math.round(y.skills[k] || 0) > Math.round(y.baseSkills[k] || 0)) return true;
    }
    return false;
  });
  assert.ok(boy, 'found a boy the academy actually improved');
  const grown = JSON.parse(JSON.stringify(boy.skills));

  await pool.query(`UPDATE clubs SET bank=9000000 WHERE country_id='eng' AND slot=1`);
  await pool.query(`SELECT world_colt($1,'promote')`, [boy.name]);

  const man = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad
    .find(p => p.name === boy.name);
  assert.ok(man, 'he is in the senior squad');
  assert.ok(man.joined, 'with the round he first wore the shirt');
  for (const k in grown) {
    assert.equal(Math.round(man.baseSkills[k] || 0), Math.round(grown[k] || 0),
      'his senior baseline in ' + k + ' is what the academy made of him, not what he was scouted at');
  }
  // and a settle does not undo it
  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);
  const after = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad
    .find(p => p.name === boy.name);
  for (const k in grown) {
    assert.ok(Math.round(after.skills[k] || 0) >= Math.round(grown[k] || 0),
      'he did not get weaker overnight in ' + k + ' (' + after.skills[k] + ' vs ' + grown[k] + ')');
  }
});

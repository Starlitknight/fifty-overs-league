// tests/world-earned-talents.test.mjs — A CRICKETER COMES BY A TALENT.
//
// Talents are rare and dealt: about one man in nine arrives with one. This is
// the other way to get one, and the whole of it is a fold of the record - the
// ball engine credits a trigger every time a man is in the situation a talent
// describes and does the job, the card carries those counts out with the runs
// and the wickets, and the umpire adds them up again from scratch on every
// settle. Nothing is incremented in place, so a re-settle lands on the same
// figure and a man who never played never earns anything.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { evolveCountry, livingPatch, applyLiving, talentsEarned } from '../living.mjs';
import { coltRecords, dealYouthToAll } from '../youth.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DBNAME = 'foworld_talents_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
  // 075 founds the world with empty academies; the colts tests below cover
  // the RETAINED machinery, so this file deals the boys itself
  await dealYouthToAll(pool, host, 'eng', {});
});
after(async () => { await pool.end(); });

test('the engine credits a trigger only where the talent would have fired', async () => {
  const cs = (await pool.query(
    `SELECT slot, name, ground, squad FROM clubs WHERE country_id='eng' AND slot IN (0,1) ORDER BY slot`)).rows;
  const [a, b] = cs;
  const card = JSON.parse(host.runMatch(
    { name: a.name, ground: a.ground, players: a.squad },
    { name: b.name, ground: b.ground, players: b.squad }, 'balanced', 991, null, 'Sunny'));
  const tal = card.tal;
  assert.ok(tal, 'the card carries what the men learned');
  assert.deepEqual(Object.keys(tal).sort(), [a.name, b.name].sort(),
    'keyed by side, so a slot resolves and two men sharing a name cannot be confused');

  const byName = {};
  for (const side of Object.keys(tal)) for (const nm of Object.keys(tal[side])) byName[nm] = tal[side][nm];
  const squadOf = {}; [...a.squad, ...b.squad].forEach(p => { squadOf[p.name] = p; });

  let checked = 0;
  for (const nm of Object.keys(byName)) {
    const p = squadOf[nm];
    assert.ok(p, nm + ' is one of the twenty-two');
    for (const t of Object.keys(byName[nm])) {
      // never a talent he already owns - there is nothing left to learn
      assert.ok((p.talents || []).indexOf(t) < 0, nm + ' is credited for ' + t + ' he already has');
      // and never one he could not develop: the draft's table and the ball
      // loop's table are the same table
      assert.ok(host.talElig(p, t), nm + ' (' + p.role + ') cannot develop ' + t);
      checked++;
    }
  }
  assert.ok(checked > 30, 'a match teaches a good many men something: ' + checked);

  // a keeper stands for every ball of the innings he keeps; nobody bats for
  // more balls than were bowled
  const T = host.talThresholds();
  assert.ok(T.lightningHands > T.finisher * 10,
    'the thresholds are scaled to how often the condition comes up, not chosen flat');
});

test('progress is a fold of the record, and crossing it is permanent', async () => {
  // Rather than play the two or three seasons it honestly takes, the record is
  // given a match whose tally is already at the threshold - which is exactly
  // what a hundred real matches would leave behind, and tests the fold rather
  // than the engine's arithmetic a second time.
  const T = host.talThresholds();
  const club = (await pool.query(
    `SELECT slot, name, squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const opener = club.squad.find(p => p.role === 'opener'
    && (p.talents || []).indexOf('fastStarter') < 0 && (p.talents || []).indexOf('anchor') < 0);
  assert.ok(opener, 'an opener with neither Fast Starter nor Anchor');
  const born = (opener.talents || []).slice();
  const other = (await pool.query(`SELECT slot, name FROM clubs WHERE country_id='eng' AND slot=2`)).rows[0];

  const season = (await pool.query(
    `SELECT season_no, start_day FROM seasons WHERE country_id='eng'`)).rows[0];
  const bank = async (round, n) => {
    await pool.query(
      `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
         engine_version, pitch, result, home_name, away_name)
       VALUES ($1,'eng',$2,$3,1,2,1,'v2','balanced',$4::jsonb,$5,$6)`,
      [`eng:s${season.season_no}:r${round}:h1a2`, season.season_no, round,
       JSON.stringify({ winner: club.name, text: 'x', mom: null,
         innings: [{ batTeam: club.name, bowlTeam: other.name, runs: 200, wkts: 5, legal: 300,
                     bat: [], bowlers: {}, fielding: {} }],
         tal: { [club.name]: { [opener.name]: { fastStarter: n } } } }),
       club.name, other.name]);
  };

  // half way there
  await bank(1, Math.floor(T.fastStarter / 2));
  await evolveCountry(pool, 'eng', T0 + 3 * DAY, host);
  let man = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`))
    .rows[0].squad.find(p => p.name === opener.name);
  assert.equal(man.talProg.fastStarter, Math.floor(T.fastStarter / 2), 'the triggers are on his card');
  assert.ok(!man.talEarned, 'and half way is not there');
  assert.ok((man.talents || []).indexOf('fastStarter') < 0, 'he has not got it yet');

  // A RE-SETTLE IS NOT A SECOND HALF. The fold adds the record up again from
  // nothing; if it accumulated onto what was already there, this would double.
  await evolveCountry(pool, 'eng', T0 + 4 * DAY, host);
  man = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`))
    .rows[0].squad.find(p => p.name === opener.name);
  assert.equal(man.talProg.fastStarter, Math.floor(T.fastStarter / 2), 'settling twice settles the same figure');

  // the rest of the way
  await bank(2, T.fastStarter);
  await evolveCountry(pool, 'eng', T0 + 5 * DAY, host);
  man = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`))
    .rows[0].squad.find(p => p.name === opener.name);
  assert.equal(man.talEarned, 'fastStarter', 'he has earned it');
  assert.ok((man.talents || []).indexOf('fastStarter') >= 0, 'and it is on his card like any other');
  assert.ok(!man.talProg || man.talProg.fastStarter == null,
    'what earned it stops being progress - it is a talent now');

  // ONE A CAREER. Another talent, past its own threshold, is not a second.
  await bank(3, 0);
  await pool.query(
    `UPDATE matches SET result = jsonb_set(result, '{tal}', $1::jsonb)
      WHERE country_id='eng' AND round=3`,
    [JSON.stringify({ [club.name]: { [opener.name]: { anchor: T.anchor * 3 } } })]);
  await evolveCountry(pool, 'eng', T0 + 6 * DAY, host);
  man = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`))
    .rows[0].squad.find(p => p.name === opener.name);
  assert.equal(man.talEarned, 'fastStarter', 'the one he earned is still the one he earned');
  assert.deepEqual((man.talents || []).slice().sort(), born.concat(['fastStarter']).sort(),
    'his card is what he was born with plus the one he earned, and nothing else');
  assert.ok((man.talProg || {}).anchor > 0,
    'the triggers are still counted and still shown - he simply cannot cash a second one');
});

test('a half-learnt talent is part of the cricket, so a replay carries it', async () => {
  const club = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const man = club.squad.find(p => p.talProg && Object.keys(p.talProg).length) ||
              club.squad.find(p => p.talEarned);
  assert.ok(man, 'somebody at this club is part of the way to something');
  const patch = livingPatch(club.squad, []);
  assert.ok(patch[man.name].tp || patch[man.name].te,
    'the patch a broadcast replays from carries what he has learned');
  // and laying it back over a freshly generated squad restores him exactly
  const fresh = JSON.parse(JSON.stringify(club.squad)).map(p => {
    const q = { ...p }; delete q.talProg; delete q.talEarned;
    if (q.talEarned) q.talents = (q.talents || []).filter(t => t !== p.talEarned);
    return q;
  });
  applyLiving(fresh, patch, host);
  const back = fresh.find(p => p.name === man.name);
  assert.deepEqual(back.talProg || null, man.talProg || null, 'his progress comes back');
  if (man.talEarned) assert.equal(back.talEarned, man.talEarned, 'and so does what he earned');
});

test('a cup tie and a week with his country count, and a friendly does not', async () => {
  const T = host.talThresholds();
  const club = (await pool.query(
    `SELECT slot, name, squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0];
  const man = club.squad.find(p => p.role === 'opener' && !(p.talents || []).includes('anchor'));
  assert.ok(man, 'an opener without Anchor');
  const season = (await pool.query(
    `SELECT season_no FROM seasons WHERE country_id='eng'`)).rows[0].season_no;

  const before = ((await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`))
    .rows[0].squad.find(p => p.name === man.name).talProg || {}).anchor || 0;

  // A CUP TIE. The side blob names a country and a slot, so the credit lands
  // on the club without going near a name.
  await pool.query(
    `INSERT INTO cup_matches(comp, season_no, stage, gi, a, b, seed, engine_version, result, result_canonical)
     VALUES ('wcl',$1,'qf',0,$2::jsonb,$3::jsonb,1,'v2',$4::jsonb,'x')`,
    [season,
     JSON.stringify({ country: 'eng', slot: 3, name: club.name }),
     JSON.stringify({ country: 'aus', slot: 0, name: 'Somebody Else' }),
     JSON.stringify({ winner: club.name, innings: [],
       tal: { [club.name]: { [man.name]: { anchor: 40 } } } })]);

  // A WEEK WITH HIS COUNTRY, credited from the callup that produced it.
  await pool.query(
    `INSERT INTO callups(country_id, season_no, round, pick, slot, player, fee)
     VALUES ('eng',$1,4,1,3,$2,0) ON CONFLICT DO NOTHING`, [season, man.name]);
  await pool.query(
    `INSERT INTO nat_matches(id, world_day, season_no, round, a_country, b_country, a_name, b_name,
       seed, engine_version, result, result_canonical)
     VALUES ('eng-tour-1',110,$1,4,'eng','aus','England','Australia',1,'v2',$2::jsonb,'x')`,
    [season, JSON.stringify({ winner: 'England', innings: [],
       tal: { England: { [man.name]: { anchor: 25 } } } })]);

  // A FRIENDLY. Kept in its own table, never read here, and that is the whole
  // of how "everything except friendlies" is enforced - not a flag that can be
  // set wrong, but a source this fold does not look at.
  const friendlyCols = (await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name='friendlies'`)).rows[0].n;
  assert.equal(friendlyCols, 1, 'friendlies really are a separate table');

  await evolveCountry(pool, 'eng', T0 + 7 * DAY, host);
  const after = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`))
    .rows[0].squad.find(p => p.name === man.name);
  assert.equal((after.talProg || {}).anchor, before + 65,
    'the cup tie and the tour both counted: ' + before + ' + 40 + 25');
});

test('a replay fields the man as he was, not as he has since become', async () => {
  // The half that is easy to get wrong. A broadcast lays the banked patch over
  // the club's squad AS IT STANDS NOW; a man who has earned a talent since the
  // match carries it in his list, and without the patch being authoritative in
  // BOTH directions he replays with a gift he had not yet been given.
  const club = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const earner = club.squad.find(p => p.talEarned);
  assert.ok(earner, 'somebody at this club has earned one by now');

  // the patch as it stood BEFORE he earned it: same men, no mention of it
  const asWas = JSON.parse(JSON.stringify(club.squad)).map(p => {
    const q = { ...p };
    if (q.talEarned) { q.talents = (q.talents || []).filter(t => t !== q.talEarned); delete q.talEarned; }
    delete q.talProg;
    return q;
  });
  const patch = livingPatch(asWas, []);
  assert.ok(!patch[earner.name].te, 'the old patch does not name a talent he had not earned');

  // laid over TODAY's squad, which does have it
  const today = JSON.parse(JSON.stringify(club.squad));
  applyLiving(today, patch, host);
  const back = today.find(p => p.name === earner.name);
  assert.ok(!back.talEarned, 'the replay does not know about a talent he earned later');
  assert.ok((back.talents || []).indexOf(earner.talEarned) < 0,
    'and it is off his card for the replay, or the broadcast is a different match');
  // what he was BORN with is never touched - only the earned one moves
  const born = (earner.talents || []).filter(t => t !== earner.talEarned);
  born.forEach(t => assert.ok((back.talents || []).indexOf(t) >= 0, t + ' is his and stays his'));
});

test('a boy in the academy learns too, and brings it with him', async () => {
  // THE COLTS CUP IS FIFTY OVERS. Two or three seasons of it is exactly the
  // span a talent takes, which is why a boy who could not accrue was the one
  // cricketer in the world for whom the whole mechanism did nothing.
  const T = host.talThresholds();
  const club = (await pool.query(
    `SELECT slot, name, youth FROM clubs WHERE country_id='eng' AND slot=5`)).rows[0];
  const boy = (club.youth || []).find(y => !(y.talents || []).includes('busyRunner'));
  assert.ok(boy, 'a colt without Busy Runner');
  const season = (await pool.query(
    `SELECT season_no FROM seasons WHERE country_id='eng'`)).rows[0].season_no;
  const sideName = club.name + ' Colts';

  await pool.query(
    `INSERT INTO cup_matches(comp, season_no, stage, gi, a, b, seed, engine_version, result, result_canonical)
     VALUES ($1,$2,'r16',0,$3::jsonb,$4::jsonb,1,'v2',$5::jsonb,'x')`,
    ['colts:eng', season,
     JSON.stringify({ country: 'eng', slot: 5, name: sideName }),
     JSON.stringify({ country: 'eng', slot: 6, name: 'Somebody Colts' }),
     JSON.stringify({ winner: sideName, innings: [],
       tal: { [sideName]: { [boy.name]: { busyRunner: Math.floor(T.busyRunner / 2) } } } })]);

  await coltRecords(pool, 'eng', season, host);
  let after = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng' AND slot=5`))
    .rows[0].youth.find(y => y.name === boy.name);
  assert.equal(after.talProg.busyRunner, Math.floor(T.busyRunner / 2),
    'the boy is halfway to Busy Runner');
  assert.ok(!after.talEarned, 'and halfway is not there');

  // THE SENIOR BOOK NEVER SEES A COLTS TIE. If it did, a colt's triggers would
  // be credited to a senior of the same name at the same club.
  await evolveCountry(pool, 'eng', T0 + 8 * DAY, host);
  const seniors = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=5`)).rows[0].squad;
  assert.ok(!seniors.some(p => p.name === boy.name), 'the boy is not in the senior squad');

  // AND HE CROSSES. The rest of the way, and the talent is his in the academy.
  await pool.query(
    `UPDATE cup_matches SET result = jsonb_set(result, '{tal}', $1::jsonb)
      WHERE comp='colts:eng' AND stage='r16' AND gi=0`,
    [JSON.stringify({ [sideName]: { [boy.name]: { busyRunner: T.busyRunner } } })]);
  await coltRecords(pool, 'eng', season, host);
  after = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng' AND slot=5`))
    .rows[0].youth.find(y => y.name === boy.name);
  assert.equal(after.talEarned, 'busyRunner', 'he has come by it in the academy');
  assert.ok((after.talents || []).includes('busyRunner'), 'and it is on his card');

  // WHAT HE BRINGS WITH HIM. A promotion freezes his progress into a carry,
  // and the senior fold ADDS to a carry rather than replacing it - the same
  // way a bought man's career survives the journey.
  const carried = { anchor: Math.floor(T.anchor / 2) };
  const asSenior = talentsEarned({ name: 'X', talents: [], talCarry: carried }, null, T);
  assert.equal(asSenior.talProg.anchor, carried.anchor,
    'a carry alone is progress: he does not arrive blank');
  const withBoth = talentsEarned({ name: 'X', talents: [], talCarry: carried },
    { anchor: Math.floor(T.anchor / 2) + 10 }, T);
  assert.equal(withBoth.talEarned, 'anchor',
    'and the academy plus the seniors is what takes him over');
});

test('a man sold keeps what he was learning', async () => {
  // The same rule as a promotion, for the same reason: the new club's book has
  // never seen him. Asserted on the shape rather than by running an auction,
  // because what is being tested is that the freeze happens at all.
  const T = host.talThresholds();
  const asBought = talentsEarned(
    { name: 'Y', talents: [], talCarry: { miser: 900, goldenArm: 40 } },
    { miser: 300 }, T);
  assert.equal(asBought.talProg.miser, 1200, 'his old club\'s work is added to his new club\'s');
  assert.equal(asBought.talProg.goldenArm, 40, 'and nothing he brought is dropped');
  // and a carry cannot resurrect a talent he already owns
  const owned = talentsEarned(
    { name: 'Y', talents: ['miser'], talCarry: { miser: 5000 } }, null, T);
  assert.ok(!owned.talProg || owned.talProg.miser == null,
    'there is nothing left to learn about a talent he has');
});

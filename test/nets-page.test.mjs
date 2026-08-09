/* test/nets-page.test.mjs — THE NETS PAGE ACTUALLY DRAWS.
 *
 * WHY THIS FILE EXISTS. The last renderer bug that reached a phone was a var
 * function expression called four lines above where it was declared: it
 * hoisted as undefined, the rankings page threw on every load, and every
 * server suite passed the whole time, because no test had ever drawn a page.
 * A renderer that is never run is a renderer nobody has checked.
 *
 * So this drives the SHIPPED build - the same index.html a browser loads -
 * through foRenderNetsPage with a real squad and a real book of the nets, in
 * every chart view, and reads the markup that comes out. The DOM in the
 * harness swallows writes, which is why the renderer hands its HTML back.
 *
 * WHAT IT HOLDS TO:
 *   1. the page draws at all, with a row and two pickers for every man;
 *   2. the four things the redesign removed are GONE - no explainer, no stat
 *      band, no "one programme a man", and above all no session countdown,
 *      because a manager is not to be told how long a step will take;
 *   3. every chart view draws without throwing, empty book or full;
 *   4. the focus picker offers exactly the skills the programme trains;
 *   5. the academy strip quotes the ladder's real rates and bills.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const { ctx } = makeEngine();
const run = (src) => vm.runInContext(src, ctx);

const SKILLS = { vsPace: 52, vsSpin: 48, rotation: 55, temperament: 50, stamina: 44,
  power: 41, wicket: 30, economy: 33, discipline: 36, moveTurn: 29, variation: 26,
  keeping: 12, catching: 47, stumping: 9, fielding: 51 };

function man(name, age, extra) {
  return Object.assign({
    name, age, role: 'opener', hand: 'R', bowlTypeFull: 'none', bowlType: '',
    rating: 41000, wage: 1500, no: 0,
    skills: Object.assign({}, SKILLS),
    baseSkills: Object.assign({}, SKILLS),
    fatWord: 'rested', fatigue: 'rested', fatN: 0
  }, extra || {});
}
const SQUAD = [
  man('Alan Frost', 19),
  man('Bertie Hale', 24, { role: 'allRounder' }),
  man('Cass Iremonger', 28, { keeper: true, role: 'wicketkeeper' }),
  man('Dai Pemberton', 31, { bowlTypeFull: 'seamFast', bowlType: 'seamFast' }),
  man('Eli Sarkar', 22, { bowlTypeFull: 'wristSpin', bowlType: 'wristSpin' })
];
const BOYS = [
  man('Rory Vane', 16, { colt: true }),
  man('Sam Kettleby', 18, { colt: true, bowlTypeFull: 'seamMedium', bowlType: 'seamMedium' }),
  man('Tobias Ng', 20, { colt: true, keeper: true, role: 'wicketkeeper' })
];

/** Seat the harness in a club whose squad is the men above. */
function seat(withYouth) {
  run(`GD.teams = ${JSON.stringify([{
    name: 'Mashed Potatoes', ground: 'The Field', founded: true, bank: 400000, seats: 15000,
    supporters: 12000, mood: 3, homePitch: 'balanced', youth: BOYS, players: SQUAD
  }])}; App.teamIx = 0;`).toString();
  if (withYouth === false) run(`GD.teams[0].youth = [];`);
  try { run(`foSetMyClub("Mashed Potatoes")`); } catch (e) {}
}
/** A book of the nets: three rounds, with real steps in it. */
function book() {
  return {
    steps: [
      { s: 1, r: 2, n: 'Alan Frost', k: 'vsPace', to: 51 },
      { s: 1, r: 2, n: 'Alan Frost', k: 'vsPace', to: 52 },
      { s: 1, r: 3, n: 'Alan Frost', k: 'rotation', to: 55 },
      { s: 1, r: 3, n: 'Eli Sarkar', k: 'moveTurn', to: 29 }
    ],
    rounds: [
      { s: 1, r: 1, p: { Batting: 3, Bowling: 2 }, a: 2 },
      { s: 1, r: 2, p: { Batting: 3, Bowling: 2 }, a: 2 },
      { s: 1, r: 3, p: { Batting: 2, Bowling: 2, Rest: 1 }, a: 3 }
    ]
  };
}
function draw(chart, hist, crew) {
  seat();
  run(`window.__foNetsCrew = ${JSON.stringify(crew || 'sen')};`);
  run(`window.__foNetsHistory = ${hist === undefined ? JSON.stringify(book()) : JSON.stringify(hist)};`);
  run(`window.__foWorldAcademy = 7;`);
  run(`window.__foNetsChart = ${JSON.stringify(chart || 'climb')};`);
  return run(`(function(){
    var h = foRenderNetsPage();
    return typeof h === 'string' ? h : '';
  })()`);
}

test('the nets renderer ships and draws a page', () => {
  assert.equal(run('typeof foRenderNetsPage'), 'function', 'the renderer is missing from the built game');
  const html = draw(null);
  assert.ok(html.length > 500, 'the page drew something (' + html.length + ' chars)');
  // the room is called Training now, not The Nets. Pinned to the H1 rather
  // than anywhere on the page: the masthead eyebrow says "THE TRAINING
  // GROUND", so a bare substring test would pass without a title at all.
  assert.ok(html.indexOf('<h1>Training</h1>') >= 0, 'with its own name on it');
});

test('every man gets a row, a programme picker and a focus picker', () => {
  const html = draw(null);
  for (const p of SQUAD) {
    assert.ok(html.indexOf(p.name) >= 0, p.name + ' is on the page');
    assert.ok(html.indexOf(`data-t2p='${p.name}'`) >= 0, p.name + ' has a programme picker');
    assert.ok(html.indexOf(`data-t2f='${p.name}'`) >= 0, p.name + ' has a focus picker');
  }
  // and the picker holds the eight offered programmes, not the retired fifteen
  for (const pg of ['Batting', 'Bowling', 'Keeping', 'Fielding', 'Fitness', 'Power hitting', 'All-rounder', 'Rest']) {
    assert.ok(html.indexOf(`>${pg}<`) >= 0 || html.indexOf(`value='${pg}'`) >= 0, pg + ' is offered');
  }
  for (const gone of ['New-ball seam', 'Death bowling', 'Control bowling', 'Spin batting']) {
    assert.ok(html.indexOf(`value='${gone}'`) < 0, gone + ' is retired from the picker');
  }
});

test('the four things the redesign removed are gone', () => {
  const html = draw(null);
  // 3. the hero subtitle
  assert.ok(html.indexOf('One programme a man') < 0, 'the hero line is gone');
  // 1. the explainer paragraph
  assert.ok(html.indexOf('Every man works the programme you set him') < 0, 'the explainer is gone');
  // 2. the four-stat band
  assert.ok(html.indexOf('fo-t2-band') < 0, 'the stat band is gone');
  for (const label of ['Squad in training', 'On rest', 'Work banked', 'Avg capacity']) {
    assert.ok(html.indexOf(label) < 0, 'the "' + label + '" tile is gone');
  }
  // 4. AND THE COUNTDOWN, which is the one that matters: no "3 / 7", no
  //    progress bar under a man's name, nothing that says how long a step
  //    will take. The past is shown in full; the future is not shown at all.
  assert.ok(html.indexOf('fo-t2-work') < 0, 'the work-banked column is gone');
  assert.ok(!/>\s*\d+\s*\/\s*\d+\s*&middot;/.test(html), 'no man carries a session count');
});

test('the page explains itself with nothing but the numbers', () => {
  // EVERY REMOVAL ASKED FOR, IN ONE PLACE. The nets are a chore you visit to
  // set a squad and leave; each of these was a paragraph standing between the
  // manager and that job, and none of them is coming back by accident.
  const gone = [
    'a session is always a session',
    'the eleven who play bank the full session',
    'Captaincy and experience are never trained',
    'The book of the nets is written by the world update',
    'One man, skill by skill, round by round',
    'steepest part of the curve',
    'Every man works the programme you set him',
    'One programme a man'
  ];
  for (const crew of ['sen', 'yth']) {
    for (const view of ['climb', 'thenNow', 'growing', 'work', 'age']) {
      const html = draw(view, undefined, crew);
      for (const g of gone) {
        assert.ok(html.indexOf(g) < 0, crew + '/' + view + ' has grown the sermon back: "' + g + '"');
      }
      // and nothing anywhere is a NaN, which is what a mangled concatenation
      // looks like on a page that is otherwise all numbers
      assert.ok(html.indexOf('NaN') < 0, crew + '/' + view + ' printed a NaN');
      assert.ok(html.indexOf('undefined') < 0, crew + '/' + view + ' printed an undefined');
    }
  }
});

test('a focus offers exactly the skills his programme trains, and no others', () => {
  const html = draw(null);
  // Alan Frost is a specialist bat, so he opens on Batting:
  // {vsPace, vsSpin, rotation, temperament, stamina} and nothing else.
  const row = html.split(`data-t2f='Alan Frost'`)[1].split('</select>')[0];
  for (const good of ['playing pace', 'playing spin', 'strike rotation', 'temperament', 'stamina']) {
    assert.ok(row.indexOf(good) >= 0, 'Batting can be focused on ' + good);
  }
  for (const bad of ['keeping', 'stumping', 'wicket threat', 'variation']) {
    assert.ok(row.indexOf(bad) < 0, 'Batting cannot be focused on ' + bad);
  }
  assert.ok(row.indexOf('Auto') >= 0, 'and Auto is the way out of a focus');
  // a keeper opens on Keeping, so his options are the keeper's
  const krow = html.split(`data-t2f='Cass Iremonger'`)[1].split('</select>')[0];
  assert.ok(krow.indexOf('stumping') >= 0 && krow.indexOf('keeping') >= 0, 'a keeper works the gloves');
});

test('the academy box stays off the nets page', () => {
  // the manager sent it away: the academy has its own room, and the nets
  // page does not repeat it
  const html = draw(null);
  assert.equal(html.indexOf('fo-t2-acad'), -1, 'no academy card');
  assert.equal(html.indexOf('to reach level'), -1, 'no ladder quote');
  assert.equal(html.indexOf('a round to run'), -1, 'no upkeep quote');
});

test('every chart view draws, on a full book and on none at all', () => {
  // each view leaves its own mark, so this proves the bay really SWITCHED
  // rather than falling back to the first chart five times
  const VIEWS = [
    ['climb', 'The climb', "id='fo-t2-who'"],
    ['thenNow', 'Then &amp; now', 'fo-t2-radar'],
    ['growing', 'Who is growing', 'fo-t2-bars'],
    ['work', 'Where the work went', 'fo-t2-svg flat'],
    ['age', 'Growth against age', "fill-opacity='.55'"]
  ];
  for (const [v, title, mark] of VIEWS) {
    const full = draw(v);
    assert.ok(typeof full === 'string' && full.length > 500, v + ': the page drew with a book');
    assert.ok(full.indexOf('fo-t2-bay') >= 0, v + ': the bay is on the page');
    assert.ok(full.indexOf('>' + title + '<') >= 0, v + ': the picker names the view "' + title + '"');
    assert.ok(full.indexOf(mark) >= 0, v + ': it drew ' + v + ' and not another chart');
    assert.ok(full.indexOf(`value='${v}' selected`) >= 0, v + ': the picker stands on it');
    // AND NOTHING FORECASTS. Read the bay's own body, not the page: a
    // countdown would show as an "n / m" or as a sentence about what is
    // still to come, and neither belongs anywhere near a chart of the past.
    const body = full.split("class='fo-t2-cbody'")[1].split('</div></div>')[0];
    assert.ok(!/\d+\s*\/\s*\d+/.test(body), v + ': no chart counts sessions off');
    assert.ok(!/\b(until|to go|remaining|needs \d)\b/i.test(body), v + ': no chart predicts a step');
  }
  // and with no book at all - a brand new club, which is every club on the
  // day this ships - the bay says so rather than throwing
  const bare = draw('climb', null);
  assert.ok(typeof bare === 'string' && bare.length > 500, 'the page drew with no book');
  assert.ok(bare.indexOf('fo-t2-bay') >= 0, 'and the chart bay is still there');
  assert.ok(bare.indexOf('book of the nets') >= 0, 'saying where the charts come from');
});

test('a skill that pops twice in one round rewinds to where it started', () => {
  // THE BUG THIS LOCKS DOWN. Alan Frost's playing pace is 52 today and the
  // book says he went 51 then 52 inside round two, so before that round he
  // stood on 50 - a gain of two across the record. Rewinding the round's
  // steps in the order they HAPPENED lands on 51 and reports a gain of one,
  // and a young man's best week quietly halves itself on the chart.
  const html = draw('climb');
  const key = html.split("class='fo-t2-key'")[1].split('</div>')[0];
  assert.ok(/playing pace <b>\+2<\/b>/.test(key),
    'playing pace shows the two steps he really took: ' + key.replace(/<[^>]*>/g, ' ').trim());
});

test('the climb opens on the man the book has most to say about', () => {
  // NOT the youngest, who on a new club is a colt with a flat line and reads
  // as a broken page. Alan Frost has three steps in the book; Eli Sarkar has
  // one; nobody else has any - and the youngest man in the squad IS Alan, so
  // the book has to be what decides it, not his age.
  const html = draw('climb');
  assert.ok(html.indexOf('Alan Frost') >= 0, 'he is on the page');
  assert.ok(html.indexOf(`value='Alan Frost' selected`) >= 0, 'and the climb opens on him');
  // hand the book to somebody else entirely and the choice follows the book
  const other = { steps: [{ s: 1, r: 2, n: 'Dai Pemberton', k: 'moveTurn', to: 29 },
                          { s: 1, r: 3, n: 'Dai Pemberton', k: 'wicket', to: 30 }],
                  rounds: [{ s: 1, r: 2, p: { Bowling: 5 }, a: 2 },
                           { s: 1, r: 3, p: { Bowling: 5 }, a: 2 }] };
  const h2 = draw('climb', other);
  assert.ok(h2.indexOf(`value='Dai Pemberton' selected`) >= 0, 'the book decides, not the birthday');
});

test('a man with a flat book still leaves you a way to look at somebody else', () => {
  // the picker is never the thing a chart drops when it has nothing to draw:
  // land on a colt who has never stepped up and you must still be able to
  // move off him. Point the page at a man the book says nothing about.
  run(`window.__foNetsWho = "Bertie Hale";`);
  const html = draw('climb');
  assert.ok(html.indexOf('has not stepped up in anything yet') >= 0, 'it says so plainly');
  assert.ok(html.indexOf(`id='fo-t2-who'`) >= 0, 'and the picker is still there');
  assert.ok(html.indexOf(`value='Alan Frost'`) >= 0, 'with the rest of the squad in it');
  const bare = draw('thenNow', { steps: [], rounds: [] });
  assert.ok(bare.indexOf(`id='fo-t2-who'`) >= 0, 'the same on Then & now with no record at all');
  run(`window.__foNetsWho = null;`);
});

test('the focus arithmetic the page quotes is the engine\'s own', () => {
  // the page must never carry its own copy of this: the manager is shown a
  // plan the umpire then works, and two opinions of it is a lie on screen
  assert.equal(run('typeof window.FO_TRAIN_FOCUS'), 'function', 'the engine exports the focus weights');
  assert.equal(run('typeof window.FO_PLAN_ENTRY'), 'function', 'and the plan reader');
  const w = run(`JSON.stringify(window.FO_TRAIN_FOCUS('Batting','vsSpin'))`);
  const got = JSON.parse(w);
  assert.equal(got.vsSpin, 50, 'the focused share is doubled');
  assert.equal(got.vsPace, 25, 'the others are untouched in weight');
  const total = Object.values(got).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(got.vsSpin / total - 0.40) < 1e-9, 'which is two fifths of the session');
  assert.ok(Math.abs(got.vsPace / total - 0.20) < 1e-9, 'and a fifth for playing pace');
  // an unnamed focus is the programme untouched
  assert.equal(run(`JSON.stringify(window.FO_TRAIN_FOCUS('Batting',null))`),
    run(`JSON.stringify(window.FO_TRAIN_PROGS['Batting'])`), 'auto is the programme itself');
  // and the reader takes both shapes
  assert.equal(run(`JSON.stringify(window.FO_PLAN_ENTRY('Batting'))`), '{"p":"Batting","f":null}');
  assert.equal(run(`JSON.stringify(window.FO_PLAN_ENTRY({p:'Batting',f:'vsSpin'}))`), '{"p":"Batting","f":"vsSpin"}');
});

test('the two crews are two tabs, and each holds only its own men', () => {
  const sen = draw('climb', undefined, 'sen');
  assert.ok(sen.indexOf("data-t2crew='sen'") >= 0 && sen.indexOf("data-t2crew='yth'") >= 0,
    'both tabs are offered');
  assert.ok(sen.indexOf('Senior squad</span><i>' + SQUAD.length + '<') >= 0, 'the senior tab counts the five men');
  assert.ok(sen.indexOf('Youth squad</span><i>' + BOYS.length + '<') >= 0, 'and the youth tab counts the three boys');
  for (const p of SQUAD) assert.ok(sen.indexOf(`data-t2p='${p.name}'`) >= 0, p.name + ' is on the senior tab');
  for (const b of BOYS) assert.ok(sen.indexOf(`data-t2p='${b.name}'`) < 0, b.name + ' is not');

  const yth = draw('climb', undefined, 'yth');
  for (const b of BOYS) assert.ok(yth.indexOf(`data-t2p='${b.name}'`) >= 0, b.name + ' is on the academy tab');
  for (const p of SQUAD) assert.ok(yth.indexOf(`data-t2p='${p.name}'`) < 0, p.name + ' is not');
  // and each boy gets the same two decisions a senior gets
  for (const b of BOYS) assert.ok(yth.indexOf(`data-t2f='${b.name}'`) >= 0, b.name + ' has a focus picker');
  assert.ok(yth.indexOf('>Colt</span>') >= 0, 'and the youth tab calls them colts, not players');
  assert.ok(sen.indexOf('>Player</span>') >= 0, 'while the senior tab calls them players');
  // NEITHER NAME IS EVER A BOX. Each tab is only as wide as its own words -
  // the lit rule is drawn by the live tab's own ::after, so it can never span
  // half a card the way a segmented control does.
  assert.ok(sen.indexOf(`data-t2crew='sen'`) >= 0 && sen.indexOf("class='fo-t2-tab on'") >= 0,
    'the senior tab is the live one');
  assert.ok(yth.indexOf(`aria-selected='true'`) >= 0 && yth.indexOf("role='tablist'") >= 0,
    'and the pair reads as a tablist to anything that is not looking at it');
  // exactly one tab is lit at a time, on either side
  for (const [html, who] of [[sen, 'senior'], [yth, 'youth']]) {
    assert.equal((html.match(/class='fo-t2-tab on'/g) || []).length, 1, who + ': one tab is live');
    assert.equal((html.match(/aria-selected='true'/g) || []).length, 1, who + ': and says so once');
  }
});

test('a club with no boys is not shown a door to an empty room', () => {
  seat(false);
  run(`window.__foNetsCrew = "yth"; window.__foNetsHistory = null;`);
  const html = run(`String(foRenderNetsPage() || '')`);
  assert.ok(html.indexOf('data-t2crew') < 0, 'no tabs at all');
  for (const p of SQUAD) assert.ok(html.indexOf(`data-t2p='${p.name}'`) >= 0,
    p.name + ' is on the page - the seniors are never hidden behind a tab that is not there');
  run(`window.__foNetsCrew = "sen";`);
});

test('saving from one tab never files a plan with the other half missing', () => {
  // THE BUG THIS LOCKS DOWN. The page draws one crew at a time. A save that
  // walked only the VISIBLE rows files a plan naming three men out of eight,
  // and the umpire puts every unnamed man back on the programme his trade
  // implies - so a manager who sets his seamer to work on his batting, then
  // flips to the academy tab and presses save, silently loses it.
  //
  // Read the plan that actually goes to the world, which is the only thing
  // that decides what the umpire works.
  seat();
  const filed = run(`(function(){
    // a club in the served world, so the save goes through the world push
    window.__foWorldClaim = { country: 'eng', slot: 1, club: 'Mashed Potatoes' };
    window.__foWorldPlan = {};
    window.__foNetsHistory = null;
    var pushed = null;
    window.__foWorldPushTraining = function (plan) { pushed = plan; };

    var page = { innerHTML: '', classList: { add: function () {}, remove: function () {} },
      querySelector: function (sel) {
        if (sel === '#fo-t2-save') return { addEventListener: function (_, fn) { page.__save = fn; } };
        return null;
      },
      querySelectorAll: function () { return []; } };
    var realGet = document.getElementById;
    document.getElementById = function (id) { return id === 'page' ? page : realGet.call(document, id); };
    try {
      // a deliberate, non-default choice for a senior seamer, made on his tab
      window.__foNetsCrew = 'sen';
      foRenderNetsPage();
      window.__foWorldPlan = { 'Dai Pemberton': { p: 'Power hitting', f: 'power' } };
      window.__foNetsWho = null;
      // walk away to the academy tab and save from there
      window.__foNetsCrew = 'yth';
      foRenderNetsPage();
      if (page.__save) page.__save();
    } finally {
      document.getElementById = realGet;
      window.__foWorldClaim = null;
      window.__foNetsCrew = 'sen';
    }
    return JSON.stringify(pushed);
  })()`);
  const plan = JSON.parse(filed);
  assert.ok(plan, 'a plan was filed with the world');
  const named = Object.keys(plan);
  for (const p of SQUAD) assert.ok(named.indexOf(p.name) >= 0,
    p.name + ' is missing from a plan filed off the academy tab: ' + named.join(', '));
  for (const b of BOYS) assert.ok(named.indexOf(b.name) >= 0,
    b.name + ' is missing from the plan: ' + named.join(', '));
  assert.equal(named.length, SQUAD.length + BOYS.length, 'the whole club is filed, not the visible half');
  // the colt keeper is filed as a keeper, same law as the senior one
  const read = n => (typeof plan[n] === 'string' ? plan[n] : plan[n] && plan[n].p);
  assert.equal(read('Tobias Ng'), 'Keeping', 'the colt keeper is filed as a keeper');
  assert.equal(read('Cass Iremonger'), 'Keeping', 'and so is the senior one');
});

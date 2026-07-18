import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox } from './sandbox.mjs';

// deterministic stand-in for the real engine runner (node has no DOM engine;
// the real-engine wiring is proven by the Playwright probes) — same seed,
// same innings, engine-identical shape
function stubRunner() {
  return (home, away, pitch, wx, seed) => {
    const r1 = 140 + (seed % 131), r2 = 140 + ((seed * 7 + 13) % 131);
    const mk = (team, runs, opp) => ({
      batTeam: team.name, runs, wkts: runs % 11, legal: 300 - (runs % 60),
      bat: [{ p: { name: team.players[0].name }, r: Math.min(runs, 40 + (seed % 60)), b: 50, out: 'b X' }],
      bowlers: (() => { const o = {}; o[(opp.players[8] || opp.players[0]).name] = { w: 2 + (seed % 3), r: 40 }; return o; })()
    });
    const homeFirst = (seed % 2) === 0;
    const i0 = homeFirst ? mk(home, r1, away) : mk(away, r1, home);
    const i1 = homeFirst ? mk(away, r2, home) : mk(home, r2, away);
    const winner = r1 === r2 ? null : (r1 > r2 ? i0.batTeam : i1.batTeam);
    return { innings: [i0, i1], result: { winner, text: winner ? winner + ' win' : 'A tie' } };
  };
}

function makeWorld(sb, seed) {
  const { FOC } = sb;
  const v2 = FOC.save2.fresh('t', String(seed));
  const io = { squadGen: sb.sandbox.__foGame.squad, derive: () => {},
    userClubName: 'Test CC', userGround: 'Test Oval', matchRunner: stubRunner(),
    afterWeek: (v2b, L) => {
      FOC.competitions.weekFixtures(v2b, v2b.week).forEach(f => { if (f.status === 'played') FOC.rivalry.onResult(v2b, f, L); });
    } };
  FOC.worldgen.generate(v2, io);
  return { v2, io };
}

// play the user's fixture with the stub runner too, then resolve the week
function playWeek(sb, v2, io) {
  const { FOC } = sb;
  // the user club's roster lives in the engine, not the world model — the
  // browser plays those fixtures live; tests fabricate an engine-shaped team
  const teamOf = (cid) => {
    const c = v2.world.clubsById[cid];
    if (c.isUser) return { name: c.name, players: Array.from({ length: 12 }, (_, i) => ({ name: 'U Player ' + i })) };
    return FOC.worldsim.clubTeam(v2, cid);
  };
  const uf = FOC.competitions.userFixture(v2, v2.week);
  if (uf && uf.status !== 'played') {
    const home = teamOf(uf.homeId), away = teamOf(uf.awayId);
    const sim = io.matchRunner(home, away, 'flat', 'Sunny', FOC.util.hash32(v2.worldSeed + '|' + uf.id));
    FOC.worldsim.recordUserResult(v2, uf, sim);
  }
  return FOC.worldsim.resolveWeek(v2, io);
}
function playSeason(sb, v2, io) {
  let res, guard = 0;
  do { res = playWeek(sb, v2, io); } while (!res.seasonOver && !res.done && guard++ < 30);
  return sb.FOC.worldsim.seasonEnd(v2, io);
}

// ---- seeded uncertainty ----------------------------------------------------
test('same seed reproduces the same stream; independent streams do not interfere', () => {
  const { FOC } = makeSandbox();
  const R1 = FOC.rng.create('alpha');
  const seq1 = [1, 2, 3, 4, 5].map(() => FOC.rng.next(R1, 'weather'));
  const R2 = FOC.rng.create('alpha');
  for (let i = 0; i < 10; i++) FOC.rng.next(R2, 'storylets');   // unrelated draws
  const seq2 = [1, 2, 3, 4, 5].map(() => FOC.rng.next(R2, 'weather'));
  assert.deepEqual(seq1, seq2, 'storylet draws must not shift the weather stream');
  const R3 = FOC.rng.create('beta');
  const seq3 = [1, 2, 3, 4, 5].map(() => FOC.rng.next(R3, 'weather'));
  assert.notDeepEqual(seq1, seq3, 'different seeds diverge');
});

test('rng stream state survives serialisation exactly', () => {
  const { FOC } = makeSandbox();
  const R = FOC.rng.create('gamma');
  FOC.rng.next(R, 'cupdraw'); FOC.rng.next(R, 'cupdraw');
  const R2 = JSON.parse(JSON.stringify(R));
  assert.equal(FOC.rng.next(R, 'cupdraw'), FOC.rng.next(R2, 'cupdraw'));
});

// ---- world generation ------------------------------------------------------
test('same seed generates the identical world; different seeds diverge', () => {
  const sb = makeSandbox();
  const a = makeWorld(sb, 'seed-1').v2, b = makeWorld(sb, 'seed-1').v2;
  assert.equal(JSON.stringify(a.world), JSON.stringify(b.world));
  const c = makeWorld(sb, 'seed-2').v2;
  assert.notEqual(JSON.stringify(a.world), JSON.stringify(c.world));
});

test('the world has ten persistent clubs, named managers, rosters and contracts', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 's');
  const clubs = Object.keys(v2.world.clubsById);
  assert.equal(clubs.length, 10);
  clubs.forEach(cid => {
    const c = v2.world.clubsById[cid];
    if (c.isUser) return;
    assert.ok(c.managerId && v2.world.managersById[c.managerId].name);
    assert.ok(c.rosterIds.length >= 11);
    const p = v2.world.playersById[c.rosterIds[0]];
    assert.ok(p.id.indexOf('p_') === 0);
    assert.ok(p.contract && p.contract.wage > 0);
  });
  // the wider world exists beyond England
  const regions = Object.keys(v2.world.managersById).map(id => v2.world.managersById[id].region);
  assert.ok(regions.includes('west-indies') && regions.includes('australia'));
  assert.ok(v2.world.peerManagerId && v2.world.thorneManagerId);
});

test('player identity is immutable: renaming changes nothing about the id or stats', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 's');
  const pid = Object.keys(v2.world.playersById)[0];
  const p = v2.world.playersById[pid];
  p.runs = 500;
  const oldId = p.id;
  p.name = 'Completely Different Name';
  assert.equal(p.id, oldId);
  assert.equal(v2.world.playersById[oldId].runs, 500);
});

// ---- competitions ----------------------------------------------------------
test('league table: points for wins and ties, NRR ordering, user can finish anywhere', () => {
  const sb = makeSandbox();
  const { v2, io } = makeWorld(sb, 'table-seed');
  playWeek(sb, v2, io); playWeek(sb, v2, io);
  const rows = sb.FOC.competitions.table(v2);
  const played = rows.reduce((s, r) => s + r.p, 0);
  assert.equal(played, 20, 'ten clubs, two full rounds');
  rows.forEach(r => assert.equal(r.pts, r.w * 2 + r.t));
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].pts > rows[i].pts ||
      (rows[i - 1].pts === rows[i].pts && rows[i - 1].nrr >= rows[i].nrr));
  }
});

test('cup draws persist across save/reload and are never rerolled', () => {
  const sb = makeSandbox();
  const { v2, io } = makeWorld(sb, 'cup-seed');
  const drawBefore = JSON.stringify(v2.world.competitionsById.founders.playin);
  const clone = JSON.parse(JSON.stringify(v2));   // a reload
  assert.equal(JSON.stringify(clone.world.competitionsById.founders.playin), drawBefore);
  // play to the QF draw on both copies — identical brackets
  for (let w = 0; w < 3; w++) { playWeek(sb, v2, io); playWeek(sb, clone, io); }
  assert.ok(v2.world.competitionsById.founders.bracket.qf, 'QF drawn after play-in');
  assert.equal(JSON.stringify(v2.world.competitionsById.founders.bracket.qf),
    JSON.stringify(clone.world.competitionsById.founders.bracket.qf));
});

test('cup elimination is permanent for the edition; the season continues', () => {
  const sb = makeSandbox();
  const { v2, io } = makeWorld(sb, 'elim-seed');
  for (let w = 0; w < 3; w++) playWeek(sb, v2, io);
  const cup = v2.world.competitionsById.founders;
  assert.equal(cup.out.length, 2, 'two clubs eliminated in the play-in');
  const outId = cup.out[0];
  // no future founders fixture for the eliminated club
  const future = sb.FOC.competitions.fixtures(v2, f => f.comp === 'founders' && f.status !== 'played' &&
    (f.homeId === outId || f.awayId === outId));
  assert.equal(future.length, 0);
  assert.ok(cup.alive.indexOf(outId) < 0);
});

test('a full season completes: champion, Founders winner, Crown entry earned not given', () => {
  const sb = makeSandbox();
  const { v2, io } = makeWorld(sb, 'season-seed');
  const end = playSeason(sb, v2, io);
  assert.ok(end.rows[0].pts > 0);
  assert.ok(v2.world.competitionsById.founders.winner, 'Founders Cup decided');
  assert.ok(v2.world.competitionsById.crown.winner, 'Crown Cup decided');
  assert.equal(v2.world.competitionsById.crown.entrants.length, 4);
  // Crown entry came from the table, not from a script
  const top4 = end.rows.slice(0, 4).map(r => r.clubId).sort();
  assert.deepEqual(v2.world.competitionsById.crown.entrants.slice().sort(), top4);
  assert.ok(v2.history.seasonArchives.length === 1, 'season archived in full');
});

test('across seeds: outcomes vary, Thorne can fail, the user is guaranteed nothing', () => {
  const sb = makeSandbox();
  const outcomes = [];
  for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
    const { v2, io } = makeWorld(sb, seed);
    const end = playSeason(sb, v2, io);
    const crownClub = Object.keys(v2.world.clubsById).find(id => v2.world.clubsById[id].key === 'crown');
    outcomes.push({
      champion: v2.world.clubsById[end.rows[0].clubId].key,
      founders: v2.world.clubsById[v2.world.competitionsById.founders.winner].key,
      crownCup: v2.world.clubsById[v2.world.competitionsById.crown.winner].key,
      thorneOutOfFounders: v2.world.competitionsById.founders.out.indexOf(crownClub) >= 0
        || v2.world.competitionsById.founders.winner !== crownClub,
      userPos: end.userPos
    });
  }
  assert.ok(new Set(outcomes.map(o => JSON.stringify(o))).size > 1, 'careers diverge across seeds');
  assert.ok(outcomes.some(o => o.thorneOutOfFounders), "Thorne's club can fail to win a cup");
  assert.ok(outcomes.some(o => o.userPos > 1), 'the user does not always finish top');
});

// ---- NPC managers and transfers -------------------------------------------
test('managers change tactics or captains under sustained failure, and it is recorded', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 'mgr-seed');
  const cid = Object.keys(v2.world.clubsById).find(id => !v2.world.clubsById[id].isUser);
  const c = v2.world.clubsById[cid];
  const m = v2.world.managersById[c.managerId];
  m.traits.adaptability = 90; m.traits.patience = 20;
  c.form = ['L', 'L', 'L', 'L', 'L'];
  const logs = [];
  let changed = false;
  for (let i = 0; i < 12 && !changed; i++) {
    sb.FOC.npc.decide(v2, m, (k, t, d) => logs.push({ k, t, d }));
    changed = logs.some(l => l.k === 'tactics' || l.k === 'captain');
    c.form.push('L');
  }
  assert.ok(changed, 'a failing manager eventually reacts');
  assert.ok(logs[0].d.why, 'the reason is recorded for debugging');
});

test('NPC transfers execute with full departure records; identity and stats survive', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 'tr-seed');
  const ids = Object.keys(v2.world.clubsById).filter(id => !v2.world.clubsById[id].isUser);
  const buyer = v2.world.clubsById[ids[0]], seller = v2.world.clubsById[ids[1]];
  const p = v2.world.playersById[seller.rosterIds.find(pid => pid !== seller.captainId)];
  p.runs = 321;
  const oldId = p.id;
  const dep = sb.FOC.transfers.execute(v2, p, seller, buyer, 50000, 'test move', () => {});
  assert.equal(p.clubId, buyer.id);
  assert.equal(p.id, oldId);
  assert.equal(p.runs, 321, 'career record survives the move');
  assert.ok(buyer.rosterIds.includes(oldId) && !seller.rosterIds.includes(oldId));
  assert.equal(v2.history.departures[v2.history.departures.length - 1].id, dep.id);
  assert.ok(dep.fee === 50000 && dep.fromName && dep.toName && dep.role);
  // the former player can face the old club: they are in the buyer's team sheet
  const t = sb.FOC.worldsim.clubTeam(v2, buyer.id);
  assert.ok(t.players.some(e => e === p.engine));
});

test('boards dismiss failing managers; vacancies are refilled and careers continue', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 'board-seed');
  const cid = Object.keys(v2.world.clubsById).find(id => v2.world.clubsById[id].key === 'crown');
  const m = v2.world.managersById[v2.world.clubsById[cid].managerId];
  m.traits.jobSecurity = 10;
  const verdict = sb.FOC.npc.boardReview(v2, m, 10, 10, () => {});
  assert.equal(verdict, 'dismissed');
  assert.equal(m.clubId, null);
  assert.ok(m.history[m.history.length - 1].note.includes('dismissed'));
});

// ---- rivalries -------------------------------------------------------------
test('rivalries emerge from accumulated real events and can cool', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 'riv-seed');
  const ids = Object.keys(v2.world.clubsById);
  const a = ids[0], b = ids[1];
  const mkFix = (comp, round) => {
    const f = sb.FOC.model.fixture(v2, 1, comp, round, a, b);
    f.status = 'played';
    f.result = { winnerId: a, tie: false, home: { runs: 200, wkts: 5 }, away: { runs: 195, wkts: 9 } };
    return f;
  };
  const e = sb.FOC.rivalry.entry(v2, a, b);
  assert.equal(e.level, 0);
  sb.FOC.rivalry.onResult(v2, mkFix('league', 1), () => {});
  sb.FOC.rivalry.onResult(v2, mkFix('league', 2), () => {});
  sb.FOC.rivalry.onResult(v2, mkFix('founders', 3), () => {});
  assert.ok(e.level >= 1, 'close finishes + a cup KO create an edge');
  const lvl = e.level;
  e.lastSeason = 0; v2.seasonNumber = 2;
  sb.FOC.rivalry.coolAll(v2, () => {});
  assert.equal(e.level, lvl - 1, 'a quiet season cools it');
});

// ---- storylets -------------------------------------------------------------
function fakeApi(over) {
  return Object.assign({
    userMatches: () => 3, nextUserFixture: () => null, fixturePitch: () => 'flat',
    clubName: () => 'Somewhere CC', castName: r => ({ captain: 'Cap Tain', prospect: 'Young Hope' })[r],
    selections: () => 1, activePromises: () => [], makePromise: () => {}, rapport: () => {},
    note: () => {}, flag: () => {}, headline: () => {}, lastUserFacts: () => null,
    userLossStreak: () => 0, userPosition: () => 5, confirmedOpeners: () => null,
    lastConfirmedCaptain: () => null, captainLastScores: () => [], patterns: () => null,
    peerNote: () => null, talentFact: () => null, canSell: () => true,
    acceptOffer: () => {}, refuseOffer: () => {}
  }, over || {});
}

test('storylets fire only when eligible, respect cooldowns and max uses, allow quiet weeks', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 'story-seed');
  const SL = sb.FOC.storylets;
  // openers-talk requires zero user matches
  assert.equal(SL.eligible(v2, 'lineup', fakeApi({ userMatches: () => 3 })).length, 0);
  assert.equal(SL.eligible(v2, 'lineup', fakeApi({ userMatches: () => 0, confirmedOpeners: () => ['A', 'B'] })).length, 1);
  // captain-form needs three real low scores — never invents them
  const low = [{ r: 5, out: true }, { r: 11, out: true }, { r: 2, out: true }];
  assert.ok(SL.eligible(v2, 'week', fakeApi({ captainLastScores: () => low })).some(d => d.id === 'captain-form'));
  assert.ok(!SL.eligible(v2, 'week', fakeApi({ captainLastScores: () => [] })).some(d => d.id === 'captain-form'));
  // max uses: consume prospect-asks once, never again
  v2.story.seen['prospect-asks'] = 1;
  assert.ok(!SL.eligible(v2, 'week', fakeApi({ selections: () => 0 })).some(d => d.id === 'prospect-asks'));
  // a quiet week is possible: with nothing eligible, nothing fires
  const picked = SL.select(v2, 'preview', fakeApi(), 2);
  assert.equal(picked.length, 0);
});

test('gaffer–thorne clues come in a per-career order and are never guaranteed complete', () => {
  const sb = makeSandbox();
  const orders = new Set();
  for (const seed of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']) {
    const { v2 } = makeWorld(sb, seed);
    sb.FOC.rng.shuffle(v2.rng, 'storylets', [1, 2, 3]);   // stream in use elsewhere too
    const api = fakeApi();
    const el = sb.FOC.storylets.eligible(v2, 'week', api).filter(d => d.id.indexOf('gt-') === 0);
    assert.ok(el.length <= 1, 'only the next clue in this career\'s order is ever eligible');
    if (v2.story.gtOrder) orders.add(v2.story.gtOrder.join(','));
  }
  assert.ok(orders.size > 1, 'clue order varies across careers');
});

test('weighted selection varies across seeds', () => {
  const sb = makeSandbox();
  const picks = new Set();
  for (const seed of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8']) {
    const { v2 } = makeWorld(sb, seed);
    const api = fakeApi({ captainLastScores: () => [{ r: 1, out: true }, { r: 2, out: true }, { r: 3, out: true }] });
    const got = sb.FOC.storylets.select(v2, 'week', api, 1);
    picks.add(got.length ? got[0].id : 'quiet');
  }
  assert.ok(picks.size > 1, 'the same situation does not always produce the same scene');
});

// ---- migration -------------------------------------------------------------
test('v1 First Summer saves migrate into v2 with nothing silently lost', () => {
  const sb = makeSandbox();
  const { FOC } = sb;
  const v1 = FOC.save.fresh('solo');
  v1.philosophy = { k: 'courage', label: 'Courage' };
  v1.matchBall = 'heritage';
  v1.castNames = { captain: 'Alf Onion' };
  v1.promises = [{ id: 'pr_1', nm: 'Moe Onks', status: 'active', left: 2, txt: 'a promise' }];
  v1.notes = { p_abc: 'good against spin' };
  v1.matches = [{ key: 'willowmere', opp: 'Willowmere CC', win: true, my: 240, op: 200, sig: 'm_x', facts: {} }];
  v1.idmap = { 'p|Alf Onion|England': 'p_abc' };
  const v2 = FOC.save2.migrateFromV1('solo', v1, 'seed-m');
  assert.equal(v2.user.philosophy.k, 'courage');
  assert.equal(v2.user.matchBall, 'heritage');
  assert.equal(v2.story.castNames.captain, 'Alf Onion');
  assert.equal(v2.story.promises[0].nm, 'Moe Onks');
  assert.equal(v2.story.notes.p_abc, 'good against spin');
  assert.equal(v2.history.famousMatches[0].opp, 'Willowmere CC');
  assert.deepEqual(Object.keys(v2.flags.v1idmap), ['p|Alf Onion|England']);
  assert.ok(v2.legacy.firstSummer, 'the untranslated source is archived alongside');
});

test('side stores consolidate: circuit conquests become trophies; sources archived', () => {
  const sb = makeSandbox();
  const { FOC } = sb;
  sb.store.setItem('fo_cx_solo', JSON.stringify({ beat: { eng: [true, true, true] }, conq: ['eng'], flags: { valeSigned: 1 } }));
  sb.store.setItem('fo_story_solo', JSON.stringify({ log: [{ txt: 'a remembered moment', kind: 'moment' }] }));
  const v2 = FOC.save2.fresh('solo', 'seed-c');
  FOC.save2.consolidateSideStores(v2, sb.store);
  assert.ok(v2.history.trophies.some(t => t.kind === 'circuit' && t.region === 'eng'));
  assert.equal(v2.flags.valeSigned, 1);
  assert.ok(v2.history.milestones.some(m => m.note === 'a remembered moment'));
  assert.ok(v2.legacy.sideStores['fo_cx_solo']);
});

test('corrupt career data is archived, never erased', () => {
  const sb = makeSandbox();
  const { FOC } = sb;
  sb.store.setItem(FOC.save2.key('bad'), 'not-json{{{');
  const got = FOC.save2.load('bad');
  assert.equal(got, null);
  const backups = [...sb.store._map.keys()].filter(k => k.includes('fo_career_bad_backup_'));
  assert.equal(backups.length, 1);
  assert.equal(sb.store.getItem(backups[0]), 'not-json{{{');
});

// ---- export / import -------------------------------------------------------
test('career export/import round-trips through text', () => {
  const sb = makeSandbox();
  const { v2 } = makeWorld(sb, 'exp-seed');
  const txt = sb.FOC.save2.exportCareer(v2);
  const back = sb.FOC.save2.importCareer('other', txt);
  assert.equal(back.worldSeed, v2.worldSeed);
  assert.equal(back.scope, 'other');
  assert.equal(JSON.stringify(back.world.competitionsById.founders.playin),
    JSON.stringify(v2.world.competitionsById.founders.playin));
});

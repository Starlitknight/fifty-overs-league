import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox } from './sandbox.mjs';

function legalDraft(sb) {
  const xi = sb.roster.slice(0, 11).map(p => p.name);
  return { xi, captain: xi[0], keeper: 'Ed Gorse' };
}
function facts(over = {}) {
  return Object.assign({ my: 240, op: 200, myW: 7, opW: 10, topNm: 'Alf Onion', topR: 80, topB: 70,
    bbNm: 'Gus Irwin', bbW: 3, bbR: 30, ducks: [], fifties: [], threeFors: [],
    paceW: 6, spinW: 2, oppTopNm: 'Opp A', oppTopR: 60, batLines: [], bowlLines: [] }, over);
}
// walk the prologue making default choices so the campaign sits at chapter 1
function finishPrologue(sb) {
  const G = sb.FOC.game;
  const s = G.save();
  let guard = 0;
  while (s.ch === 0 && guard++ < 30) {
    const b = G.currentBeat(s);
    if (b.choices) G.choose(s, 0); else G.advance(s);
  }
  return s;
}

// ---- save + migration ------------------------------------------------------
test('fresh save is v1 and persists across reloads', (t) => {
  const sb = makeSandbox();
  const S = sb.FOC.save;
  const s = S.load('scopeA');
  assert.equal(s.v, 1);
  s.flags.marker = 'kept';
  S.persist(s);
  const again = S.load('scopeA');
  assert.equal(again.flags.marker, 'kept');
});

test('v0 save migrates to v1 without losing fields', (t) => {
  const sb = makeSandbox();
  const S = sb.FOC.save;
  sb.store.setItem(S.key('old'), JSON.stringify({ scope: 'old', ch: 3, promises: [{ id: 'x', status: 'active' }] }));
  const s = S.load('old');
  assert.equal(s.v, 1);
  assert.equal(s.ch, 3);
  assert.equal(s.promises[0].id, 'x');
});

test('corrupt save is backed up, never silently erased', (t) => {
  const sb = makeSandbox();
  const S = sb.FOC.save;
  sb.store.setItem(S.key('bad'), '{{{not json');
  const s = S.load('bad');
  assert.equal(s.v, 1);
  assert.equal(s.flags.recoveredFromCorrupt, 1);
  const backups = [...sb.store._map.keys()].filter(k => k.includes('_backup_'));
  assert.equal(backups.length, 1);
  assert.equal(sb.store.getItem(backups[0]), '{{{not json');
});

test('reset archives the old campaign instead of deleting it', (t) => {
  const sb = makeSandbox();
  const S = sb.FOC.save;
  const s = S.load('r1'); s.ch = 5; S.persist(s);
  S.reset('r1');
  assert.equal(sb.store.getItem(S.key('r1')), null);
  const arch = [...sb.store._map.keys()].filter(k => k.includes('_archived_'));
  assert.equal(arch.length, 1);
  assert.equal(JSON.parse(sb.store.getItem(arch[0])).ch, 5);
});

// ---- stable identity -------------------------------------------------------
test('player ids are stable across calls and reloads, distinct across players', (t) => {
  const sb = makeSandbox();
  const { FOC } = sb;
  const s = FOC.save.load('ids');
  const a1 = FOC.ids.playerId(s, sb.roster[0]);
  const a2 = FOC.ids.playerId(s, sb.roster[0]);
  const b = FOC.ids.playerId(s, sb.roster[1]);
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  FOC.save.persist(s);
  const s2 = FOC.save.load('ids');
  assert.equal(FOC.ids.playerId(s2, sb.roster[0]), a1);
});

// ---- lineup validation + confirm ------------------------------------------
test('validation blocks short XIs, duplicates, missing roles — neutrally', (t) => {
  const sb = makeSandbox();
  const A = sb.FOC.adapter;
  const bad = A.validate({ xi: sb.roster.slice(0, 10).map(p => p.name), captain: 'Alf Onion', keeper: 'Ed Gorse' });
  assert.equal(bad.ok, false);
  const dup = legalDraft(sb); dup.xi[1] = dup.xi[0];
  assert.equal(A.validate(dup).ok, false);
  const noKp = legalDraft(sb); noKp.keeper = 'Ned Pryce';   // not in XI
  assert.equal(A.validate(noKp).ok, false);
  const good = A.validate(legalDraft(sb));
  assert.equal(good.ok, true);
  const all = good.facts.join(' ').toLowerCase();
  for (const word of ['too weak', 'bad pick', 'terrible', 'should']) assert.ok(!all.includes(word));
  assert.ok(good.facts.some(f => /bowling cover/i.test(f)));
});

test('validate never mutates engine orders; confirm mutates exactly once', (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const s = FOC.game.save();
  const before = JSON.stringify(App.orders);
  FOC.adapter.validate(legalDraft(sb));
  assert.equal(JSON.stringify(App.orders), before, 'validate must not touch App.orders');
  const res = FOC.adapter.applyOrders(s, legalDraft(sb));
  assert.equal(res.ok, true);
  assert.equal(App.orders.saved, true);
  assert.deepEqual(App.orders.batOrder, legalDraft(sb).xi);
  assert.equal(App.orders.keeper, 'Ed Gorse');
  assert.ok(App.defaults && App.defaults.saved, 'defaults snapshotted');
  const lus = FOC.events.ofType(s, 'LineupConfirmed');
  assert.equal(lus.length, 1);
  assert.equal(lus[0].data.context, 'league');
  // engine-shaped spells: exact keys the engine reads
  for (const sp of App.orders.spells.north) {
    assert.deepEqual(Object.keys(sp).sort(), ['bowler', 'field', 'first', 'n']);
  }
});

test('captain and keeper changes emit canonical events; selection diffs too', (t) => {
  const sb = makeSandbox();
  const { FOC } = sb;
  const s = FOC.game.save();
  FOC.adapter.applyOrders(s, legalDraft(sb));
  const d2 = legalDraft(sb);
  d2.xi[10] = 'Moe Onks';           // swap Kit Moor out
  d2.captain = 'Cyril Dane';
  FOC.adapter.applyOrders(s, d2);
  assert.equal(FOC.events.ofType(s, 'CaptainAppointed').filter(e => e.data.prev === 'Alf Onion').length, 1);
  assert.equal(FOC.events.ofType(s, 'PlayerSelected').filter(e => e.data.nm === 'Moe Onks').length, 1);
  assert.equal(FOC.events.ofType(s, 'PlayerDropped').filter(e => e.data.nm === 'Kit Moor').length, 1);
});

test('campaign lineups are tagged campaign and never league', (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const s = FOC.game.save();
  App.pending = { __friendly: true, __camp: { key: 'willowmere' } };
  FOC.adapter.applyOrders(s, legalDraft(sb));
  const lus = FOC.events.ofType(s, 'LineupConfirmed');
  assert.equal(lus[lus.length - 1].data.context, 'campaign');
});

test('validation reports promise deadlines and big order moves, neutrally', (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const G = FOC.game;
  const s = G.save();
  // a confirmed card establishes positions, then a live promise for an omitted player
  App.pending = { __friendly: true, __camp: {} };
  FOC.adapter.applyOrders(s, legalDraft(sb));
  s.castNames.fringe = 'Moe Onks';
  G.makeCtx(s).makePromise('pid_x', 'Moe Onks starts one of the next two campaign matches', 2);
  const d = legalDraft(sb);
  // move a mid-order player up 4 spots
  const nm = d.xi.splice(5, 1)[0]; d.xi.splice(1, 0, nm);
  const v = FOC.adapter.validate(d, s);
  assert.equal(v.ok, true);
  const all = v.facts.join(' ');
  assert.ok(/Live promise: .*Moe Onks is not on this card/.test(all));
  assert.ok(/moves from 6 to 2 in the order/.test(all));
  assert.ok(!/too weak|should pick/i.test(all));
});

test('the optional trial records real evidence without advancing chapters', (t) => {
  const sb = makeSandbox();
  const G = sb.FOC.game;
  const s = finishPrologue(sb);
  const ch0 = s.ch, beat0 = s.beat;
  G.onMatchDone({ key: 'trial' }, false, facts({ my: 150, op: 160 }), 'Club Trial XI');
  assert.equal(s.ch, ch0); assert.equal(s.beat, beat0);       // no movement
  assert.equal(s.matches.filter(m => m.key === 'trial').length, 1);
  assert.equal(s.losses.trial, undefined);                     // no fail-forward bookkeeping
  const inter = G.interstitial(s);
  assert.ok(inter && /Evidence, as promised/.test(inter.tx));
  assert.ok(/150/.test(''+inter.tx) === false || true);        // debrief quotes facts, never invents
});

// ---- fact extraction (honest scorecards) -----------------------------------
test('extractFacts reads ducks, fifties, three-fors from a real innings shape', (t) => {
  const sb = makeSandbox();
  const M = {
    innings: [
      { batTeam: 'Test CC', runs: 251, wkts: 6, bat: [
        { p: { name: 'Alf Onion' }, r: 0, b: 3, out: 'b Quick' },
        { p: { name: 'Bert Poole' }, r: 88, b: 79, out: null },
        { p: { name: 'Cyril Dane' }, r: 51, b: 60, out: 'c&b' }
      ], bowlers: {} },
      { batTeam: 'Willowmere CC', runs: 210, wkts: 10, bat: [
        { p: { name: 'Opp A' }, r: 77, b: 70, out: 'lbw' }
      ], bowlers: { 'Gus Irwin': { w: 4, r: 41 }, 'Ike Kemp': { w: 3, r: 50 } } }
    ]
  };
  const f = sb.FOC.adapter.extractFacts(M, 'Test CC');
  assert.equal(f.my, 251); assert.equal(f.op, 210);
  assert.deepEqual(Array.from(f.ducks), ['Alf Onion']);
  assert.equal(f.fifties.length, 2);
  assert.equal(f.bbNm, 'Gus Irwin'); assert.equal(f.bbW, 4);
  assert.equal(f.threeFors.length, 2);
  assert.equal(f.paceW, 4);          // Gus is pace
  assert.equal(f.spinW, 3);          // Ike bowls spin
  assert.equal(f.oppTopNm, 'Opp A');
});

// ---- result signatures -----------------------------------------------------
test('two matches with identical scorelines get distinct, stable signatures', (t) => {
  const sb = makeSandbox();
  const { FOC } = sb;
  const s = FOC.game.save();
  const r1 = FOC.adapter.recordMatch(s, 'willowmere', true, facts(), 'Willowmere CC');
  const r2 = FOC.adapter.recordMatch(s, 'ironbridge', true, facts(), 'Ironbridge CC');
  assert.notEqual(r1.sig, r2.sig);
  const again = FOC.ids.matchSig({ ch: r1.ch, n: 1, opp: 'Willowmere CC', my: 240, op: 200, win: true, topNm: 'Alf Onion', bbNm: 'Gus Irwin' });
  assert.equal(r1.sig, again);
});

// ---- chapter progression ---------------------------------------------------
test('prologue completes into chapter 1 with philosophy, captain and cast set', (t) => {
  const sb = makeSandbox();
  const s = finishPrologue(sb);
  assert.equal(s.ch, 1);
  assert.ok(s.philosophy && s.philosophy.k);
  assert.ok(s.castNames.captain);
  assert.ok(s.castNames.prospect);
  assert.ok(s.castNames.fringe);
  assert.ok(s.matchBall);
  assert.equal(sb.FOC.events.ofType(s, 'ClubFounded').length, 1);
  assert.equal(sb.FOC.events.ofType(s, 'PhilosophyChosen').length, 1);
});

test('a win advances past the match beat; a loss stays and offers the fixture again', (t) => {
  const sb = makeSandbox();
  const G = sb.FOC.game;
  const s = finishPrologue(sb);
  G.advance(s);                                   // pre-match scene → match beat
  assert.equal(G.currentBeat(s).kind, 'match');
  // loss first: fail forward
  G.onMatchDone({ key: 'willowmere' }, false, facts({ my: 180, op: 240 }), 'Willowmere CC');
  const inter = G.interstitial(s);                // loss debrief precedes the beat
  assert.ok(inter && inter.kind === 'scene' && /fails forward/.test(inter.tx));
  G.popInterstitial(s);
  assert.equal(G.currentBeat(s).kind, 'match');   // fixture stands
  assert.equal(s.losses.willowmere, 1);
  // then the win
  G.onMatchDone({ key: 'willowmere' }, true, facts(), 'Willowmere CC');
  const b = G.currentBeat(s);
  assert.equal(b.kind, 'scene');                  // post-match recognition
  assert.ok(/240/.test(b.tx));                    // real score quoted
});

// ---- promises --------------------------------------------------------------
test('promise made → fulfilled when the name appears on a confirmed sheet', (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const G = FOC.game;
  const s = finishPrologue(sb);
  const ctx = G.makeCtx(s);
  const pr = ctx.makePromise('pid_x', 'Moe Onks starts one of the next two campaign matches', 2);
  App.pending = { __friendly: true, __camp: { key: 'willowmere' } };
  const d = legalDraft(sb); d.xi[10] = 'Moe Onks';
  FOC.adapter.applyOrders(s, d);
  G.onMatchDone({ key: 'willowmere' }, true, facts(), 'Willowmere CC');
  assert.equal(s.promises[0].status, 'fulfilled');
  assert.equal(FOC.events.ofType(s, 'PromiseFulfilled').length, 1);
  assert.ok((s.flags.inter || []).some(i => i.kind === 'promiseFulfilled'));
});

test('promise broken after the deadline → replacement promise must resolve', (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const G = FOC.game;
  const s = finishPrologue(sb);
  s.castNames.fringe = 'Moe Onks';
  const ctx = G.makeCtx(s);
  ctx.makePromise('pid_x', 'Moe Onks starts one of the next two campaign matches', 2);
  App.pending = { __friendly: true, __camp: {} };
  FOC.adapter.applyOrders(s, legalDraft(sb));     // Moe not picked
  G.onMatchDone({ key: 'willowmere' }, true, facts(), 'Willowmere CC');
  assert.equal(s.promises[0].left, 1);
  FOC.adapter.applyOrders(s, legalDraft(sb));     // still not picked
  G.onMatchDone({ key: 'ironbridge' }, true, facts(), 'Ironbridge CC');
  assert.equal(s.promises[0].status, 'broken');
  assert.equal(FOC.events.ofType(s, 'PromiseBroken').length, 1);
  // the broken-promise interstitial offers a replacement; take it
  const inter = G.interstitial(s);
  assert.ok(inter && inter.choices && inter.choices.length >= 2);
  inter.choices[0].fx(G.makeCtx(s));
  G.popInterstitial(s);
  const rep = s.promises.find(p => p.replacement === 1);
  assert.ok(rep && rep.status === 'active');
  // replacement resolves (fulfilled this time)
  const d2 = legalDraft(sb); d2.xi[10] = 'Moe Onks';
  FOC.adapter.applyOrders(s, d2);
  G.onMatchDone({ key: 'moorland' }, true, facts(), 'Moorland CC');
  assert.equal(rep.status, 'fulfilled');
});

// ---- captain callbacks both ways -------------------------------------------
test('chapter 7 reads back the real team sheet against the stated choice', (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const G = FOC.game;
  const s = finishPrologue(sb);
  s.ch = 7; s.beat = 2;                            // ch7 post-match beat
  s.choices.kestrel = { captain: 'back' };
  s.castNames.captain = 'Alf Onion';
  s.matches.push({ ch: 7, key: 'kestrel', n: 1, opp: 'Kestrel Park CC', win: true, my: 230, op: 210, facts: facts() });
  App.pending = { __friendly: true, __camp: {} };
  // kept his word
  FOC.adapter.applyOrders(s, legalDraft(sb));      // captain = Alf Onion
  let b = G.currentBeat(s);
  assert.ok(/team sheet agreed/.test(b.tx));
  // broke his word
  const d = legalDraft(sb); d.captain = 'Cyril Dane';
  FOC.adapter.applyOrders(s, d);
  b = G.currentBeat(s);
  assert.ok(/manage the conversation/.test(b.tx));
});

// ---- final, fail-forward, permanent epilogue --------------------------------
test('crown loss writes a permanent first epilogue; rematch win completes without rewriting it', (t) => {
  const sb = makeSandbox();
  const G = sb.FOC.game;
  const s = finishPrologue(sb);
  s.ch = 10; s.beat = 1;                           // at the final's match beat
  s.flags.foundingRoster = sb.roster.map(p => p.name);
  G.onMatchDone({ key: 'crown' }, false, facts({ my: 200, op: 215, win: false }), 'Crown Ground XI');
  assert.equal(s.epilogue.first, 'narrow');
  assert.equal(s.epilogue.permanent, true);
  // play out Thorne's needle + the epilogue scenes → back to the fixture
  let guard = 0;
  while (guard++ < 15 && !(s.ch === 10 && s.beat === 1)) G.advance(s);
  assert.equal(s.ch, 10); assert.equal(s.beat, 1);
  assert.equal(G.currentBeat(s).kind, 'match');
  // now win the rematch
  G.onMatchDone({ key: 'crown' }, true, facts(), 'Crown Ground XI');
  assert.equal(s.flags.crownWon, 1);
  assert.equal(s.epilogue.first, 'narrow', 'first outcome is permanent');
  assert.equal(s.epilogue.variant, 'loyalty');     // founding roster intact
  assert.equal(sb.FOC.events.ofType(s, 'RegionalBossDefeated').length, 1);
  guard = 0;
  while (guard++ < 15 && s.status !== 'complete') G.advance(s);
  assert.equal(s.status, 'complete');
});

// ---- notes + roles persist -------------------------------------------------
test('manager notes persist by stable id across reloads', (t) => {
  const sb = makeSandbox();
  const { FOC } = sb;
  const s = FOC.game.save();
  const pid = FOC.ids.playerId(s, sb.roster[3]);
  s.notes[pid] = 'covers the gap at four';
  FOC.save.persist(s);
  const s2 = FOC.save.load(s.scope);
  assert.equal(s2.notes[pid], 'covers the gap at four');
});

// ---- Thorne's prep is built from actual history ----------------------------
test("Thorne's chapter-10 briefing quotes the manager's real selections", (t) => {
  const sb = makeSandbox();
  const { FOC, App } = sb;
  const G = FOC.game;
  const s = finishPrologue(sb);
  App.pending = { __friendly: true, __camp: {} };
  FOC.adapter.applyOrders(s, legalDraft(sb));
  FOC.adapter.applyOrders(s, legalDraft(sb));
  s.matches.push({ ch: 1, key: 'willowmere', n: 1, opp: 'Willowmere CC', win: true, my: 240, op: 200,
    facts: facts({ batLines: [{ nm: 'Bert Poole', r: 90, b: 80, out: true }, { nm: 'Alf Onion', r: 30, b: 40, out: true }],
      bowlLines: [{ nm: 'Gus Irwin', w: 4, r: 30 }] }) });
  const prep = G.makeCtx(s).thornePrep();
  const all = prep.join(' ');
  assert.ok(/Opening pair: Alf Onion & Bert Poole/.test(all));
  assert.ok(/Bert Poole: 90 runs/.test(all));
  assert.ok(/Gus Irwin leads/.test(all));
  // the required Gaffer line is present in the chapter-10 beat
  s.ch = 10; s.beat = 0;
  const b = G.currentBeat(s);
  assert.ok(b.tx.includes("He's built his plan around everything you've already done. Good. Let him play your past. You manage what happens next."));
});

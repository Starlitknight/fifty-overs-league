import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSandbox } from './sandbox.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadWorld(sb) {
  const dir = path.join(root, 'apps/world-client/src');
  const files = readFileSync(path.join(dir, 'manifest.txt'), 'utf8').split('\n').filter(Boolean);
  let js = '"use strict";\n';
  for (const f of files) js += readFileSync(path.join(dir, f), 'utf8') + '\n';
  js += ';FOW';
  return vm.runInContext(js, sb.sandbox, { filename: 'world-bundle.js' });
}

const stubB = {
  anchor: r => ({ captain: 'Cap Marlow', star: 'Star Boyce', prospect: 'Young Frey',
    keeper: 'Gloves Hurd', bowler: 'Quick Slade', veteran: 'Old Pryor' })[r] || null,
  captainCandidates: () => [{ nm: 'Cap Marlow', why: 'top marks' }],
  clubName: () => 'Test CC',
  trialFacts: () => null,
  lastFacts: () => ({ win: true, tie: false, my: 231, myW: 6, op: 187, opW: 10, topNm: 'Star Boyce', topR: 84, batLines: [{ nm: 'Cap Marlow', r: 41, b: 50, out: true }] }),
  latestHeadline: () => 'A HEADLINE',
  activePromise: () => null,
  nextOpponentKey: () => 'willowmere',
  fixtureLive: () => false, xiConfirmed: () => false, ready: () => false
};

// ---- reference integrity ----------------------------------------------------
test('every hotspot dialogue, destination and asset reference resolves', () => {
  const sb = makeSandbox();
  const FOW = loadWorld(sb);
  const scenes = FOW.scenes.all();
  const errs = [];
  Object.keys(scenes).forEach(sid => {
    const s = scenes[sid];
    if (!FOW.assets.get(s.bg)) errs.push(sid + ': missing bg ' + s.bg);
    (s.characters || []).forEach(c => {
      if (c.asset && !FOW.assets.get(c.asset)) errs.push(sid + ': missing character asset ' + c.asset);
    });
    (s.hotspots || []).forEach(h => {
      if (h.dlg && !FOW.dialogue.node(h.dlg)) errs.push(sid + ': missing dialogue ' + h.dlg);
      if (h.go && !FOW.scenes.get(h.go)) errs.push(sid + ': missing scene ' + h.go);
      if (!(h.x >= 0 && h.x <= 100 && h.y >= 0 && h.y <= 100)) errs.push(sid + ': hotspot off-canvas ' + h.id);
    });
  });
  // dialogue chains + expressions resolve too
  Object.keys(FOW.dialogue._nodes).forEach(id => {
    const n = FOW.dialogue._nodes[id];
    if (n.next && !FOW.dialogue.node(n.next)) errs.push(id + ': missing next ' + n.next);
    (n.choices || []).forEach(c => { if (c.next && !FOW.dialogue.node(c.next)) errs.push(id + ': missing choice next ' + c.next); });
    if (n.expr && !FOW.assets.get(n.expr)) errs.push(id + ': missing expression asset ' + n.expr);
  });
  assert.deepEqual(errs, []);
});

test('all required scenes are reachable from the station', () => {
  const sb = makeSandbox();
  const FOW = loadWorld(sb);
  const seen = { station: 1 };
  const queue = ['station'];
  while (queue.length) {
    const s = FOW.scenes.get(queue.shift());
    (s.hotspots || []).forEach(h => {
      if (h.go && !seen[h.go]) { seen[h.go] = 1; queue.push(h.go); }
    });
  }
  ['home-exterior', 'pavilion', 'dressing', 'nets', 'office', 'trophy', 'map',
    'wm-town', 'wm-ground', 'wm-dressing', 'wm-entry'].forEach(id => {
    assert.ok(seen[id], id + ' unreachable');
  });
});

test('no ordinary dialogue box is a prose wall (≤32 words per box)', () => {
  const sb = makeSandbox();
  const FOW = loadWorld(sb);
  const w = FOW.state.fresh();
  w.flags.argumentSide = 'careful'; w.flags.colour = 'navy';
  const long = [];
  Object.keys(FOW.dialogue._nodes).forEach(id => {
    const n = FOW.dialogue._nodes[id];
    (n.lines || []).forEach(l => {
      const txt = typeof l === 'function' ? l(w, stubB) : l;
      if (txt && String(txt).split(/\s+/).length > 32) long.push(id + ': ' + String(txt).slice(0, 60));
    });
  });
  assert.deepEqual(long, []);
});

test('post-match dialogue quotes only stored facts and withdraws without them', () => {
  const sb = makeSandbox();
  const FOW = loadWorld(sb);
  const w = FOW.state.fresh();
  const n = FOW.dialogue._nodes['post.gaffer'];
  const withFacts = n.lines.map(l => typeof l === 'function' ? l(w, stubB) : l).filter(Boolean);
  assert.ok(withFacts.some(t => /231/.test(t)), 'quotes the real total');
  assert.ok(withFacts.some(t => /Boyce.*84|84/.test(t)), 'quotes the real top score');
  const without = n.lines.map(l => typeof l === 'function' ? l(w, { ...stubB, lastFacts: () => null }) : l).filter(Boolean);
  assert.ok(!without.some(t => /\d{2,3}/.test(t) && /for|against/.test(t)), 'invents no numbers without facts');
});

test('the earlier argument choice gets a visible post-match callback', () => {
  const sb = makeSandbox();
  const FOW = loadWorld(sb);
  const n = FOW.dialogue._nodes['post.captain'];
  const w1 = FOW.state.fresh(); w1.flags.argumentSide = 'careful';
  const w2 = FOW.state.fresh(); w2.flags.argumentSide = 'attack';
  const l1 = n.lines[0](w1, stubB), l2 = n.lines[0](w2, stubB);
  assert.ok(/careful/i.test(l1));
  assert.ok(/ball one|intent/i.test(l2));
  assert.notEqual(l1, l2, 'the callback reads the actual choice');
});

// ---- integrity fixes shipped with the slice --------------------------------
test('a dead-level knockout tie replays through the engine as a real super over', () => {
  const sb = makeSandbox();
  const v2 = sb.FOC.save2.fresh('so', 'so-seed');
  sb.FOC.worldgen.generate(v2, { squadGen: sb.sandbox.__foGame.squad, derive: () => {}, userClubName: 'U', userGround: 'G' });
  const ids = Object.keys(v2.world.clubsById).filter(id => !v2.world.clubsById[id].isUser);
  const f = sb.FOC.model.fixture(v2, 3, 'founders', 1, ids[0], ids[1]);
  f.status = 'played';
  f.result = { winnerId: null, tie: true, home: { runs: 200, wkts: 6 }, away: { runs: 200, wkts: 6 } };
  const runner = (home, away) => ({ innings: [], batFirstTeam: home.name, result: { winner: away.name, text: 'SO' } });
  const w = sb.FOC.competitions.tieBreak(v2, f, runner);
  assert.equal(w, ids[1], 'the replay winner takes the tie');
  assert.ok(/super over.*engine/.test(f.result.tieBreak));
});

test('wage bills are recomputed from live contracts at rollover', () => {
  const sb = makeSandbox();
  const io = { squadGen: sb.sandbox.__foGame.squad, derive: () => {}, userClubName: 'U', userGround: 'G' };
  const v2 = sb.FOC.save2.fresh('wb', 'wb-seed');
  sb.FOC.worldgen.generate(v2, io);
  const cid = Object.keys(v2.world.clubsById).find(id => !v2.world.clubsById[id].isUser);
  const c = v2.world.clubsById[cid];
  c.finances.wageBill = 999999;   // a stale ghost
  sb.FOC.worldsim.newSeason(v2, io);
  const expected = c.rosterIds.reduce((s, pid) => s + v2.world.playersById[pid].contract.wage, 0);
  assert.equal(c.finances.wageBill, expected);
});

test('a user sale that would leave fewer than 13 players is blocked by the board', () => {
  const sb = makeSandbox();
  const v2 = sb.FOC.save2.fresh('sg', 'sg-seed');
  sb.FOC.worldgen.generate(v2, { squadGen: sb.sandbox.__foGame.squad, derive: () => {},
    userClubName: sb.team.name, userGround: 'G' });
  const buyer = Object.keys(v2.world.clubsById).find(id => !v2.world.clubsById[id].isUser);
  const api = sb.FOC.career.api(v2);
  const before = sb.team.players.length;                       // 15 in the stub roster
  sb.team.players.splice(12);                                  // now 12 — at the floor
  api.acceptOffer({ buyerId: buyer, buyerName: 'B', playerName: sb.team.players[0].name, fee: 1000 });
  assert.equal(sb.team.players.length, 12, 'no sale below a playable squad');
  assert.ok(v2.world.news.some(n => /blocks the sale/.test(n.text)));
});

test('the career opens away at Willowmere — The Meadow, not the home ground', () => {
  const sb = makeSandbox();
  const v2 = sb.FOC.save2.fresh('wm', 'wm-seed');
  sb.FOC.worldgen.generate(v2, { squadGen: sb.sandbox.__foGame.squad, derive: () => {}, userClubName: 'U', userGround: 'G' });
  const f = sb.FOC.competitions.userFixture(v2, 1);
  const home = v2.world.clubsById[f.homeId];
  assert.equal(home.key, 'willowmere');
  assert.equal(home.ground, 'The Meadow');
  assert.equal(f.awayId, v2.user.clubId);
});

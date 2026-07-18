/* world/competitions — league table, NRR, and knockout-cup rules.
 * Pure functions over the v2 save. No UI, no engine. Cup defeats are
 * permanent for the edition; draws are made once, stored, and never
 * rerolled by a reload.
 */
FOC.competitions = (function () {
  var MDL = FOC.model, RNG = FOC.rng;

  function fixtures(v2, filter) {
    var out = [];
    for (var id in v2.world.fixturesById) {
      var f = v2.world.fixturesById[id];
      if (!filter || filter(f)) out.push(f);
    }
    return out;
  }

  // standard NRR: an all-out innings counts the full 50 overs
  function oversFor(inn) {
    return (inn.wkts >= 10) ? 50 : Math.max(1e-6, (inn.balls || 0) / 6);
  }

  function table(v2) {
    var T = {};
    for (var cid in v2.world.clubsById) {
      T[cid] = { clubId: cid, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, of: 0, ra: 0, oa: 0 };
    }
    fixtures(v2, function (f) { return f.comp === "league" && f.status === "played" && f.result; })
      .forEach(function (f) {
        var r = f.result, h = T[f.homeId], a = T[f.awayId];
        if (!h || !a) return;
        h.p++; a.p++;
        if (!r.winnerId) { h.t++; a.t++; h.pts++; a.pts++; }
        else if (r.winnerId === f.homeId) { h.w++; a.l++; h.pts += 2; }
        else { a.w++; h.l++; a.pts += 2; }
        h.rf += r.home.runs; h.of += oversFor(r.home); h.ra += r.away.runs; h.oa += oversFor(r.away);
        a.rf += r.away.runs; a.of += oversFor(r.away); a.ra += r.home.runs; a.oa += oversFor(r.home);
      });
    var rows = Object.keys(T).map(function (cid) {
      var x = T[cid];
      x.nrr = (x.of && x.oa) ? (x.rf / x.of - x.ra / x.oa) : 0;
      return x;
    });
    rows.sort(function (a, b) { return b.pts - a.pts || b.nrr - a.nrr; });
    return rows;
  }

  function position(v2, clubId) {
    var rows = table(v2);
    for (var i = 0; i < rows.length; i++) if (rows[i].clubId === clubId) return i + 1;
    return rows.length;
  }

  // ---- Founders Cup progression ---------------------------------------------
  function foundersAdvance(v2) {
    var cup = v2.world.competitionsById.founders;
    if (!cup || cup.winner) return;
    var stageFx = fixtures(v2, function (f) { return f.comp === "founders"; });
    var unplayed = stageFx.filter(function (f) { return f.status !== "played"; });
    if (unplayed.length) return;   // current stage not finished
    var winners = [], losers = [];
    var maxRound = 0;
    stageFx.forEach(function (f) { if (f.round > maxRound) maxRound = f.round; });
    stageFx.filter(function (f) { return f.round === maxRound; }).forEach(function (f) {
      var w = f.result.winnerId || f.homeId;   // a tied cup tie goes to the home side (documented rule)
      winners.push(w);
      var l = w === f.homeId ? f.awayId : f.homeId;
      losers.push(l);
      if (cup.out.indexOf(l) < 0) cup.out.push(l);
      cup.alive = cup.alive.filter(function (id) { return id !== l; });
    });
    if (cup.stage === "playin") {
      // QF: the six exempt clubs + two play-in winners, drawn ONCE and stored
      var exempt = cup.alive.filter(function (id) {
        return !cup.playin.some(function (pr) { return pr[0] === id || pr[1] === id; });
      });
      var pool = RNG.shuffle(v2.rng, "cupdraw", exempt.concat(winners), "founders-qf-draw");
      cup.bracket.qf = [];
      for (var i = 0; i < 8; i += 2) cup.bracket.qf.push([pool[i], pool[i + 1]]);
      cup.bracket.qf.forEach(function (pr) {
        var f = MDL.fixture(v2, 6, "founders", 2, pr[0], pr[1]);
        v2.world.fixturesById[f.id] = f;
      });
      cup.stage = "qf";
    } else if (cup.stage === "qf") {
      var pool2 = RNG.shuffle(v2.rng, "cupdraw", winners, "founders-sf-draw");
      cup.bracket.sf = [[pool2[0], pool2[1]], [pool2[2], pool2[3]]];
      cup.bracket.sf.forEach(function (pr) {
        var f = MDL.fixture(v2, 9, "founders", 3, pr[0], pr[1]);
        v2.world.fixturesById[f.id] = f;
      });
      cup.stage = "sf";
    } else if (cup.stage === "sf") {
      cup.bracket.final = [winners[0], winners[1]];
      var f2 = MDL.fixture(v2, 12, "founders", 4, winners[0], winners[1]);
      f2.neutral = true;   // neutral final, bigger occasion
      v2.world.fixturesById[f2.id] = f2;
      cup.stage = "final";
    } else if (cup.stage === "final") {
      cup.winner = winners[0];
      cup.stage = "done";
    }
  }

  // ---- Crown Cup: entry is EARNED — top four of the league after round 9 ----
  function crownSeed(v2) {
    var cup = v2.world.competitionsById.crown;
    if (!cup || cup.stage !== "pending") return;
    var leagueLeft = fixtures(v2, function (f) { return f.comp === "league" && f.status !== "played"; });
    if (leagueLeft.length) return;   // league not finished yet
    var top4 = table(v2).slice(0, 4).map(function (r) { return r.clubId; });
    cup.entrants = top4;
    cup.bracket.sf = [[top4[0], top4[3]], [top4[1], top4[2]]];
    cup.bracket.sf.forEach(function (pr) {
      var f = MDL.fixture(v2, 14, "crown", 1, pr[0], pr[1]);
      v2.world.fixturesById[f.id] = f;
    });
    cup.stage = "sf";
  }
  function crownAdvance(v2) {
    var cup = v2.world.competitionsById.crown;
    if (!cup || cup.winner || cup.stage === "pending") return;
    var fx = fixtures(v2, function (f) { return f.comp === "crown"; });
    if (fx.some(function (f) { return f.status !== "played"; })) return;
    var maxRound = 0;
    fx.forEach(function (f) { if (f.round > maxRound) maxRound = f.round; });
    var winners = fx.filter(function (f) { return f.round === maxRound; })
      .map(function (f) { return f.result.winnerId || f.homeId; });
    if (cup.stage === "sf" && winners.length === 2) {
      cup.bracket.final = winners;
      var f2 = MDL.fixture(v2, 15, "crown", 2, winners[0], winners[1]);
      f2.neutral = true;
      v2.world.fixturesById[f2.id] = f2;
      cup.stage = "final";
    } else if (cup.stage === "final") {
      cup.winner = winners[0];
      cup.stage = "done";
    }
  }

  function weekFixtures(v2, w) {
    return fixtures(v2, function (f) { return f.week === w; });
  }
  function userFixture(v2, w) {
    var uc = v2.user.clubId;
    return weekFixtures(v2, w).filter(function (f) { return f.homeId === uc || f.awayId === uc; })[0] || null;
  }

  return { fixtures: fixtures, table: table, position: position, oversFor: oversFor,
    foundersAdvance: foundersAdvance, crownSeed: crownSeed, crownAdvance: crownAdvance,
    weekFixtures: weekFixtures, userFixture: userFixture };
})();

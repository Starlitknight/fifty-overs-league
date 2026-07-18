/* world/managers — NPC manager decisions: a transparent utility model plus
 * bounded seeded variation. Traits are tendencies, not scripts; decisions
 * record their reasons for debugging. Managers never touch match results —
 * they pick, plan, trade, react and remember.
 */
FOC.npc = (function () {
  var RNG = FOC.rng;

  function club(v2, id) { return v2.world.clubsById[id]; }
  function mgr(v2, id) { return v2.world.managersById[id]; }
  function roster(v2, c) { return c.rosterIds.map(function (pid) { return v2.world.playersById[pid]; }); }

  function recentForm(c, n) { return (c.form || []).slice(-(n || 5)); }
  function lossStreak(c) {
    var s = 0, f = c.form || [];
    for (var i = f.length - 1; i >= 0 && f[i] === "L"; i--) s++;
    return s;
  }

  function decide(v2, m, log) {
    var c = club(v2, m.clubId); if (!c || c.isUser) return;
    var t = m.traits;
    // --- tactic shift after repeated failure: adaptable managers move sooner
    var streak = lossStreak(c);
    var shiftAt = t.adaptability >= 60 ? 2 : (t.patience >= 70 ? 4 : 3);
    if (streak >= shiftAt && RNG.chance(v2.rng, "managers", 0.5 + t.adaptability / 250, "tactic-shift?")) {
      var was = c.tendency;
      c.tendency = c.tendency === "balanced" ? (t.risk >= 55 ? "attacking" : "defensive")
        : (c.tendency === "attacking" ? "defensive" : "attacking");
      m.mood = Math.max(20, m.mood - 5);
      log("tactics", m.name + " tears up the plan after " + streak + " straight defeats: " + was + " → " + c.tendency + ".",
        { managerId: m.id, clubId: c.id, from: was, to: c.tendency, why: "loss streak " + streak });
    }
    // --- captain change: impatient managers act on sustained failure
    if (streak >= (t.patience >= 60 ? 5 : 3) && c.rosterIds.length > 2 &&
        RNG.chance(v2.rng, "managers", 0.35 + (100 - t.patience) / 400, "captain-change?")) {
      var cur = c.captainId;
      var cand = null;
      roster(v2, c).forEach(function (p) {
        if (p.id !== cur && (!cand || (p.engine.capt || 0) > (cand.engine.capt || 0))) cand = p;
      });
      if (cand) {
        c.captainId = cand.id;
        m.memory.push({ kind: "captain-change", aboutId: cur, note: "removed the armband during the " + streak + "-loss run" });
        log("captain", c.name + " hand the captaincy to " + cand.name + ".",
          { managerId: m.id, clubId: c.id, from: cur, to: cand.id, why: "form" });
      }
    }
    // --- mood and job security track results
    var f5 = recentForm(c, 5);
    var wins = f5.filter(function (x) { return x === "W"; }).length;
    m.mood = Math.max(10, Math.min(95, m.mood + (wins >= 3 ? 3 : wins <= 1 && f5.length >= 4 ? -4 : 0)));
    if (f5.length >= 5 && wins <= 1) t.jobSecurity = Math.max(5, t.jobSecurity - 4);
    if (wins >= 4) t.jobSecurity = Math.min(95, t.jobSecurity + 3);
  }

  // end of season: boards judge managers on position vs reputation-derived hopes
  function boardReview(v2, m, pos, nClubs, log) {
    var c = club(v2, m.clubId); if (!c || c.isUser) return null;
    var expected = Math.max(1, Math.round(nClubs * (1 - c.reputation / 100)));
    var verdict = pos <= expected ? "safe" : (pos - expected >= 3 ? "dismissed" : "warned");
    if (verdict === "dismissed" && m.traits.jobSecurity > 65) verdict = "warned";   // credit in the bank
    if (verdict === "dismissed") {
      m.history.push({ season: v2.seasonNumber, clubId: c.id, note: "dismissed — finished " + pos + " (expected " + expected + ")" });
      m.clubId = null; c.managerId = null;
      log("dismissal", m.name + " leaves " + c.name + " — " + pos + "th was not the board's idea of a season.",
        { managerId: m.id, clubId: c.id, pos: pos, expected: expected });
    }
    return verdict;
  }

  // Engine orders for an NPC club — personality reaching actual deliveries.
  // The engine consults ordersMap for: the batting ORDER, the captain, and
  // the bowling SPELLS (ordersFor at mkInns + the spell compiler). We
  // therefore predict the XI exactly the way the engine's pickXI will pick
  // it from the fit roster, then let the manager shape order and overs.
  function matchOrders(v2, clubId, fixture) {
    var c = club(v2, clubId); if (!c || c.isUser) return null;
    var m = mgr(v2, c.managerId); if (!m) return null;
    var ps = roster(v2, c).filter(function (p) { return !p.injuryWeeks; });
    if (ps.length < 11) ps = roster(v2, c);
    var E = function (p) { return p.engine; };
    // replicate engine pickXI: best-bat keeper, five bowlers, rest by bat
    var kps = ps.filter(function (p) { return E(p).keeper; }).sort(function (a, b) { return (E(b).bat || 0) - (E(a).bat || 0); });
    var keeper = kps[0] || ps.slice().sort(function (a, b) { return (E(b).bat || 0) - (E(a).bat || 0); })[0];
    var bowlers = ps.filter(function (p) { return E(p).bowlType && p !== keeper; })
      .sort(function (a, b) { return ((E(b).threat || 0) + (E(b).control || 0)) - ((E(a).threat || 0) + (E(a).control || 0)); });
    var five = bowlers.slice(0, 5);
    var chosen = {}; chosen[keeper.name] = 1; five.forEach(function (p) { chosen[p.name] = 1; });
    var rest = ps.filter(function (p) { return !chosen[p.name]; })
      .sort(function (a, b) { return (E(b).bat || 0) - (E(a).bat || 0); });
    var xi = [keeper].concat(five, rest).slice(0, 11);
    var order = xi.slice().sort(function (a, b) { return (E(b).bat || 0) - (E(a).bat || 0); });
    // youth bias, observable: a young batter is promoted one place
    if (m.traits.youthBias >= 70) {
      for (var yi = 1; yi < order.length - 1; yi++) {
        if (order[yi].age <= 22) { var t = order[yi - 1]; order[yi - 1] = order[yi]; order[yi] = t; break; }
      }
    }
    var captain = null;
    order.forEach(function (p) { if (p.id === c.captainId) captain = p; });
    // spells, shaped by taste: spin-devoted clubs hand the middle overs to
    // spinners; risk-takers frontload and return their best at the death;
    // the prudent spread the load
    var spinFirst = c.arch === "wizard" || m.traits.prudence >= 85;
    var pool = five.slice();
    if (spinFirst) pool.sort(function (a, b) {
      var sa = /spin/i.test(E(a).bowlType || "") ? 1 : 0, sb = /spin/i.test(E(b).bowlType || "") ? 1 : 0;
      return sb - sa || ((E(b).threat || 0) + (E(b).control || 0)) - ((E(a).threat || 0) + (E(a).control || 0));
    });
    var spells = null;
    if (pool.length >= 5) {
      var b1 = pool[spinFirst ? 3 : 0], b2 = pool[spinFirst ? 4 : 1], b3 = pool[spinFirst ? 0 : 2], b4 = pool[spinFirst ? 1 : 3], b5 = pool[spinFirst ? 2 : 4];
      var att = m.traits.risk >= 60 ? "att" : "bal";
      spells = {
        north: [{ bowler: b1.name, first: 1, n: 5, field: att }, { bowler: b3.name, first: 11, n: 10, field: "bal" },
                { bowler: b5.name, first: 31, n: 5, field: "bal" }, { bowler: b1.name, first: 41, n: 5, field: m.traits.risk >= 60 ? "att" : "def" }],
        south: [{ bowler: b2.name, first: 2, n: 5, field: att }, { bowler: b4.name, first: 12, n: 10, field: "bal" },
                { bowler: b2.name, first: 32, n: 5, field: "bal" }, { bowler: b5.name, first: 42, n: 5, field: "def" }]
      };
    }
    return {
      batOrder: order.map(function (p) { return p.name; }),
      captain: captain ? captain.name : (order[0] && order[0].name),
      keeper: keeper.name,
      tossCall: "", tossDecision: c.tendency === "attacking" ? "bat" : "bowl",
      spells: spells || { north: [], south: [] }, compiled: [], showPT: false, saved: true
    };
  }

  return { decide: decide, boardReview: boardReview, lossStreak: lossStreak, matchOrders: matchOrders };
})();

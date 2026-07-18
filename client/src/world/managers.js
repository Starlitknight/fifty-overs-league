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

  return { decide: decide, boardReview: boardReview, lossStreak: lossStreak };
})();

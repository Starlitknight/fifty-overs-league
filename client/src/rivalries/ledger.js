/* rivalries/ledger — rivalries are earned, never declared. The ledger only
 * records what actually happened (meetings, close finishes, cup knockouts,
 * finals, transfers) and recognises thresholds as they are crossed.
 * Cooling is real too: a season without meetings drops the temperature.
 */
FOC.rivalry = (function () {
  function pairKey(a, b) { return a < b ? a + "~" + b : b + "~" + a; }

  function entry(v2, a, b) {
    var k = pairKey(a, b);
    var R = v2.rivalries.clubs;
    if (!R[k]) R[k] = { key: k, a: a < b ? a : b, b: a < b ? b : a, games: 0, aWins: 0, bWins: 0,
      close: 0, cupKOs: [], finals: 0, transfers: 0, level: 0, lastSeason: 0, notes: [] };
    return R[k];
  }

  function score(e) {
    return e.close * 2 + e.cupKOs.length * 3 + e.finals * 4 + e.transfers * 2 + (e.games >= 3 ? 1 : 0);
  }
  var LEVELS = ["none", "emerging", "recognised", "escalated"];
  function levelFor(s) { return s >= 10 ? 3 : (s >= 6 ? 2 : (s >= 3 ? 1 : 0)); }

  function onResult(v2, f, log) {
    if (!f.result || f.__riv) return;   // each fixture counts exactly once
    f.__riv = 1;
    var e = entry(v2, f.homeId, f.awayId);
    e.games++; e.lastSeason = v2.seasonNumber;
    if (f.result.winnerId === e.a) e.aWins++;
    else if (f.result.winnerId === e.b) e.bWins++;
    var margin = Math.abs((f.result.home.runs || 0) - (f.result.away.runs || 0));
    if (f.result.tie || margin <= 15) { e.close++; e.notes.push("S" + v2.seasonNumber + "W" + v2.week + ": decided by " + (f.result.tie ? "a tie" : margin + " runs")); }
    if (f.comp !== "league") {
      e.cupKOs.push({ season: v2.seasonNumber, by: f.result.winnerId, comp: f.comp });
      if (f.round >= 4 || f.neutral) e.finals++;
    }
    check(v2, e, log);
  }

  function onTransfer(v2, dep, log) {
    var e = entry(v2, dep.fromId, dep.toId);
    e.transfers++; e.lastSeason = v2.seasonNumber;
    e.notes.push("S" + dep.season + ": " + dep.playerName + " crossed over");
    check(v2, e, log);
  }

  function check(v2, e, log) {
    var lv = levelFor(score(e));
    if (lv > e.level) {
      e.level = lv;
      var names = [v2.world.clubsById[e.a], v2.world.clubsById[e.b]].map(function (c) { return c ? c.name : "?"; });
      var evName = lv === 1 ? "RivalryEmerging" : (lv === 2 ? "RivalryRecognised" : "RivalryEscalated");
      v2.history.events.push({ t: evName, week: v2.week, season: v2.seasonNumber, key: e.key });
      v2.history.milestones.push({ kind: evName, note: names[0] + " v " + names[1] + " — " + LEVELS[lv] });
      if (log) log("rivalry", names[0] + " v " + names[1] + ": this fixture means something now (" + LEVELS[lv] + ").", { key: e.key, level: lv });
    }
  }

  // a quiet season cools things — called at season end
  function coolAll(v2, log) {
    for (var k in v2.rivalries.clubs) {
      var e = v2.rivalries.clubs[k];
      if (e.level > 0 && e.lastSeason < v2.seasonNumber) {
        e.level--;
        v2.history.events.push({ t: "RivalryCooled", season: v2.seasonNumber, key: k });
        if (log) log("rivalry", "Time does its work — an old edge dulls (" + k + ").", { key: k });
      }
    }
  }

  function forClub(v2, clubId) {
    var out = [];
    for (var k in v2.rivalries.clubs) {
      var e = v2.rivalries.clubs[k];
      if (e.a === clubId || e.b === clubId) out.push(e);
    }
    return out.sort(function (x, y) { return score(y) - score(x); });
  }

  return { pairKey: pairKey, entry: entry, score: score, levelFor: levelFor,
    onResult: onResult, onTransfer: onTransfer, coolAll: coolAll, forClub: forClub, LEVELS: LEVELS };
})();

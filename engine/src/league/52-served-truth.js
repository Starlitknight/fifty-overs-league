/* ============================================================================
   SERVED TRUTH — the league facts come from the world, or they do not come.

   THE BUG THIS EXISTS TO KILL. This game grew out of a single-player engine
   that kept everything in one localStorage blob: the fixtures, the results,
   the table, the lot. The World Service replaced all of that - the umpire
   plays every round on a server and publishes a snapshot - but the club home
   went on reading the OLD blob. leagueRows() built a table from App.results;
   foFormMap() built the form strip from App.results; foUserFixtures() read
   App.season.schedule. So the front page could tell a manager he was third
   after six matches in round three of eighteen, while the world he actually
   plays in had just been restarted and had not bowled a ball. Nothing was
   broken on the server; the page simply was not looking at it.

   That class of bug cannot be fixed one page at a time, because the next
   surface to be written will reach for the same familiar globals. So this is
   a rule with a switch behind it:

     WHEN THIS DEVICE HOLDS A CLAIM IN THE SERVED WORLD, EVERY LEAGUE FACT
     COMES FROM THE SERVED SNAPSHOT. The local save is not consulted, not
     preferred, not merged with, not fallen back to.

   window.leagueRows is REPLACED here rather than read, so every caller in the
   codebase - written or yet to be written - gets served rows without knowing
   this file exists. That is the point: correctness that does not depend on
   the next author remembering.

   WHAT LOCAL STORAGE IS STILL ALLOWED TO HOLD. Three things, none of them
   game state:
     - who you are: the session token and the cached claim, both re-fetched;
     - what you were looking at: view toggles, sort orders, dismissed nudges;
     - a copy of something the server already said, used only to paint before
       the fetch lands, and overwritten by it.
   Anything the umpire decides - a result, a table, a fixture, a squad - is
   read from the world every time. If the world cannot be reached, the honest
   answer is "not yet", which every accessor here returns as null or empty.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foServedTruth) return; window.__foServedTruth = 1;

  function claim() {
    try {
      if (window.__foWorldClaim) return window.__foWorldClaim;
      var c = JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      return (c && c.country != null && c.slot != null) ? c : null;
    } catch (e) { return null; }
  }
  function nation() { var c = claim(); return c ? c.country : null; }
  function planet() { try { return window.__foPlanet || null; } catch (e) { return null; } }

  // the nation's league snapshot, and a nudge to refresh it. get() answers from
  // whatever the feed last received; want() asks the world for a newer one.
  function snap() {
    var n = nation(); if (!n) return null;
    try {
      var L = window.__foWorldLg; if (!L) return null;
      try { L.want(n, function () {}); } catch (eW) {}
      return L.get(n) || null;
    } catch (e) { return null; }
  }
  // ON means: this device plays in the served world AND the world has spoken.
  // Both halves matter - a claim with no snapshot yet is "not yet", not "use
  // the old blob instead".
  function on() { return !!(nation() && snap()); }

  function mySlot() { var c = claim(); return c ? (c.slot | 0) : -1; }
  function myRow() {
    var b = snap(); if (!b) return null;
    var sl = mySlot();
    var rows = b.table || [];
    for (var i = 0; i < rows.length; i++) if ((rows[i].slot | 0) === sl) return rows[i];
    return null;
  }
  function myName() { var r = myRow(); return r ? r.name : null; }

  // THE TABLE, in the shape every caller in this codebase already expects from
  // leagueRows(): nm, p, w, l, t, pts, nrr - sorted as the world sorted it.
  function rows() {
    var b = snap(); if (!b) return [];
    return (b.table || []).map(function (r) {
      return { nm: r.name, p: r.p | 0, w: r.w | 0, l: r.l | 0, t: r.t | 0,
        pts: r.pts | 0, nrr: +r.nrr || 0, slot: r.slot | 0, boss: !!r.boss };
    });
  }

  // FORM, oldest first, from the banked results and nothing else. A club that
  // has played nothing has an empty strip - which is the correct answer for a
  // season that has just restarted, and the one the old code could not give.
  function formOf(name) {
    var b = snap(); if (!b || !name) return [];
    return (b.results || [])
      .filter(function (r) { return r && (r.home === name || r.away === name); })
      .sort(function (a, c) { return (a.round | 0) - (c.round | 0); })
      .map(function (r) { return !r.winner ? "T" : (r.winner === name ? "W" : "L"); });
  }
  function form() { return formOf(myName()); }

  // THE DAY THE SUMMER OPENED, as the umpire recorded it - not as the date
  // implies. A world that is redealt and restarted opens its season 1 on the
  // day it was restarted, and every page that counts rounds from the calendar
  // rather than from this is a fortnight out.
  function startDay() { var b = snap(); return (b && b.startDay != null) ? (b.startDay | 0) : null; }
  // days until the first ball; 0 once the season is under way
  function opensIn() {
    var sd = startDay(); if (sd == null) return 0;
    try { return Math.max(0, sd - window.__foPlanet.dayIx(Date.now())); } catch (e) { return 0; }
  }
  function roundsPlayed() { var b = snap(); return b ? (b.roundsPlayed | 0) : 0; }
  function totalRounds() { var b = snap(); return (b && b.rounds) ? (b.rounds | 0) : 18; }
  function seasonNo() { var b = snap(); return b ? (b.seasonNo | 0) || 1 : 1; }
  // the round about to be played, 1-based, capped at the last one
  function round() { return Math.min(roundsPlayed() + 1, totalRounds()); }

  // WHEN A ROUND IS PLAYED — the one answer every surface that dates a fixture
  // must ask for. Round index is 0-based, as the club home counts. The old
  // answer was "today, plus however many rounds away it is" off the LOCAL
  // season's round counter: wrong twice over, because a served round bears no
  // relation to the local one, and because every fourth world day is a rest day
  // so rounds are not one per day. Returns the moment of the first ball, at the
  // nation's own hour, or null if the world has not spoken.
  function ballAt(round0) {
    var b = snap(), P = planet(), n = nation();
    if (!b || !P || !P.dayOfSeasonRound || n == null) return null;
    try {
      var d = P.dayOfSeasonRound(seasonNo(), (round0 | 0) + 1);
      if (d == null) return null;
      return P.EPOCH + d * P.DAY + P.natHour(n) * 3600000;
    } catch (e) { return null; }
  }

  // THE NEXT FIXTURE, from the world's own draw. schedOf() is the same circle
  // method the umpire schedules with, so the opponent named here is the
  // opponent the umpire will actually send out.
  function fixtures(limit) {
    var out = [], b = snap(), P = planet(), n = nation(), sl = mySlot();
    if (!b || !P || !P.schedOf || !P.sidesOf || n == null || sl < 0) return out;
    try {
      var sched = P.schedOf(n, seasonNo()) || [];
      var sides = P.sidesOf(n) || [];
      var byName = {}; (b.table || []).forEach(function (r) { byName[r.slot | 0] = r.name; });
      var nameOf = function (s) { return byName[s] || (sides[s] && sides[s].name) || ("Slot " + s); };
      for (var r0 = roundsPlayed(); r0 < sched.length && out.length < (limit || 6); r0++) {
        var rd = sched[r0] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== sl && f[1] !== sl) continue;
          var isHome = f[0] === sl, oppSlot = isHome ? f[1] : f[0];
          out.push({
            round: r0,                       // 0-based, as the club home counts
            roundNo: r0 + 1,                 // 1-based, as a human counts
            isHome: isHome, oppSlot: oppSlot,
            opp: { name: nameOf(oppSlot), slot: oppSlot },
            home: { name: nameOf(f[0]), slot: f[0] },
            away: { name: nameOf(f[1]), slot: f[1] }
          });
        }
      }
    } catch (e) {}
    return out;
  }

  window.__foServed = {
    on: on, claim: claim, nation: nation, slot: mySlot, snapshot: snap,
    rows: rows, me: myRow, name: myName, form: form, formOf: formOf,
    round: round, roundsPlayed: roundsPlayed, totalRounds: totalRounds,
    seasonNo: seasonNo, startDay: startDay, opensIn: opensIn,
    ballAt: ballAt, fixtures: fixtures
  };

  // ---- THE SWITCH -----------------------------------------------------------
  // leagueRows() is the table every surface in the game asks for. Replacing it
  // once here means no page can accidentally show the local blob's table again,
  // including pages nobody has written yet. The local implementation is kept
  // for the solo and practice worlds, which have no served counterpart.
  try {
    if (typeof window.leagueRows === "function" && !window.leagueRows.__foServed) {
      var local = window.leagueRows;
      window.leagueRows = function (comp) {
        if ((comp || "league") === "league" && on()) return rows();
        return local.apply(this, arguments);
      };
      window.leagueRows.__foServed = 1;
    }
  } catch (e) {}
})();

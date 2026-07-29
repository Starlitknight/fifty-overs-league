/* ============================================================================
   THE CHAMPIONS CUP (#/champions) — the champions league of CLUBS. The
   nations have their World Cup; this is the other crown: the champion club
   of every one of the 19 national leagues, drawn into one knockout. Your
   club qualifies the only way anybody does - by winning England.

   The cup lives inside the world calendar's cup window, at its own hours,
   so both competitions share the closing days of every season:
     day 19  the draw, then THE PLAY-INS at 18:00 UTC (seeds 14-19)
     day 20  the last sixteen, 15:00
     day 21  quarter-finals, 15:00
     day 22  semi-finals, 20:00
     day 23  THE FINAL, 21:00 - the season's closing night
   (The nations' World Cup keeps its 12:00/12:00/18:00/18:00 slots.)

   Same law as the whole planet: every match is a pure function of the
   world day and the seeds - no server, no sync, every phone the identical
   bracket. England's entrant comes from YOUR league table (the champion
   once the season is done, the leader as-it-stands before), so your world
   and the cup agree by construction. When the World Service goes
   authoritative for cups (P4 server-side), this page reads it instead.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foCL) return; window.__foCL = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rnd01(s) { return h32(s) / 4294967296; }
  function P() { return window.__foPlanet || null; }
  function cx() { return window.__foCxAPI || null; }
  function ready() { return typeof App !== "undefined" && App && P() && cx(); }
  function myNation() {
    try { return (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (e) { return "eng"; }
  }
  function flagOf(rid) {
    var base = (typeof FO_ART !== "undefined") ? FO_ART : "client/art/";
    try { return base + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; }
  }
  var HOURS = { pi: 18, r16: 15, qf: 15, sf: 20, final: 21 };
  var DAYS = { pi: 19, r16: 20, qf: 21, sf: 22, final: 23 };
  var STAGE_NM = { pi: "The play-ins", r16: "The last sixteen", qf: "Quarter-finals", sf: "Semi-finals", final: "The Final" };
  var ORDER = ["pi", "r16", "qf", "sf", "final"];

  // ---- England's entrant: YOUR league, by construction ----------------------
  function myEntrant() {
    try {
      var rows = leagueRows(); if (!rows || !rows.length) return null;
      var done = App.season && App.season.round >= App.season.schedule.length;
      var me = null; try { me = userTeam().name; } catch (e) {}
      return { name: rows[0].nm, mine: rows[0].nm === me, settled: !!done };
    } catch (e) { return null; }
  }

  // ---- the nineteen: every league's champion, seeded ------------------------
  function entrants(season) {
    var pl = P(), my = myNation(), now = Date.now();
    var out = [];
    (cx().regions() || []).filter(function (r) { return !r.final; }).forEach(function (r) {
      var nm = null, mine = false, provisional = false;
      if (r.id === my) {
        // once the draw is made (day 19) England's entrant FREEZES into the
        // save: the bracket must never rewrite itself because the user's
        // league table moved mid-cup
        var frozen = null;
        try { if (App.clEng && App.clEng.season === season) frozen = App.clEng; } catch (eF) {}
        var e = frozen || myEntrant();
        nm = (e && e.name) || (r.nm + " champions");
        mine = !!(e && e.mine);
        provisional = frozen ? false : !(e && e.settled);
        try {
          if (!frozen && pl.phaseOf(now).di >= 19 && pl.phaseOf(now).season === season && e && e.name) {
            App.clEng = { season: season, name: e.name, mine: !!e.mine };
            if (typeof saveGame === "function") saveGame(false);
          }
        } catch (eZ) {}
      } else {
        var rd = pl.roundsDone(now, season, r.id);
        var t = pl.tableOf(r.id, season, rd);
        nm = t[0] && t[0].side.name;
        provisional = rd < pl.ROUNDS;
      }
      if (!nm) return;
      // seeding: a stable per-season shuffle, the same law as the World Cup draw
      var seedv = rnd01("cl|" + season + "|" + r.id);
      out.push({ rid: r.id, nat: r.nm, name: nm, mine: mine, provisional: provisional,
        seedv: seedv, str: 0.97 + seedv * 0.1 + (mine ? 0.01 : 0) });
    });
    out.sort(function (a, b) { return b.seedv - a.seedv; });
    out.forEach(function (x, i) { x.seed = i + 1; });
    return out;
  }

  // ---- one seeded fifty-over scoreline (the planet's own dialect) ----------
  function playTie(season, stage, gi, A, B) {
    var key = "clm|" + season + "|" + stage + "|" + gi;
    var base = 210 + Math.floor(rnd01(key + "|base") * 110);
    var first = Math.max(150, Math.min(368, Math.round(base * (0.94 + (A.str - B.str) * 0.5 + rnd01(key + "|v") * 0.12))));
    var fw = Math.min(10, 3 + Math.floor(rnd01(key + "|fw") * 8));
    var pA = Math.max(0.2, Math.min(0.8, 0.5 + (A.str - B.str) * 2.2));
    var winA = rnd01(key + "|w") < pA;
    var second, sw, text;
    if (winA) {
      second = first - (3 + Math.floor(rnd01(key + "|mg") * Math.min(80, first - 70)));
      sw = 10; text = A.name + " win by " + (first - second) + " runs";
    } else {
      second = first + 1 + Math.floor(rnd01(key + "|xr") * 5);
      sw = 10 - (1 + Math.floor(rnd01(key + "|wl") * 7));
      text = B.name + " win by " + (10 - sw) + " wickets";
    }
    return { a: A, b: B, winner: winA ? A : B, loser: winA ? B : A,
      hs: first + (fw >= 10 ? " all out" : "/" + fw), as: second + (sw >= 10 ? " all out" : "/" + sw), text: text };
  }

  // ---- the whole bracket, one pure function ---------------------------------
  function bracket(season) {
    var e = entrants(season);
    if (e.length < 4) return null;
    var byes = e.slice(0, e.length - 6), piField = e.slice(e.length - 6);
    var stages = {};
    stages.pi = piField.length >= 6 ? [0, 1, 2].map(function (i) {
      return playTie(season, "pi", i, piField[i], piField[5 - i]);
    }) : [];
    var field = byes.concat(stages.pi.map(function (m) { return m.winner; }));
    field.sort(function (a, b) { return a.seed - b.seed; });
    var cur = [];
    for (var i = 0; i < field.length / 2; i++) cur.push([field[i], field[field.length - 1 - i]]);
    ["r16", "qf", "sf", "final"].forEach(function (st) {
      var out = [], next = [];
      cur.forEach(function (pair, gi) {
        var m = playTie(season, st, gi, pair[0], pair[1]);
        out.push(m); next.push(m.winner);
      });
      stages[st] = out;
      cur = []; for (var j = 0; j < next.length; j += 2) cur.push([next[j], next[j + 1]]);
    });
    stages.champion = stages.final[0] && stages.final[0].winner;
    return stages;
  }

  // which stages are FINAL at `now` (their window has closed)
  function stagesDone(now, season) {
    var pl = P(), p = pl.phaseOf(now);
    if (season < p.season) return 5;
    if (season > p.season) return 0;
    var n = 0;
    ORDER.forEach(function (st) {
      var end = pl.EPOCH + (((season - 1) * pl.CYCLE + DAYS[st]) * 86400000) + (HOURS[st] + 3) * 3600000;
      if (now >= end) n++;
    });
    return n;
  }
  function stageTime(season, st) {
    var pl = P();
    return pl.EPOCH + (((season - 1) * pl.CYCLE + DAYS[st]) * 86400000) + HOURS[st] * 3600000;
  }
  window.__foChampCup = { entrants: entrants, bracket: bracket, stagesDone: stagesDone };

  // ---- the page -------------------------------------------------------------
  // PHASE 4 OF THE ALMANACK. The cup's own drama - who is in it, where it has
  // got to, and when the next night is - reads better as a stated verdict, a
  // bracket in ruled rows and a road with the stages ticked off than it did as
  // a dark hero over floating tie cards. The seeding, the bracket and the
  // clock are the same pure functions of the world day.
  function A() { return window.AL || null; }
  function onCup() { return (location.hash || "").split("?")[0] === "#/champions"; }

  window.foRenderChampionsPage = function () {
    if (!onCup()) return;
    var page = document.getElementById("page"); if (!page || !ready()) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e0) {}

    var pl = P(), now = Date.now(), p = pl.phaseOf(now);
    var season = p.season, done = stagesDone(now, season);
    var e = entrants(season), br = bracket(season);
    var my = e.filter(function (x) { return x.mine; })[0] || null;
    var eng = e.filter(function (x) { return x.rid === myNation(); })[0] || null;
    var provisional = p.di < 18;

    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var when = function (st) {
      var d = new Date(stageTime(season, st));
      return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " · " + HOURS[st] + ":00 UTC";
    };

    var status, chip;
    if (p.di < 18) { status = "Nineteen leagues are deciding their champions. The draw is made on day 19."; chip = "The race is on"; }
    else if (done === 0) { status = "The nineteen are known. The play-ins open the cup at " + when("pi") + "."; chip = "The draw is made"; }
    else if (done < 5) { var nxt = ORDER[done]; status = STAGE_NM[nxt] + " " + (done === 4 ? "crowns the champion" : "come next") + " · " + when(nxt) + "."; chip = "Cup in progress"; }
    else { status = (br && br.champion ? br.champion.name + " are champions of the world's clubs." : "The cup is decided."); chip = "Champions crowned"; }

    var body = al.mast("World cricket · season " + season + " · the clubs' crown", "The Champions Cup",
      "Nineteen league champions, one knockout, and a crown nobody has to be awake for.");
    body += al.subnav("champions");

    body += al.decide({
      kind: (done >= 5 && br && br.champion && br.champion.mine) ? "done" : (my ? "act" : ""),
      title: chip + " · " + status,
      note: my
        ? (provisional ? "You lead your league — hold the top and the cup is yours to enter."
                       : "Your club carries its country's flag into the cup.")
        : (eng ? eng.name + " carry your country. Win your league and this stage is yours." : ""),
    });

    if (done >= 5 && br && br.champion) {
      body += al.sec("Champions of the world's clubs",
        '<p class="al-lede">' + E(br.champion.name) + "</p>" +
        '<p class="al-read">Season ' + season + (br.champion.mine ? " · your club. The whole planet watched." : "") + "</p>");
    }

    // ---- the bracket: only stages whose windows have CLOSED show results ---
    if (br && done > 0) {
      ORDER.slice(0, done).forEach(function (st) {
        var ms = br[st]; if (!ms || !ms.length) return;
        body += al.sec(STAGE_NM[st] + " · " + when(st), al.ledger(ms.map(function (m) {
          var winner = m.winner === m.a ? m.a.name : m.winner === m.b ? m.b.name : "";
          return [m.a.name + " v " + m.b.name, m.hs + " · " + m.as,
            (m.a.mine || m.b.mine) ? ((winner && ((m.winner.mine)) ) ? "pos" : "neg") : ""];
        })));
      });
    }

    body += al.sec("The nineteen · " + (provisional ? "as the tables stand" : "champions all"),
      "<div class='al-tblwrap'><table class='al-tbl'><thead><tr><th></th><th class='l'>Club</th>" +
      "<th class='l al-s'>Nation</th></tr></thead><tbody>" +
      e.map(function (x) {
        return "<tr" + (x.mine ? " class='al-you'" : "") + "><td class='al-pos'>" + x.seed + "</td>" +
          "<td class='l al-club'><img class='al-flag' src='" + flagOf(x.rid) + "' alt='' " +
            "onerror=\"this.style.display='none'\">" + E(x.name) +
            (x.mine ? "<span class='al-you__tag'>YOU</span>" : "") + "</td>" +
          "<td class='l al-s'>" + E(x.nat) + (x.provisional ? " · as it stands" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>");

    body += al.sec("The road", '<div class="al-plaques">' + ORDER.map(function (st, i) {
      return '<div class="al-plaque' + (done > i ? " al-plaque--won" : "") + '">' +
        "<b>" + STAGE_NM[st] + "</b><i>" + when(st) + "</i>" +
        "<em>" + (done > i ? "played" : done === i ? "next" : "to come") + "</em></div>";
    }).join("") + "</div>");

    page.innerHTML = al.page({ body: body });
  };

  // gazette + wire: the cup speaks through the world's news
  try {
    if (P() && P().genWire && !P().genWire.__foCL) {
      var _gw = P().genWire;
      var wrapped = function (now) {
        var out = _gw(now) || [];
        try {
          var p = P().phaseOf(now), done = stagesDone(now, p.season);
          if (done >= 5) {
            var br = bracket(p.season);
            if (br && br.champion) out.unshift({ day: p.day, season: p.season, dayInSeason: p.di, phase: "cup", category: "cup", importance: 100, headline: "CLUB CHAMPIONS OF THE WORLD: " + br.champion.name + " lift the Champions Cup" });
          } else if (done > 0) {
            var br2 = bracket(p.season), st = ORDER[done - 1];
            (br2[st] || []).slice(0, 3).forEach(function (m) {
              out.push({ day: p.day, season: p.season, dayInSeason: p.di, phase: "cup", category: "cup", importance: 78, headline: "Champions Cup, " + STAGE_NM[st].toLowerCase() + ": " + m.text });
            });
          }
        } catch (e) {}
        return out;
      };
      wrapped.__foCL = 1;
      window.__foPlanet.genWire = wrapped;
    }
  } catch (e) {}

})();

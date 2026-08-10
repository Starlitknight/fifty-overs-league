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
  // THE SERVER'S DAYS, not a day later: server/clock.mjs CUP_DAYS is the law,
  // and this used to sit one day behind it on every stage.
  var DAYS = { pi: 24, r16: 25, qf: 26, sf: 27, final: 28 };
  var STAGE_NM = { pi: "The play-ins", r16: "The last sixteen", qf: "Quarter-finals", sf: "Semi-finals", final: "The Final" };
  var ORDER = ["pi", "r16", "qf", "sf", "final"];

  // ---- England's entrant: YOUR league, by construction ----------------------
  function myEntrant() {
    try {
      var me = null; try { me = userTeam().name; } catch (e) {}
      // the served league is the truth, and the champion is DIVISION ONE's
      // leader - not whoever tops the division your own club plays in
      try {
        var sv = window.__foWorldLg && window.__foWorldLg.get(myNation());
        if (sv && sv.table && sv.table.length) {
          return { name: sv.table[0].name, mine: sv.table[0].name === me, slot: sv.table[0].slot,
            settled: (sv.roundsPlayed | 0) >= (sv.rounds || 99) };
        }
      } catch (eSv) {}
      var rows = leagueRows(); if (!rows || !rows.length) return null;
      var done = App.season && App.season.round >= App.season.schedule.length;
      return { name: rows[0].nm, mine: rows[0].nm === me, settled: !!done };
    } catch (e) { return null; }
  }

  // ---- the nineteen: every league's champion, seeded ------------------------
  function entrants(season) {
    var pl = P(), my = myNation(), now = Date.now();
    var out = [];
    (cx().regions() || []).filter(function (r) { return !r.final; }).forEach(function (r) {
      var nm = null, mine = false, provisional = false, slot = null;
      if (r.id === my) {
        // once the draw is made (day 19) England's entrant FREEZES into the
        // save: the bracket must never rewrite itself because the user's
        // league table moved mid-cup
        var frozen = null;
        try { if (App.clEng && App.clEng.season === season) frozen = App.clEng; } catch (eF) {}
        var e = frozen || myEntrant();
        nm = (e && e.name) || (r.nm + " champions");
        slot = e && e.slot != null ? e.slot : null;
        mine = !!(e && e.mine);
        provisional = frozen ? false : !(e && e.settled);
        try {
          if (!frozen && pl.phaseOf(now).di >= (pl.LEAGUE_DAYS || 24) && pl.phaseOf(now).season === season && e && e.name) {
            App.clEng = { season: season, name: e.name, mine: !!e.mine };
            if (typeof saveGame === "function") saveGame(false);
          }
        } catch (eZ) {}
      } else {
        // THE WORLD'S TABLE FIRST. The umpire publishes every league's real
        // standings; the local model is only the stand-in while the network
        // answers. And the champion is DIVISION ONE's leader - a second
        // flight winning its own race qualifies for promotion, not for this.
        var sv = null;
        try { sv = window.__foWorldLg && window.__foWorldLg.get(r.id); } catch (eSv) {}
        if (sv && sv.table && sv.table.length && (sv.seasonNo || season) === season) {
          nm = sv.table[0] && sv.table[0].name;
          slot = sv.table[0] && sv.table[0].slot;
          provisional = (sv.roundsPlayed | 0) < (sv.rounds || pl.ROUNDS);
        } else {
          try { if (window.__foWorldLg) window.__foWorldLg.want(r.id, function () { if ((location.hash || "").split("?")[0] === "#/champions" && window.foRenderChampionsPage) window.foRenderChampionsPage(); }); } catch (eW) {}
          var rd = pl.roundsDone(now, season, r.id);
          var t = pl.tableOf(r.id, season, rd);
          nm = t[0] && t[0].side.name;
          slot = t[0] && t[0].side && t[0].side.slot != null ? t[0].side.slot : null;
          provisional = rd < pl.ROUNDS;
        }
      }
      if (!nm) return;
      // seeding: a stable per-season shuffle, the same law as the World Cup draw
      var seedv = rnd01("cl|" + season + "|" + r.id);
      out.push({ rid: r.id, nat: r.nm, name: nm, mine: mine, provisional: provisional, slot: slot,
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
    // A FIELD IS WHATEVER HAS QUALIFIED SO FAR. Nineteen leagues do not crown
    // their champions at the same moment, so on any day before the last of
    // them finishes this list is short - and slice(0, e.length - 6) on a field
    // of four both invents play-ins that cannot be played and silently drops
    // two of the four sides.
    var byes, piField;
    if (e.length >= 6) { byes = e.slice(0, e.length - 6); piField = e.slice(e.length - 6); }
    else { byes = e.slice(); piField = []; }
    var stages = {};
    stages.pi = piField.length >= 6 ? [0, 1, 2].map(function (i) {
      return playTie(season, "pi", i, piField[i], piField[5 - i]);
    }) : [];
    var field = byes.concat(stages.pi.map(function (m) { return m.winner; }));
    field.sort(function (a, b) { return a.seed - b.seed; });
    var cur = [];
    for (var i = 0; i < field.length / 2; i++) cur.push([field[i], field[field.length - 1 - i]]);
    // ...AND A ROUND PAIRS WHAT IT HAS. This walked the four stages pairing
    // next[j] with next[j+1] whether or not next[j+1] existed, so the moment
    // the field was not sixteen a side was played against `undefined` and the
    // page died reading its strength. An odd side gets a bye instead, and a
    // lone survivor is simply the champion.
    var lastStanding = null;
    ["r16", "qf", "sf", "final"].forEach(function (st) {
      var out = [], next = [];
      cur.forEach(function (pair, gi) {
        var A = pair[0], B = pair[1];
        if (!A && !B) return;
        if (!A || !B) { next.push(A || B); return; }        // a bye into the next round
        var m = playTie(season, st, gi, A, B);
        out.push(m); next.push(m.winner);
      });
      stages[st] = out;
      if (next.length === 1) lastStanding = next[0];
      cur = []; for (var j = 0; j < next.length; j += 2) cur.push([next[j], next[j + 1] || null]);
    });
    stages.champion = (stages.final[0] && stages.final[0].winner) || lastStanding;
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
  window.foRenderChampionsPage = function () {
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foClCss();
    var pl = P(), now = Date.now(), p = pl.phaseOf(now);
    var season = p.season, done = stagesDone(now, season);
    var e = entrants(season), br = bracket(season);
    var my = e.filter(function (x) { return x.mine; })[0] || null;
    var eng = e.filter(function (x) { return x.rid === myNation(); })[0] || null;

    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var when = function (st) { var d = new Date(stageTime(season, st)); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " · " + HOURS[st] + ":00 UTC"; };

    // status line: the race, the countdown, the rounds, or the crown
    var status, chip;
    if (p.di < 18) { status = ""; chip = "THE RACE IS ON"; }
    else if (done === 0) { status = "The nineteen are known. The play-ins open the cup at " + when("pi") + "."; chip = "THE DRAW IS MADE"; }
    else if (done < 5) { var nxt = ORDER[done]; status = STAGE_NM[nxt] + " " + (done === 4 ? "crowns the champion" : "come next") + " · " + when(nxt) + "."; chip = "CUP IN PROGRESS"; }
    else { status = (br && br.champion ? br.champion.name + " are champions of the world's clubs." : "The cup is decided."); chip = "CHAMPIONS CROWNED"; }

    // the entrants: nineteen champions, seeded, yours in gold
    var provisional = p.di < 18;
    // every club named here is a door to its own page
    var teamA = function (x, inner) {
      return x.slot != null
        ? "<a class='fo-cl-tl' href='#/team?c=" + encodeURIComponent(x.rid) + "&s=" + (x.slot | 0) + "'>" + inner + "</a>"
        : inner;
    };
    var entRows = e.map(function (x) {
      return "<div class='fo-cl-ent" + (x.mine ? " mine" : "") + "'>" +
        "<i>" + x.seed + "</i>" +
        "<img src='" + flagOf(x.rid) + "' alt='' onerror=\"this.style.display='none'\">" +
        "<b>" + teamA(x, E(x.name)) + (x.mine ? " <u>YOU</u>" : "") + "</b>" +
        "<span" + (x.provisional ? " class='prov'" : "") + ">" + E(x.nat) + "</span></div>";
    }).join("");

    // the bracket: only stages whose windows have CLOSED show results
    var tieHTML = function (m) {
      return "<div class='fo-cl-tie" + ((m.a.mine || m.b.mine) ? " mine" : "") + "'>" +
        "<div class='s" + (m.winner === m.a ? " won" : "") + "'><b>" + teamA(m.a, E(m.a.name)) + "</b><em>" + E(m.hs) + "</em></div>" +
        "<div class='s" + (m.winner === m.b ? " won" : "") + "'><b>" + teamA(m.b, E(m.b.name)) + "</b><em>" + E(m.as) + "</em></div>" +
        "</div>";
    };
    var bracketHTML = "";
    if (br && done > 0) {
      bracketHTML = ORDER.slice(0, done).map(function (st) {
        var ms = br[st]; if (!ms || !ms.length) return "";
        return "<div class='fo-cl-stage'><h3>" + STAGE_NM[st] + " <span>" + when(st) + "</span></h3>" +
          ms.map(tieHTML).join("") + "</div>";
      }).join("");
    }
    var champHTML = "";
    if (done >= 5 && br && br.champion) {
      champHTML = "<div class='fo-cl-crown" + (br.champion.mine ? " mine" : "") + "'>" +
        "<i>&#127942;</i><b>" + E(br.champion.name) + "</b><span>Champions of the world's clubs · season " + (window.foSeasonN ? foSeasonN(season) : season) + "</span>" +
        (br.champion.mine ? "<em>YOUR club. The whole planet watched.</em>" : "") + "</div>";
    }

    var myLine = my
      ? (provisional ? "You lead England - hold the top and the cup is yours to enter." : "Your club carries England's flag into the cup.")
      : "";

    page.innerHTML = "<div class='fo-cl'><div class='fo-cl-in'>" +
      "<div class='fo-cl-hero'>" +
      "<div class='fo-cl-k'>World cricket &middot; season " + (window.foSeasonN ? foSeasonN(season) : season) + " &middot; the clubs' crown</div>" +
      "<h1>The Champions Cup</h1>" +
      (status ? "<p>" + E(status) + "</p>" : "") +
      "<span class='fo-cl-chip'>" + chip + "</span>" +
      (myLine ? "<div class='fo-cl-my'>" + myLine + "</div>" : "") +
      "</div>" +
      champHTML +
      bracketHTML +
      "<div class='fo-cl-sec'><h3>The nineteen" + (provisional ? " <span>as the tables stand</span>" : " <span>champions all</span>") + "</h3>" + entRows + "</div>" +
      "<div class='fo-cl-sched'><h3>The road</h3>" + ORDER.map(function (st, i) {
        return "<div class='fo-cl-schrow" + (done > i ? " done" : done === i ? " next" : "") + "'><b>" + STAGE_NM[st] + "</b><span>" + when(st) + "</span></div>";
      }).join("") + "</div>" +
      "<div class='fo-cl-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/league'>My league &rsaquo;</a><a href='#/almanack'>The almanack &rsaquo;</a></div>" +
      "</div></div>";
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

  function foClCss() {
    if (document.getElementById("fo-cl-css")) return;
    var s = document.createElement("style"); s.id = "fo-cl-css";
    s.textContent = [
      "html body #page .fo-cl{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#1B2432}",
      "html body #page .fo-cl-hero{background:linear-gradient(150deg,#0B1D3A,#07162E 70%) !important;border-radius:22px;padding:26px 28px 24px;color:#FFFEFC;box-shadow:0 22px 50px rgba(7,22,46,.35);border-bottom:3px solid #E8B96A}",
      "html body #page .fo-cl-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-cl-hero h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:36px;letter-spacing:-.015em;margin:8px 0;color:#FFFEFC;line-height:1.02}",
      "html body #page .fo-cl-hero p{font:420 13.5px/1.6 Fraunces,Georgia,serif;color:rgba(255,254,252,.78);margin:0 0 12px;max-width:52ch}",
      "html body #page .fo-cl-chip{display:inline-block;font:700 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;border-radius:999px;padding:7px 13px;background:rgba(232,185,106,.16);color:#E8B96A}",
      "html body #page .fo-cl-my{margin-top:12px;font:400 12.5px/1.5 Fraunces,Georgia,serif;color:#E8B96A;border-top:1px solid rgba(232,185,106,.25);padding-top:10px}",
      "html body #page .fo-cl-crown{margin-top:16px;background:linear-gradient(150deg,#FFF8E8,#F6ECD2);border:1px solid rgba(200,154,46,.5);border-radius:18px;padding:20px 22px;text-align:center;box-shadow:0 16px 38px rgba(140,105,30,.18)}",
      "html body #page .fo-cl-crown i{font-style:normal;font-size:30px;display:block}",
      "html body #page .fo-cl-crown b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:24px;margin-top:6px;color:#1A2130}",
      "html body #page .fo-cl-crown span{display:block;font:400 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin-top:4px}",
      "html body #page .fo-cl-crown em{display:block;font:700 11px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#B44A22;margin-top:10px}",
      "html body #page .fo-cl-stage{margin-top:16px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 16px}",
      "html body #page .fo-cl-stage h3,html body #page .fo-cl-sec h3,html body #page .fo-cl-sched h3{margin:0 0 10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8A6A1F;display:flex;justify-content:space-between;align-items:baseline}",
      "html body #page .fo-cl-stage h3 span,html body #page .fo-cl-sec h3 span{font-size:10px;color:rgba(20,28,40,.45);letter-spacing:.12em}",
      "html body #page .fo-cl-tie{border:1px solid rgba(20,28,40,.09);border-radius:11px;padding:8px 11px;margin-bottom:8px}",
      "html body #page .fo-cl-tie.mine{border-color:rgba(200,154,46,.55);background:rgba(200,154,46,.05)}",
      "html body #page .fo-cl-tie .s{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:12.5px;color:rgba(20,28,40,.55)}",
      "html body #page .fo-cl-tie .s.won{color:#1B2432;font-weight:600}",
      "html body #page .fo-cl-tie .s em{font-style:normal;font-variant-numeric:tabular-nums}",
      "html body #page .fo-cl-tie .s.won em{color:#8A6A1F}",
      "html body #page .fo-cl-sec,html body #page .fo-cl-sched{margin-top:16px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 16px}",
      "html body #page .fo-cl-ent{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(20,28,40,.05)}",
      "html body #page .fo-cl-ent:last-child{border-bottom:none}",
      "html body #page .fo-cl-ent i{font-style:normal;font-size:10.5px;color:rgba(20,28,40,.4);width:18px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-cl-ent img{width:24px;height:17px;object-fit:cover;border-radius:3px}",
      "html body #page .fo-cl-ent b{font:600 13px/1.3 Oswald,sans-serif;flex:1;min-width:0}",
      "html body #page .fo-cl-ent b u{text-decoration:none;font:800 11px/1 Oswald,sans-serif;color:#B44A22;letter-spacing:.14em;margin-left:5px;vertical-align:1px}",
      "html body #page a.fo-cl-tl{color:inherit;text-decoration:none}",
      "html body #page a.fo-cl-tl:hover{color:#B44A22;text-decoration:underline}",
      "html body #page .fo-cl-ent span{font-size:10.5px;color:rgba(20,28,40,.5);white-space:nowrap}",
      "html body #page .fo-cl-ent span.prov{font-style:italic;color:rgba(20,28,40,.34)}",
      "html body #page .fo-cl-ent.mine{background:rgba(200,154,46,.07);border-radius:8px;padding-left:6px;padding-right:6px}",
      "html body #page .fo-cl-schrow{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(20,28,40,.05);font-size:12.5px}",
      "html body #page .fo-cl-schrow:last-child{border-bottom:none}",
      "html body #page .fo-cl-schrow b{font-weight:600;color:rgba(20,28,40,.75)}",
      "html body #page .fo-cl-schrow span{color:rgba(20,28,40,.5);font-variant-numeric:tabular-nums}",
      "html body #page .fo-cl-schrow.done b{color:rgba(20,28,40,.4);text-decoration:line-through}",
      "html body #page .fo-cl-schrow.next b{color:#B44A22}",
      "html body #page .fo-cl-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
      "html body #page .fo-cl-foot a{font:600 13px/1 Oswald,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
      "html body #page .fo-cl-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5)}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();

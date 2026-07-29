/* ============================================================================
   DEVELOPMENT (#/growth) — the room where a squad stops being a list.

   The whole appeal of this game is meant to be that you BUILD something: a
   boy you blooded at nineteen who is the best player in the league at
   twenty-six, a side that gets stronger for four seasons and then has to be
   rebuilt. None of that was visible. Ratings changed silently overnight, no
   one ever got old, and a manager had no reason to prefer one nineteen-year
   -old to another.

   This room answers the four questions that make a squad a project:

     * how good could he become, and how far along is he
     * what is this season doing to him - and to the side as a whole
     * what has he actually DONE, season by season
     * who has to be talked to before the close-season takes him away

   It computes nothing itself. Every figure comes from FO_LIVE (module 70),
   which is pure and deterministic, so this page, the umpire's close-season
   step and a manager on another phone all read the same career. What this
   file owns is the SENTENCE - the one line at the top that says what kind of
   squad this is right now - and the order the evidence is presented in.

   The season line is honest about what it is: while a season is running these
   are projections, and the page says so. It becomes the end-of-season report
   the moment the last round is played, without changing shape, because a
   manager should recognise the room he has been reading all year.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foGrow) return; window.__foGrow = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function on() { return (location.hash || "").split("?")[0] === "#/growth"; }
  function A() { return window.AL || null; }
  function L() { return window.FO_LIVE || null; }
  function seasonNo() { try { return (App && App.seasonNo) || 1; } catch (e) { return 1; } }
  function squad() {
    try { var t = userTeam() || {}; return (t.players || []).slice(); } catch (e) { return []; }
  }
  function colts() {
    try { var t = userTeam() || {}; return (t.youth || []).slice(); } catch (e) { return []; }
  }
  function num(n) { return (Number(n) || 0).toLocaleString(); }
  function signed(n) { var v = Math.round((Number(n) || 0) * 10) / 10; return (v > 0 ? "+" : "") + v.toFixed(1); }

  var TAB = "squad";
  var REP = null;                  // the report the page is currently showing

  // ---- WHAT HE HAS ACTUALLY DONE ------------------------------------------
  // App.playerHist is the game's own per-innings record. Folded by season it
  // becomes the thing the manager asked for: a career you can point at.
  function careerRows(name) {
    var by = {}, H = [];
    try { H = (App.playerHist || {})[name] || []; } catch (e) {}
    for (var i = 0; i < H.length; i++) {
      var e = H[i]; if (!e || e.fr) continue;                 // league cricket only
      var s = e.s | 0;
      var a = by[s] || (by[s] = { s: s, m: 0, inns: 0, runs: 0, balls: 0, outs: 0, hs: 0, w: 0, cr: 0, cb: 0 });
      a.m++;
      if ((e.bb || 0) > 0 || e.o) {
        a.inns++; a.runs += e.rr || 0; a.balls += e.bb || 0; a.outs += e.o ? 1 : 0;
        if ((e.rr || 0) > a.hs) a.hs = e.rr || 0;
      }
      if ((e.cb || 0) > 0) { a.w += e.w || 0; a.cr += e.cr || 0; a.cb += e.cb || 0; }
    }
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (x, y) { return x.s - y.s; });
  }
  function playedThisSeason(name) {
    var rows = careerRows(name), sN = seasonNo();
    for (var i = 0; i < rows.length; i++) if (rows[i].s === sN) return rows[i].m;
    return 0;
  }
  // HOW HARD HE WAS WORKED, as a share of the man who played most. A season's
  // growth is banked by playing, so a reserve who never got on improves less -
  // which is the whole reason selection matters beyond the next result.
  function minutes(list) {
    var top = 0, raw = {};
    list.forEach(function (p) { var n = playedThisSeason(p.name); raw[p.name] = n; if (n > top) top = n; });
    var out = {};
    list.forEach(function (p) { out[p.name] = top > 0 ? raw[p.name] / top : 0.7; });
    out.__top = top;
    return out;
  }

  // ---- THE SENTENCE --------------------------------------------------------
  function verdict(rep) {
    var rise = rep.rising.length, fall = rep.falling.length;
    var ages = rep.rows.map(function (r) { return r.age; });
    var avg = ages.length ? ages.reduce(function (a, b) { return a + b; }, 0) / ages.length : 0;
    var shape = avg <= 24.5 ? "a young side" : avg >= 29 ? "an old side" : "a side in its prime";
    var head, note;
    if (rise > fall + 1) { head = "You are building " + shape; note = rise + (rise === 1 ? " man is" : " men are") + " still improving; " + (fall ? fall + " going the other way" : "nobody is falling away yet"); }
    else if (fall > rise) { head = "This squad is ageing out"; note = fall + (fall === 1 ? " man is" : " men are") + " past their best and " + (rise ? "only " + rise + " still improving" : "none are still improving"); }
    else { head = "A settled squad, " + shape; note = rise + " improving, " + fall + " declining · average age " + avg.toFixed(1); }
    if (rep.atRisk.length) note += " · " + rep.atRisk.length + " to talk to before the close-season";
    return { title: head, note: note, top: rise > fall };
  }

  // ---- ROWS ----------------------------------------------------------------
  function prow(r, extra) {
    var al = A(), p = r.p;
    var note = E(al.role(p)) + " · " + r.age +
      (r.traits.length ? " · " + E(r.traits[0].nm) : "") +
      (extra ? " · " + E(extra) : "");
    return '<button class="al-prow al-prow--face' + (r.contract.risk >= 0.35 ? " al-prow--risk" : "") +
      '" data-al-g="' + E(r.name) + '">' +
      '<span class="al-prow__no">' + r.age + "</span>" +
      al.face(p) +
      '<span class="al-prow__who"><b>' + E(r.name) + "</b><i>" + note + "</i>" +
      (r.room > 0 ? al.meter(r.pct, "warm") : "") + "</span>" +
      '<span class="al-prow__rate">' + r.ovr +
      (r.room > 0 ? '<em class="al-prow__ceil">' + r.ceiling + "</em>" : "") + "</span>" +
      "</button>";
  }
  function list(rows, extra) {
    if (!rows.length) return "";
    return '<div class="al-players">' + rows.map(function (r) { return prow(r, extra && extra(r)); }).join("") + "</div>";
  }

  // ---- THE FOUR VIEWS ------------------------------------------------------
  function viewSquad(rep) {
    var al = A();
    // ordered by how much of himself is still ahead of him: the prospects
    // first, the finished articles last. That is the order a manager plans in.
    var rows = rep.rows.slice().sort(function (a, b) { return b.room - a.room || b.ovr - a.ovr; });
    return al.sec("Every man, and how far along he is", list(rows, function (r) { return r.word; }) ||
      al.empty("No squad yet", "Sign a side and this page fills itself in."));
  }
  function viewSeason(rep, top) {
    var al = A(), out = "";
    var line = top > 0
      ? "Projected from this season's cricket · " + top + (top === 1 ? " round" : " rounds") + " played"
      : "Projected from a full season's cricket · nothing played yet";
    out += al.sec("Coming on", rep.rising.length
      ? list(rep.rising, function (r) { return signed(r.swing) + " this season"; })
      : al.empty("Nobody is improving", "Every man here is at or past his ceiling. That is what the academy is for."),
      null);
    out += al.sec("Going the other way", rep.falling.length
      ? list(rep.falling, function (r) { return signed(r.swing) + " this season"; })
      : al.empty("Nobody is falling away", "No one in this squad is old enough to be declining."));
    out += "<p class='al-read'>&#9679; " + E(line) + "</p>";
    return out;
  }
  function viewFuture(rep) {
    var al = A(), out = "";
    out += al.sec("Ready now", rep.ready.length
      ? list(rep.ready, function (r) { return "at " + r.pct + "% of himself"; })
      : al.empty("Nobody has arrived yet", "A man is ready when he is within a whisker of his ceiling and still under 28."));
    out += al.sec("Near the end", rep.finished.length
      ? list(rep.finished, function (r) {
          return r.retireRisk >= 0.5 ? "likely to retire" : "may retire";
        })
      : al.empty("No one is close to retiring", "Nobody in this squad is over 31."));
    return out;
  }
  function viewDeals(rep) {
    var al = A(), out = "";
    out += al.sec("Talk to these men", rep.atRisk.length
      ? list(rep.atRisk, function (r) { return r.contract.word + " · " + r.contract.mood; })
      : al.empty("Nobody is unsettled", "Every contract here is long enough and paid enough."));
    var gap = rep.asks - rep.wages;
    out += al.sec("The wage bill", al.ledger([
      ["Paid now", "$" + num(rep.wages) + " a round"],
      ["What they are worth", "$" + num(rep.asks) + " a round"],
      [gap > 0 ? "Short by" : "Room to spare", "$" + num(Math.abs(gap)), gap > 0 ? "warn" : "pos"],
      ["Out of contract", String(rep.rows.filter(function (r) { return r.contract.expiring; }).length) + " players"],
    ]));
    return out;
  }

  // ---- ONE MAN'S CAREER ----------------------------------------------------
  function sheet(name) {
    var al = A(), rep = REP; if (!al || !rep) return;
    var r = null;
    for (var i = 0; i < rep.rows.length; i++) if (rep.rows[i].name === name) r = rep.rows[i];
    if (!r) return;
    var p = r.p, seasons = careerRows(name);
    var body = "";
    var face = al.faceSrc(p);
    if (face) body += '<img class="al-sheet__face" src="' + face + '" alt="" onerror="this.style.display=\'none\'">';
    body += al.ledger([
      ["Age", String(r.age)],
      ["Overall", String(r.ovr)],
      ["Ceiling", r.room > 0 ? String(r.ceiling) : "reached"],
      ["How far along", r.pct + "% · " + r.word],
      ["This season", signed(r.swing)],
      ["Contract", r.contract.word],
      ["Wage", "$" + num(r.contract.wage) + " a round"],
      ["He is asking", "$" + num(r.contract.ask), r.contract.ask > r.contract.wage ? "warn" : ""],
      ["Mood", r.contract.mood, r.contract.risk >= 0.35 ? "warn" : ""],
    ]);
    if (r.room > 0) body += al.meter(r.pct, "warm");

    // THE CAREER. Not a total - a row per season, because the point is the
    // shape of it: what he was doing at 19 against what he is doing now.
    if (seasons.length) {
      body += "<h3 class='al-sub'>Season by season</h3>";
      body += "<div class='al-tblwrap'><table class='al-tbl'><thead><tr>" +
        "<th class='l'>Season</th><th>M</th><th>Runs</th><th class='al-s'>HS</th>" +
        "<th class='al-s'>Ave</th><th>Wkts</th></tr></thead><tbody>" +
        seasons.map(function (s) {
          var ave = s.outs > 0 ? (s.runs / s.outs).toFixed(1) : (s.runs ? s.runs + "*" : "—");
          return "<tr><td class='l'>" + s.s + "</td><td>" + s.m + "</td><td>" + s.runs + "</td>" +
            "<td class='al-s'>" + (s.hs || "—") + "</td><td class='al-s'>" + ave + "</td>" +
            "<td>" + (s.w || 0) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    } else {
      body += "<h3 class='al-sub'>Season by season</h3>" +
        "<p class='al-read'>&#9679; he has not played a league match yet</p>";
    }
    if (r.traits.length) {
      body += "<h3 class='al-sub'>The kind of cricketer he is</h3>" +
        '<div class="al-plaques">' + r.traits.map(function (t) {
          return '<div class="al-plaque"><b>' + E(t.nm) + "</b><i>" + E(t.why) + "</i></div>";
        }).join("") + "</div>";
    }

    var el = document.createElement("div");
    el.className = "al-sheet";
    el.innerHTML = '<div class="al-sheet__panel">' +
      '<div class="al-sheet__grip"><b>' + E(name) + "</b>" +
      '<button class="al-btn" data-al-close>Close</button></div>' +
      '<div class="al-sheet__body">' + body + "</div></div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (ev) {
      if (ev.target === el || (ev.target.closest && ev.target.closest("[data-al-close]"))) el.remove();
    });
  }

  // ---- the room ------------------------------------------------------------
  window.foRenderGrowthPage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var live = L();
    var body = al.head("The Team · development", "Development",
      "How good they could become, and what this season is doing to them.", "#/growth");
    body += al.subnav("growth");

    if (!live) {
      page.innerHTML = al.page({ body: body + al.empty("Not available",
        "The development rules did not load. Reload the page and it will be here.") });
      return;
    }
    var men = squad().concat(colts());
    if (!men.length) {
      page.innerHTML = al.page({ body: body + al.empty("No squad yet",
        "Once you have a side, this room follows every man in it from his first season to his last.") });
      return;
    }

    var mins = minutes(men), top = mins.__top | 0;
    var rep = REP = live.clubReport(men, seasonNo(), mins);
    var v = verdict(rep);
    body += al.decide({ kind: v.top ? "done" : "", title: v.title, note: v.note });
    body += al.tabs([
      { id: "squad", label: "The squad", count: rep.rows.length },
      { id: "season", label: "This season", count: rep.rising.length + rep.falling.length },
      { id: "future", label: "The future", count: rep.ready.length + rep.finished.length },
      { id: "deals", label: "Contracts", count: rep.atRisk.length },
    ], TAB);
    body += TAB === "season" ? viewSeason(rep, top)
      : TAB === "future" ? viewFuture(rep)
      : TAB === "deals" ? viewDeals(rep)
      : viewSquad(rep);

    page.innerHTML = al.page({ body: body });
    wire(page);
  };

  // one listener for the life of the page element, not one per repaint
  function wire(host) {
    if (!host || host.__alGW) return;
    host.__alGW = 1;
    host.addEventListener("click", function (ev) {
      if (!on()) return;
      var t = ev.target.closest ? ev.target.closest("[data-al-tab]") : null;
      if (t) { TAB = t.getAttribute("data-al-tab"); window.foRenderGrowthPage(); return; }
      var n = ev.target.closest ? ev.target.closest("[data-al-g]") : null;
      if (n) sheet(n.getAttribute("data-al-g"));
    });
  }
})();

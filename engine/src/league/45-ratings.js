/* ============================================================================
   MATCH RATINGS — the card read as a coach reads it.

   Every scorecard in the game now carries a ratings panel: each side's top
   order, middle, tail, seam, spin and hands, out of ten, plus the day's
   fantasy points. Both are derived from the innings and nothing else, so a
   result from any season - league, cup, invitational, friendly - can be
   marked without anybody having stored a mark.

   And the points are not decoration. They are the SAME points the World
   Service scores a man's FORM on (server/ratings.mjs is a port of
   window.foFantasyPoints, and the tests hold the two to one answer). So when
   a manager reads that his opener had a poor day, he is reading the reason
   the opener's form dropped - not a second opinion about it.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foRat) return; window.__foRat = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var clamp10 = function (v) { return Math.max(0, Math.min(10, +v.toFixed(1))); };

  // THE UNITS. Mirrors server/ratings.mjs line for line.
  window.foUnitRatings = function (inn) {
    if (!inn) return null;
    var bat = (inn.bat || []).filter(function (b) { return b && (b.b > 0 || b.out); });
    var sum = function (xs, f) { return xs.reduce(function (s, x) { return s + (f(x) || 0); }, 0); };
    var batUnit = function (xs, par) {
      if (!xs.length) return null;
      var runs = sum(xs, function (x) { return x.r; }), balls = sum(xs, function (x) { return x.b; });
      var sr = balls ? 100 * runs / balls : 0;
      return clamp10(3 + 6 * Math.min(1.6, runs / par) + (sr >= 100 ? 1 : sr >= 85 ? 0.5 : sr < 60 ? -1 : 0));
    };
    var bowlUnit = function (list) {
      if (!list.length) return null;
      var w = sum(list, function (x) { return x.w; }), balls = sum(list, function (x) { return x.b; }),
          conc = sum(list, function (x) { return x.r; });
      if (balls < 12) return null;
      var ov = balls / 6, ec = conc / ov, per10 = w / (ov / 10);
      return clamp10(3.2 + 1.9 * Math.min(3, per10) + (ec <= 4 ? 1.8 : ec <= 5 ? 1 : ec <= 6 ? 0 : ec <= 7 ? -1 : -2.2));
    };
    var bowlers = Object.keys(inn.bowlers || {}).map(function (k) {
      var o = {}; for (var p in inn.bowlers[k]) o[p] = inn.bowlers[k][p]; o.name = k; return o;
    });
    var isSpin = function (b) {
      var t = String((b.p && (b.p.bowlTypeFull || b.p.bowlType)) || "").toLowerCase();
      return /spin|orthodox|legbreak|offbreak|wrist|finger/.test(t);
    };
    var fld = inn.fielding || {}, ks = Object.keys(fld);
    var g = function (k) { return ks.reduce(function (s, n) { return s + (fld[n][k] || 0); }, 0); };
    var ct = g("ct"), st = g("st"), ro = g("ro");
    var units = {
      top: batUnit(bat.slice(0, 3), 110), middle: batUnit(bat.slice(3, 6), 110), tail: batUnit(bat.slice(6), 45),
      seam: bowlUnit(bowlers.filter(function (b) { return !isSpin(b); })),
      spin: bowlUnit(bowlers.filter(isSpin)),
      // the hands are marked on CHANCES, not on a count
      field: (function () {
        var outs = inn.wkts || 0, held = ct + st + ro;
        return clamp10(3.6 + 5.6 * (outs ? Math.min(1, held / outs) : 0) + 0.6 * st + 0.7 * ro);
      })()
    };
    var got = Object.keys(units).filter(function (k) { return units[k] != null; });
    units.overall = got.length ? clamp10(got.reduce(function (s, k) { return s + units[k]; }, 0) / got.length) : null;
    return units;
  };

  window.foMatchRatings = function (innings) {
    var by = {}, at = function (nm) { return by[nm] || (by[nm] = { club: nm }); };
    var inns = (innings || []).filter(Boolean);
    // WHO WAS BOWLING IS NOT A SEPARATE FACT. A banked friendly card names
    // only the batting side of each innings, and keying an object on the
    // missing bowler minted a club called "undefined" with its own ratings
    // column. The bowling side of one innings IS the batting side of the
    // other, so it is read from there before falling back to the card's word.
    var batName = function (i9) { var x = inns[i9]; return x && x.batTeam && x.batTeam !== "undefined" ? x.batTeam : null; };
    inns.forEach(function (inn, ix) {
      var u = window.foUnitRatings(inn); if (!u) return;
      var bNm = inn.batTeam && inn.batTeam !== "undefined" ? inn.batTeam : null;
      var oNm = inn.bowlTeam && inn.bowlTeam !== "undefined" ? inn.bowlTeam : batName(1 - ix);
      if (bNm) { var b = at(bNm); b.top = u.top; b.middle = u.middle; b.tail = u.tail; }
      if (oNm) { var o = at(oNm); o.seam = u.seam; o.spin = u.spin; o.field = u.field; }
    });
    Object.keys(by).forEach(function (nm) {
      var x = by[nm], got = ["top", "middle", "tail", "seam", "spin", "field"].filter(function (k) { return x[k] != null; });
      x.overall = got.length ? clamp10(got.reduce(function (s, k) { return s + x[k]; }, 0) / got.length) : null;
    });
    return by;
  };

  // THE MATCH RATING THE GAME ALREADY WRITES, as one figure per side.
  //
  // Nothing here recomputes anything: window.teamRatings is the engine's own
  // marking, the same call the Match ratings tab makes, already wearing the
  // overlay that refuses to mark the hands of a side that never fielded. All
  // this does is take the units BOTH sides used - the like-with-like rule the
  // ratings table applies before it prints a total - and AVERAGE them instead
  // of adding them.
  //
  // Adding is right inside one match: two columns, side by side, bigger total
  // won the argument. Averaging is what makes the figure carry OUT of the match,
  // because a sum over four units and a sum over six are not the same quantity,
  // and the world rankings are nothing but a comparison across matches. The
  // number is on the club rating scale: about 3,500 is an ordinary day.
  window.FO_RATING_UNITS = ["Batting - Top Order", "Batting - Middle Order", "Batting - Tail",
    "Bowling - Seam", "Bowling - Spin", "Fielding/Keeping"];
  window.foTeamMatchRating = function (result) {
    var out = {};
    try {
      if (typeof window.teamRatings !== "function") return out;
      var innings = ((result && (result.innings || result.scorecard)) || []).filter(Boolean);
      var names = [];
      innings.forEach(function (inn) {
        // a banked card can carry the STRING "undefined" where a bowling side
        // was never named - a ghost that walks straight past a falsy check
        // and gets its own ratings column
        [inn.batTeam, inn.bowlTeam].forEach(function (n) {
          if (n && n !== "undefined" && n !== "null" && names.indexOf(n) < 0) names.push(n);
        });
      });
      if (names.length !== 2) return out;
      var card = { innings: innings, home: names[0], away: names[1] };
      var marks = names.map(function (n) {
        var raw = window.teamRatings(card, n), flat = {};
        for (var k in raw) flat[k] = (raw[k] && raw[k].length) ? raw[k][0] : raw[k];
        return flat;
      });
      var shared = window.FO_RATING_UNITS.filter(function (u) {
        return marks.every(function (m) { return m[u] != null; });
      });
      if (!shared.length) return out;
      names.forEach(function (n, i) {
        var m = marks[i];
        out[n] = {
          rating: +(shared.reduce(function (s2, u) { return s2 + m[u]; }, 0) / shared.length).toFixed(1),
          units: m, counted: shared.slice()
        };
      });
    } catch (e) {}
    return out;
  };

  var LABEL = { top: "Top order", middle: "Middle order", tail: "The tail",
    seam: "Seam", spin: "Spin", field: "In the field" };
  var band = function (v) { return v >= 8 ? "hot" : v >= 6.5 ? "good" : v >= 4.5 ? "ok" : "poor"; };
  var word = function (v) {
    return v >= 8.5 ? "outstanding" : v >= 7.5 ? "very good" : v >= 6.5 ? "good"
      : v >= 5.5 ? "adequate" : v >= 4 ? "below par" : "poor";
  };

  // The `result` argument is no longer needed for the mark - the game's own
  // match rating is a function of the innings alone - but it is kept so callers
  // that have the record to hand can pass it, and so the signature does not
  // change under them.
  window.foRatingsPanelHTML = function (innings, result) {
    var sides = window.foMatchRatings(innings);
    var names = Object.keys(sides);
    if (!names.length) return "";
    // the panel carries its own stylesheet wherever it is asked for - it is not
    // only the scorecard's any more, and unstyled marks are worse than none
    try { css(); } catch (eC) {}
    // THE MATCH RATING, the figure the world rankings read. It is the engine's
    // own marking of this very card, so it needs nothing but the innings.
    var team = {};
    try { team = window.foTeamMatchRating({ innings: innings }) || {}; } catch (eT) {}
    var pts = [];
    try { pts = (window.foFantasyPoints && window.foFantasyPoints(innings)) || []; } catch (e) {}
    var side = function (nm) {
      var x = sides[nm];
      var rows = ["top", "middle", "tail", "seam", "spin", "field"].filter(function (k) { return x[k] != null; })
        .map(function (k) {
          return "<div class='fo-rat-r'><span>" + LABEL[k] + "</span>" +
            "<s class='fo-rat-bar'><u class='" + band(x[k]) + "' style='width:" + (x[k] * 10) + "%'></u></s>" +
            "<b class='" + band(x[k]) + "'>" + x[k].toFixed(1) + "</b></div>";
        }).join("");
      var tm = team[nm];
      // the ladder figure, on the club rating scale, with the count of units it
      // was averaged over - because "four of six" is why a figure looks odd
      var mark = tm ? "<div class='fo-rat-tm'><span>Match rating</span><b class='" +
        (tm.rating >= 4200 ? "hot" : tm.rating >= 3700 ? "good" : tm.rating >= 3100 ? "ok" : "poor") + "'>" +
        Math.round(tm.rating).toLocaleString() + "</b></div>" : "";
      return "<div class='fo-rat-side'><div class='fo-rat-h'><b>" + E(nm) + "</b>" +
        (x.overall != null ? "<em class='" + band(x.overall) + "'>" + x.overall.toFixed(1) + "</em>" : "") + "</div>" +
        mark + rows + (x.overall != null ? "<div class='fo-rat-w'>" + word(x.overall) + " all round</div>" : "") + "</div>";
    };
    var best = pts.slice(0, 5).map(function (p, i) {
      return "<div class='fo-rat-p'><i>" + (i + 1) + "</i><b>" + E(p.n) + "</b><span>" + E(p.team) + "</span>" +
        "<u>" + p.pts + "</u></div>";
    }).join("");
    return "<div class='panel fo-rat'><h4>Match ratings</h4><div class='pad'>" +
      "<div class='fo-rat-grid'>" + names.map(side).join("") + "</div>" +
      (best ? "<div class='fo-rat-sub'>The day&rsquo;s points</div>" + best : "") +
      "</div></div>";
  };

  function css() {
    if (document.getElementById("fo-rat-css")) return;
    var s = document.createElement("style"); s.id = "fo-rat-css";
    s.textContent = [
      ".fo-rat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}",
      ".fo-rat-side{min-width:0}",
      // the mark that goes to the world, sat above the unit marks it is built from
      "html body #page .fo-rat-tm{border:1px solid rgba(12,27,51,.14);border-radius:10px;padding:7px 10px;margin-bottom:8px;background:rgba(12,27,51,.03)}",
      "html body #page .fo-rat-tm span{display:block;font:600 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(12,27,51,.5)}",
      "html body #page .fo-rat-tm b{font:700 22px/1.1 Inter,sans-serif;font-variant-numeric:tabular-nums;display:block;margin-top:3px}",
      ".fo-rat-h{display:flex;align-items:baseline;gap:8px;padding-bottom:7px;border-bottom:1px solid rgba(12,27,51,.12);margin-bottom:7px}",
      ".fo-rat-h b{flex:1;min-width:0;font:600 13.5px/1.2 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-rat-h em{font-style:normal;font:700 19px/1 Inter,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-rat-r{display:flex;align-items:center;gap:8px;padding:4px 0;font:500 11.5px/1.3 Inter,sans-serif}",
      ".fo-rat-r span{flex:0 0 84px;color:rgba(12,27,51,.6)}",
      ".fo-rat-bar{flex:1;min-width:40px;height:6px;border-radius:999px;background:rgba(12,27,51,.1);overflow:hidden;text-decoration:none}",
      ".fo-rat-bar u{display:block;height:100%;text-decoration:none;background:#2E8B5E}",
      ".fo-rat-r b{flex:0 0 30px;text-align:right;font:700 12.5px/1 Inter,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-rat .hot{color:#0E6B4C}.fo-rat .good{color:#177A57}.fo-rat .ok{color:#8a6d3b}.fo-rat .poor{color:#B23230}",
      ".fo-rat-bar u.hot{background:#0E6B4C}.fo-rat-bar u.good{background:#2E8B5E}",
      ".fo-rat-bar u.ok{background:#C9A24B}.fo-rat-bar u.poor{background:#B23230}",
      ".fo-rat-w{margin-top:5px;font:400 11.5px/1.4 Fraunces,Georgia,serif;color:rgba(12,27,51,.5)}",
      ".fo-rat-sub{margin:15px 0 5px;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(12,27,51,.4)}",
      ".fo-rat-p{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid rgba(12,27,51,.07);font:500 12px/1.3 Inter,sans-serif}",
      ".fo-rat-p i{font-style:normal;font:700 10px/1 Oswald,sans-serif;color:rgba(12,27,51,.35);width:12px}",
      ".fo-rat-p b{font-weight:600}",
      ".fo-rat-p span{flex:1;min-width:0;font-size:10.5px;color:rgba(12,27,51,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-rat-p u{text-decoration:none;font:700 13px/1 Inter,sans-serif;color:#0C1B33;font-variant-numeric:tabular-nums}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // EVERY SCORECARD GETS ONE. The page is wrapped rather than watched: the
  // innings it was built from are in hand at the moment it paints, which the
  // live match state is not a second later.
  function append(innings, result) {
    try {
      var page = document.getElementById("page"); if (!page) return;
      if (page.querySelector(".fo-rat")) return;
      if (!innings || !innings[1]) return;            // one innings is no match to mark
      css();
      var html = window.foRatingsPanelHTML(innings, result || null);
      if (!html) return;
      var wrap = document.createElement("div");
      wrap.innerHTML = html;
      page.appendChild(wrap.firstChild);
    } catch (e) {}
  }
  function inningsFor(q) {
    try {
      if (q && q.i !== undefined && App.results[+q.i]) return App.results[+q.i].innings;
      if (window.M && M.innings) return M.innings;
      var last = (App.results || [])[(App.results || []).length - 1];
      return last && last.innings;
    } catch (e) { return null; }
  }
  // the same record's result, so the mark can read the margin as well as the units
  function resultFor(q) {
    try {
      if (q && q.i !== undefined && App.results[+q.i]) return App.results[+q.i].result;
      if (window.M && M.result) return M.result;
      var last = (App.results || [])[(App.results || []).length - 1];
      return last && last.result;
    } catch (e) { return null; }
  }
  function hook() {
    if (typeof window.pgScorecard !== "function" || window.pgScorecard.__foRat) return;
    var prev = window.pgScorecard;
    window.pgScorecard = function (q) {
      var out = prev.apply(this, arguments);
      try {
        window.__foRatLast = inningsFor(q); window.__foRatLastRes = resultFor(q);
        append(window.__foRatLast, window.__foRatLastRes);
      } catch (e) {}
      return out;
    };
    window.pgScorecard.__foRat = 1;
  }
  hook();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  // a backstop for the paint that beat the hook: the innings the card was
  // built from are remembered, so a late pass never needs the live match
  setInterval(function () {
    hook();
    try {
      if ((location.hash || "").split("?")[0] !== "#/scorecard") return;
      if (document.querySelector("#page .fo-rat")) return;
      append(window.__foRatLast || inningsFor(null), window.__foRatLastRes || resultFor(null));
    } catch (e) {}
  }, 1200);
})();

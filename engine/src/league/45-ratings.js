/* ============================================================================
   THE TWO SIDES — what each eleven was worth before a ball was bowled.

   This panel used to mark the AFTERNOON: a top order that made four off
   fifteen was a 2.2, however good the three men were. Read beside a headline
   on the club rating scale it said two different things at once, and a manager
   with three internationals at the top of his order was told his top order was
   worth 2.2 out of ten.

   So it marks the SIDE instead. Six departments - the top three, the middle,
   the tail, the seam, the spin and the hands - each the on-paper quality of
   the men who filled it, and above them the eleven's strength on the same
   scale the world rankings and the transfer market are read in. Nothing here
   moves when a catch goes down. What the afternoon was worth is the day's
   points underneath, which is where performance has always belonged.

   The men are the ones who took the field: a banked card seats all eleven in
   its batting order whether they got an innings or not, so the order the
   departments are cut on is the order the captain filed.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foRat) return; window.__foRat = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // WHERE A BATTING ORDER IS CUT. One to three, four to seven, eight down -
  // the way a scorer cuts it, and the way the engine's own club marking
  // (teamRatings in 00-core.js, which the world rankings stand on) cuts it. A
  // number seven is the middle order in both readings or in neither.
  window.FO_BAT_CUT = { top: [0, 3], middle: [3, 7], tail: [7, 11] };
  var ROWS = ["top", "middle", "tail", "seam", "spin", "field"];

  // A MAN'S QUALITY AT ONE JOB, through the engine's own summaries - the same
  // aggBat/aggBowl/aggField/aggKeep the squad room, the scout report and the
  // player page all print, so a batsman cannot be worth 78 on his own page and
  // something else in the eleven he was picked in.
  function agg(p, nm) {
    try {
      var v = ({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField })[nm](p);
      return (typeof v === "number" && isFinite(v)) ? Math.max(0, Math.min(99, Math.round(v))) : null;
    } catch (e) { return null; }
  }
  function mean(xs) {
    var v = xs.filter(function (x) { return x != null; });
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
  }
  // A DEPARTMENT IS PRINTED IN THE SAME LANGUAGE A MAN IS. Nought to ninety-
  // nine, exactly as a player page, a scout report and the squad room print a
  // skill - so a top three of three 55s reads 55, and nobody has to translate
  // between two scales to see whether that is any good. It also puts the old
  // "2.2 out of ten" beyond reach: there is no ten for it to be out of.
  var sk99 = function (v) { return v == null ? null : Math.max(0, Math.min(99, Math.round(v))); };
  // the engine's own two families: fast, fast-medium and medium are seam, the
  // rest turn it
  function isSpin(p) {
    var t = String(p.bowlType || "");
    return !(t === "fast" || t === "fastMedium" || t === "medium");
  }

  // THE ELEVEN, DEPARTMENT BY DEPARTMENT. Six skills off the men who filled
  // each job, plus the side's strength on the club rating scale (mean card
  // rating, which is exactly what the squad-strength figure on the club page
  // and the world rankings are built from).
  window.foXIStrength = function (innings, nm) {
    var inns = (innings || []).filter(Boolean), mine = null;
    for (var i = 0; i < inns.length; i++) if (inns[i] && inns[i].batTeam === nm) { mine = inns[i]; break; }
    if (!mine) return null;
    var xi = (mine.bat || []).map(function (b) { return b && b.p; })
      .filter(function (p) { return p && p.skills; });
    // a card with no men on it - a hand-built fixture, an ancient record - is
    // left unmarked rather than marked wrongly
    if (xi.length < 5) return null;
    var cut = window.FO_BAT_CUT;
    var batOf = function (a, b) {
      return sk99(mean(xi.slice(a, b).map(function (p) { return agg(p, "bat"); })));
    };
    var bowlOf = function (list) {
      return list.length ? sk99(mean(list.map(function (p) { return agg(p, "bowl"); }))) : null;
    };
    var bowlers = xi.filter(function (p) { return p.bowlType; });
    // the hands are the whole eleven's ground fielding with the gloves folded
    // in - one man in four hundred deliveries is the keeper's, and the other
    // ten are everybody's
    var fld = mean(xi.map(function (p) { return agg(p, "field"); }));
    var kp = xi.filter(function (p) { return p.keeper; })[0];
    var kv = kp ? agg(kp, "keep") : null;
    var s = {
      n: xi.length,
      rating: Math.round(mean(xi.map(function (p) { return +p.rating || 0; })) || 0),
      top: batOf(cut.top[0], cut.top[1]),
      middle: batOf(cut.middle[0], cut.middle[1]),
      tail: batOf(cut.tail[0], cut.tail[1]),
      seam: bowlOf(bowlers.filter(function (p) { return !isSpin(p); })),
      spin: bowlOf(bowlers.filter(isSpin)),
      field: sk99(fld == null ? null : (kv == null ? fld : 0.75 * fld + 0.25 * kv))
    };
    return s;
  };

  var LABEL = { top: "Top order", middle: "Middle order", tail: "The tail",
    seam: "Seam", spin: "Spin", field: "In the field" };
  // THE SKILL TONES THE REST OF THE GAME USES, so a department that would be
  // painted red on a player's own page is painted red here. A tail reading
  // low is not a fault in the marking: a tail IS low, and a side whose eight
  // and nine can bat shows it by reading higher than the next side's.
  var band = function (v) { return v >= 75 ? "hot" : v >= 50 ? "good" : v >= 30 ? "ok" : "poor"; };
  // AND THE SIDE'S OWN FIGURE, banded on the printed scale rather than on an
  // average of the six - a top order and a tail are not the same quantity and
  // must not be averaged into one. foRate's own anchors: a club founded this
  // morning reads 10k, an England flagship 60k, a national side 100k.
  var strBand = function (v) { return v >= 60000 ? "hot" : v >= 45000 ? "good" : v >= 25000 ? "ok" : "poor"; };

  // The `result` argument is not needed - a side's strength is a function of
  // the men in it - but it is kept so callers that have the record to hand can
  // pass it, and so the signature does not change under them.
  window.foRatingsPanelHTML = function (innings, result) {
    var inns = (innings || []).filter(Boolean);
    var names = [];
    inns.forEach(function (inn) {
      // a banked card can carry the STRING "undefined" where a bowling side
      // was never named - a ghost that walks straight past a falsy check
      [inn.batTeam, inn.bowlTeam].forEach(function (n) {
        if (n && n !== "undefined" && n !== "null" && names.indexOf(n) < 0) names.push(n);
      });
    });
    if (!names.length) return "";
    // the panel carries its own stylesheet wherever it is asked for - it is not
    // only the scorecard's any more, and unstyled marks are worse than none
    try { css(); } catch (eC) {}
    var sides = [];
    names.forEach(function (n) {
      var s = null;
      try { s = window.foXIStrength(inns, n); } catch (eS) {}
      if (s) sides.push({ nm: n, s: s });
    });
    var pts = [];
    try { pts = (window.foFantasyPoints && window.foFantasyPoints(inns)) || []; } catch (e) {}
    var best = pts.slice(0, 5).map(function (p, i) {
      return "<div class='fo-rat-p'><i>" + (i + 1) + "</i><b>" + E(p.n) + "</b><span>" + E(p.team) + "</span>" +
        "<u>" + p.pts + "</u></div>";
    }).join("");
    if (!sides.length && !best) return "";

    // THE SAME ROWS ON BOTH SIDES. One side with no spinner used to be one row
    // shorter than the other, so every department below it read against the
    // wrong department opposite - which is the one thing two columns side by
    // side exist to make easy. A side that has nobody in a department shows a
    // dash there, which is itself worth knowing.
    var shownRows = ROWS.filter(function (k) {
      return sides.some(function (x) { return x.s[k] != null; });
    });
    var side = function (x) {
      var s = x.s;
      var rows = shownRows.map(function (k) {
        var v = s[k];
        if (v == null) return "<div class='fo-rat-r'><span>" + LABEL[k] + "</span>" +
          "<s class='fo-rat-bar'></s><b class='none'>&ndash;</b></div>";
        return "<div class='fo-rat-r'><span>" + LABEL[k] + "</span>" +
          "<s class='fo-rat-bar'><u class='" + band(v) + "' style='width:" + v + "%'></u></s>" +
          "<b class='" + band(v) + "'>" + v + "</b></div>";
      }).join("");
      // the side's strength, printed through foRate so the whole game reads one
      // scale: the same figure the club page, the dossiers and the world
      // rankings put on a squad
      var str = window.foRate ? window.foRate(s.rating) : s.rating;
      var mark = "<div class='fo-rat-tm'><span>Strength of the XI</span><b class='" + strBand(str) + "'>" +
        str.toLocaleString() + "</b></div>";
      return "<div class='fo-rat-side'><div class='fo-rat-h'><b>" + E(x.nm) + "</b></div>" +
        mark + rows + "</div>";
    };
    return "<div class='panel fo-rat'><h4>The two sides</h4><div class='pad'>" +
      (sides.length ? "<div class='fo-rat-grid'>" + sides.map(side).join("") + "</div>" : "") +
      (best ? "<div class='fo-rat-sub'>The day&rsquo;s points</div>" + best : "") +
      "</div></div>";
  };

  function css() {
    if (document.getElementById("fo-rat-css")) return;
    var s = document.createElement("style"); s.id = "fo-rat-css";
    s.textContent = [
      ".fo-rat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}",
      ".fo-rat-side{min-width:0}",
      // what the eleven is worth, sat above the departments it is made of
      "html body #page .fo-rat-tm{border:1px solid rgba(12,27,51,.14);border-radius:10px;padding:7px 10px;margin-bottom:8px;background:rgba(12,27,51,.03)}",
      "html body #page .fo-rat-tm span{display:block;font:600 11px/1 Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(12,27,51,.5)}",
      "html body #page .fo-rat-tm b{font:700 22px/1.1 Manrope,sans-serif;font-variant-numeric:tabular-nums;display:block;margin-top:3px}",
      ".fo-rat-h{display:flex;align-items:baseline;gap:8px;padding-bottom:7px;border-bottom:1px solid rgba(12,27,51,.12);margin-bottom:7px}",
      ".fo-rat-h b{flex:1;min-width:0;font:600 13.5px/1.2 Manrope,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-rat-r{display:flex;align-items:center;gap:8px;padding:4px 0;font:500 13px/1.3 Manrope,sans-serif}",
      ".fo-rat-r span{flex:0 0 84px;color:rgba(12,27,51,.6)}",
      ".fo-rat-bar{flex:1;min-width:40px;height:6px;border-radius:999px;background:rgba(12,27,51,.1);overflow:hidden;text-decoration:none}",
      ".fo-rat-bar u{display:block;height:100%;text-decoration:none;background:#2E8B5E}",
      ".fo-rat-r b{flex:0 0 30px;text-align:right;font:700 12.5px/1 Manrope,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-rat .hot{color:#0E6B4C}.fo-rat .good{color:#177A57}.fo-rat .ok{color:#8a6d3b}.fo-rat .poor{color:#B23230}",
      ".fo-rat .none{color:rgba(12,27,51,.3)}",
      ".fo-rat-bar u.hot{background:#0E6B4C}.fo-rat-bar u.good{background:#2E8B5E}",
      ".fo-rat-bar u.ok{background:#8F6A1C}.fo-rat-bar u.poor{background:#B23230}",
      ".fo-rat-sub{margin:15px 0 5px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(12,27,51,.4)}",
      ".fo-rat-p{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid rgba(12,27,51,.07);font:500 13px/1.3 Manrope,sans-serif}",
      ".fo-rat-p i{font-style:normal;font:700 11px/1 Manrope,sans-serif;color:rgba(12,27,51,.35);width:12px}",
      ".fo-rat-p b{font-weight:600}",
      ".fo-rat-p span{flex:1;min-width:0;font-size:10.5px;color:rgba(12,27,51,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-rat-p u{text-decoration:none;font:700 13px/1 Manrope,sans-serif;color:#0C1B2E;font-variant-numeric:tabular-nums}"
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
  // the same record's result, so a caller that has it can hand it over
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

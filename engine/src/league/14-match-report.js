// ===========================================================================
// The Fifty Overs Journal — Match Reports
//
// Every finished match already leaves a complete record behind: both innings
// ball by ball, the fall of every wicket with its over, every partnership,
// and a per-over worm. That is enough to do more than tabulate it - it is
// enough to WRITE about it.
//
// This module reads that record, works out what actually decided the match,
// and prints it as a page of the Journal: a headline drawn from the decisive
// fact, a standfirst, four paragraphs of report, the turning point with its
// over number, the man of the match with the reason, and the two innings
// drawn as a worm.
//
// The rule the whole thing is built on: every clause must be traceable to a
// number in the record. No invented drama, no filler, no "cricket is the
// winner". If the match was dull, the report says it was dull.
// ===========================================================================
(function () {
  "use strict";
  var FO_MR_MAXP = 4;
  // Each league file is its own IIFE, so this module carries its own escaping
  // and its own art resolver rather than reaching into a closure it cannot see.
  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var ART = (location.pathname.indexOf("/client/") !== -1) ? "art/"
    : (location.pathname.indexOf("/next/") !== -1 ? "../client/art/" : "client/art/");
  // the ten grounds, painted where the art exists
  var FO_MR_GROUND = {
    "Headingley": "leeds", "The Oval": "london", "Sydney Cricket Ground": "sydney",
    "Eden Park": "auckland", "Basin Reserve": "wellington", "Queen's Park Oval": "port-of-spain",
    "Wankhede Stadium": "mumbai", "M. Chinnaswamy Stadium": "chennai",
    "National Stadium": "lahore", "SuperSport Park": "johannesburg"
  };

  function foMrSurname(n) {
    var p = String(n || "").trim().split(/\s+/);
    return p.length > 1 ? p[p.length - 1] : (p[0] || "");
  }
  function foMrOvers(balls) { balls = balls | 0; return Math.floor(balls / 6) + (balls % 6 ? "." + (balls % 6) : ""); }
  function foMrPlural(n, one, many) { return n === 1 ? one : (many || one + "s"); }
  var FO_MR_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function foMrWord(n) { return FO_MR_WORDS[n] || String(n); }
  function foMrOrd(n) {
    n = n | 0;
    var v = n % 100;
    if (v >= 11 && v <= 13) return n + "th";
    return n + (["th", "st", "nd", "rd"][n % 10] || "th");
  }
  // how a ten-over block actually looked, wickets included - a side 21 for 8
  // was not being "watchful", it was being taken apart
  function foMrPowerplay(ph) {
    if (ph.wkts >= 4) return "already " + foMrWord(ph.wkts) + " down inside ten";
    if (ph.wkts >= 3) return "three down in the first ten";
    if (ph.runs >= 55) return "away quickly through the first ten";
    if (ph.runs <= 32) return "watchfully through the first ten";
    return "steadily through the first ten";
  }

  // ---- what happened, in numbers -------------------------------------------
  function foMrInnsFacts(inn, wormRows) {
    if (!inn) return null;
    var bat = (inn.bat || []).filter(function (b) { return (b.b || 0) > 0 || b.out; });
    var order = bat.slice().sort(function (a, b) { return (b.r || 0) - (a.r || 0); });
    var bowlers = Object.keys(inn.bowlers || {}).map(function (k) { return inn.bowlers[k]; })
      .filter(function (x) { return (x.b || 0) > 0; });
    var best = bowlers.slice().sort(function (a, b) {
      return (b.w - a.w) || (a.r - b.r);
    })[0] || null;
    var fow = (inn.fow || []).slice();

    // the biggest stand of the innings
    var stand = (inn.pships || []).slice().sort(function (a, b) { return b.runs - a.runs; })[0] || null;

    // the worst collapse: the run of wickets that cost the fewest runs.
    // Scored so that "4 for 11" beats "3 for 9" - more wickets matters more
    // than a couple of runs.
    var collapse = null;
    for (var n = 3; n <= 5; n++) {
      for (var i = 0; i + n <= fow.length; i++) {
        var from = i ? fow[i - 1].sc : 0, to = fow[i + n - 1].sc, span = to - from;
        if (span > 34) continue;
        var sev = n / (span + 5);
        if (!collapse || sev > collapse.sev) {
          collapse = { sev: sev, wkts: n, runs: span, at: from, to: to,
            firstOv: fow[i].ov, lastOv: fow[i + n - 1].ov, lastMan: fow[i + n - 1].who };
        }
      }
    }

    // phase scoring, straight off the worm
    var atOver = function (ov) {
      var last = null;
      (wormRows || []).forEach(function (w) { if (w && w[0] <= ov + 0.001) last = w; });
      return last;
    };
    var pp = atOver(10), mid = atOver(40);
    var end = (wormRows && wormRows.length) ? wormRows[wormRows.length - 1] : null;
    var phases = null;
    if (pp && end) {
      phases = {
        pp: { runs: pp[1], wkts: pp[2], rr: pp[0] ? pp[1] / pp[0] : 0 },
        mid: mid ? { runs: mid[1] - pp[1], wkts: mid[2] - pp[2], rr: (mid[0] - pp[0]) ? (mid[1] - pp[1]) / (mid[0] - pp[0]) : 0 } : null,
        death: (mid && end[0] > mid[0]) ? { runs: end[1] - mid[1], wkts: end[2] - mid[2], rr: (end[1] - mid[1]) / (end[0] - mid[0]) } : null
      };
    }

    return {
      team: inn.batTeam, runs: inn.runs || 0, wkts: inn.wkts || 0,
      balls: inn.legal || 0, overs: foMrOvers(inn.legal || 0),
      rr: (inn.legal ? (inn.runs * 6 / inn.legal) : 0),
      allOut: (inn.wkts || 0) >= 10,
      bat: bat, top: order[0] || null, second: order[1] || null,
      bowlers: bowlers, best: best, fow: fow, stand: stand, collapse: collapse,
      phases: phases, extras: inn.extras || { wd: 0, nb: 0, b: 0, lb: 0 },
      fifties: order.filter(function (b) { return (b.r || 0) >= 50; }),
      ducks: bat.filter(function (b) { return b.out && (b.r || 0) === 0; }).length
    };
  }

  function foMrFacts(r) {
    if (!r || !r.innings || !r.innings[0]) return null;
    var w = r.worm || [];
    var a = foMrInnsFacts(r.innings[0], w[0]);
    var b = foMrInnsFacts(r.innings[1], w[1]);
    var res = r.result || {};
    var f = {
      rec: r, ix: r.ix, date: r.date, ground: r.ground, pitch: r.pitch, weather: r.weather,
      comp: r.comp, first: a, second: b, result: res, text: res.text || "",
      winner: res.winner || null, tied: !res.winner
    };
    if (a && b) {
      f.target = a.runs + 1;
      f.chased = b.runs >= f.target;
      f.margin = f.chased ? (10 - b.wkts) : (a.runs - b.runs);
      f.marginUnit = f.chased ? "wickets" : "runs";
      f.ballsLeft = f.chased ? Math.max(0, 300 - b.balls) : 0;
      f.tight = f.chased ? (10 - b.wkts) <= 2 || f.ballsLeft <= 12 : (a.runs - b.runs) <= 12;
      f.loser = f.winner ? (f.winner === a.team ? b.team : a.team) : null;
      f.winFacts = f.winner === a.team ? a : b;
      f.loseFacts = f.winner === a.team ? b : a;
    }
    // the man of the match, and WHY - the engine names him, we explain him
    var mom = res.mom || null;
    if (mom) {
      var find = function (nm) {
        var out = { runs: null, balls: null, w: 0, r: 0, ov: 0, side: null };
        [a, b].forEach(function (side) {
          if (!side) return;
          side.bat.forEach(function (x) { if (x.p && x.p.name === nm) { out.runs = x.r; out.balls = x.b; out.side = side.team; out.f4 = x.f4 || 0; out.f6 = x.f6 || 0; out.notOut = !x.out; } });
          side.bowlers.forEach(function (x) { if (x.p && x.p.name === nm) { out.w = x.w || 0; out.r = x.r || 0; out.ov = x.b || 0; } });
        });
        return out;
      };
      var rawMom = typeof mom === "string" ? mom : (mom.name || String(mom));
      // the engine may append his line to the medal - "Oscar Dawson 6w",
      // "(42 pts)" - and a medal wears a name, not a scorecard
      var momNm = String(rawMom).replace(/\s*\(\s*[\d.]+\s*pts?\s*\)\s*$/i, "").trim();
      while (/\s+\S*\d\S*$/.test(momNm)) momNm = momNm.replace(/\s+\S*\d\S*$/, "");
      f.mom = { name: momNm };
      var line = find(f.mom.name);
      f.mom.bat = line.runs; f.mom.balls = line.balls; f.mom.f4 = line.f4; f.mom.f6 = line.f6;
      f.mom.notOut = line.notOut; f.mom.w = line.w; f.mom.conc = line.r; f.mom.ovBalls = line.ov;
    }
    return f;
  }

  // ---- the writing ---------------------------------------------------------
  // Headline shapes, each one only reachable when its fact is true.
  function foMrHeadline(f) {
    var a = f.first, b = f.second;
    if (!b) return { head: (a ? a.team.toUpperCase() : "MATCH") + " BAT", dek: "The innings, as it happened." };
    if (f.tied) {
      return { head: "NOTHING BETWEEN THEM",
        dek: f.text + " at " + f.ground + " - both sides finished on " + a.runs + "." };
    }
    var wf = f.winFacts, lf = f.loseFacts;
    // one man carried it
    if (f.mom && f.mom.w >= 4) {
      return { head: foMrSurname(f.mom.name).toUpperCase() + " TAKES " + f.mom.w,
        dek: f.mom.w + " for " + f.mom.conc + " from " + foMrOvers(f.mom.ovBalls) + " overs, and " + f.winner + " win by " + f.margin + " " + f.marginUnit + "." };
    }
    if (f.mom && f.mom.bat != null && wf && f.mom.bat >= wf.runs * 0.42 && f.mom.bat >= 60) {
      return { head: foMrSurname(f.mom.name).toUpperCase() + "'S MATCH",
        dek: f.mom.bat + " of " + f.winner + "'s " + wf.runs + " came off one bat." };
    }
    // it went to the wire
    if (f.tight) {
      return { head: f.winner.toUpperCase() + " SURVIVE",
        dek: f.text + (f.chased && f.ballsLeft <= 12 ? " with " + f.ballsLeft + " " + foMrPlural(f.ballsLeft, "ball") + " to spare." : " - and not by much.") };
    }
    // a collapse decided it
    if (lf && lf.collapse && lf.collapse.wkts >= 4) {
      return { head: lf.team.toUpperCase() + " LOSE " + lf.collapse.wkts + " FOR " + lf.collapse.runs,
        dek: "The innings turned over between the " + Math.floor(lf.collapse.firstOv) + " and " + foMrOrd(Math.floor(lf.collapse.lastOv)) + " overs, and it never came back." };
    }
    // a total that was never going to be caught
    if (!f.chased && f.margin >= 60) {
      return { head: f.first.runs + " WAS ALWAYS ENOUGH",
        dek: f.winner + " defended it by " + f.margin + " runs at " + f.ground + "." };
    }
    if (f.chased && f.ballsLeft >= 42) {
      return { head: f.winner.toUpperCase() + " WALK IT",
        dek: f.target + " chased down with " + f.ballsLeft + " balls and " + f.margin + " " + foMrPlural(f.margin, "wicket") + " to spare." };
    }
    return { head: f.winner.toUpperCase() + " BY " + f.margin,
      dek: f.text + " at " + f.ground + "." };
  }

  // Each paragraph is assembled from facts and dropped entirely if the facts
  // behind it are missing - better a short report than a padded one.


  // the single moment the match turned on, chosen by weight not by taste
  function foMrTurning(f) {
    var cands = [];
    [f.first, f.second].forEach(function (side, ix) {
      if (!side) return;
      if (side.collapse && side.collapse.wkts >= 3) {
        cands.push({ w: side.collapse.wkts * 22 - side.collapse.runs,
          kick: "The collapse",
          line: side.team + " lost " + foMrWord(side.collapse.wkts) + " wickets for " + side.collapse.runs + " runs",
          detail: "Between the " + foMrOrd(Math.floor(side.collapse.firstOv)) + " and " + foMrOrd(Math.floor(side.collapse.lastOv)) +
            " overs, from " + side.collapse.at + " to " + side.collapse.to + ". " + side.collapse.lastMan + " was the last of them." });
      }
      if (side.stand && side.stand.runs >= 50) {
        cands.push({ w: side.stand.runs,
          kick: "The stand",
          line: side.stand.runs + " for the " + foMrOrd(side.stand.w) + " wicket",
          detail: side.stand.pair.replace(" / ", " and ") + " put on " + side.stand.runs + " from " + side.stand.balls +
            " balls - the partnership the " + (ix === 0 ? "innings" : "chase") + " was built on." });
      }
      if (side.best && side.best.w >= 4) {
        cands.push({ w: side.best.w * 26,
          kick: "The spell",
          line: side.best.p.name + " " + side.best.w + " for " + side.best.r,
          detail: foMrOvers(side.best.b) + " overs at " + (side.best.b ? (side.best.r / (side.best.b / 6)).toFixed(2) : "0") +
            " an over against " + side.team + "." });
      }
    });
    cands.sort(function (x, y) { return y.w - x.w; });
    return cands[0] || null;
  }

  // ---- the worm, drawn ------------------------------------------------------
  function foMrWorm(f) {
    var w = (f.rec && f.rec.worm) || [];
    if (!w[0] || w[0].length < 2) return "";
    var W = 460, H = 190, PL = 34, PB = 22, PT = 10, PR = 8;
    var maxR = 10, maxO = 50;
    [w[0], w[1]].forEach(function (rows) { (rows || []).forEach(function (p) { if (p[1] > maxR) maxR = p[1]; }); });
    maxR = Math.ceil(maxR / 50) * 50;
    var X = function (ov) { return PL + (ov / maxO) * (W - PL - PR); };
    var Y = function (r) { return PT + (1 - r / maxR) * (H - PT - PB); };
    var path = function (rows) {
      if (!rows || !rows.length) return "";
      return rows.map(function (p, i) { return (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join(" ");
    };
    var dots = function (rows, cls) {
      if (!rows) return "";
      var out = "", last = 0;
      rows.forEach(function (p) {
        if (p[2] > last) { out += "<circle class='" + cls + "' cx='" + X(p[0]).toFixed(1) + "' cy='" + Y(p[1]).toFixed(1) + "' r='3.4'></circle>"; last = p[2]; }
      });
      return out;
    };
    var grid = "";
    for (var g = 0; g <= maxR; g += 50) {
      grid += "<line class='g' x1='" + PL + "' y1='" + Y(g).toFixed(1) + "' x2='" + (W - PR) + "' y2='" + Y(g).toFixed(1) + "'></line>" +
        "<text class='gl' x='" + (PL - 6) + "' y='" + (Y(g) + 3).toFixed(1) + "' text-anchor='end'>" + g + "</text>";
    }
    for (var o = 0; o <= 50; o += 10) {
      grid += "<text class='gl' x='" + X(o).toFixed(1) + "' y='" + (H - 6) + "' text-anchor='middle'>" + o + "</text>";
    }
    return "<div class='fo-mr-worm'>" +
      "<svg viewBox='0 0 " + W + " " + H + "' preserveAspectRatio='xMidYMid meet' role='img' aria-label='Run worm for both innings'>" +
      grid +
      "<path class='w1' d='" + path(w[0]) + "'></path>" +
      (w[1] ? "<path class='w2' d='" + path(w[1]) + "'></path>" : "") +
      dots(w[0], "d1") + (w[1] ? dots(w[1], "d2") : "") +
      "</svg>" +
      "<div class='fo-mr-key'><span class='k1'></span>" + E(f.first ? f.first.team : "") +
      (f.second ? "<span class='k2'></span>" + E(f.second.team) : "") +
      "<em>&#9679; wicket</em></div></div>";
  }

  // ---- the page -------------------------------------------------------------
  function foMrCard(side) {
    if (!side) return "";
    var bat = side.bat.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, 3).map(function (b) {
      return "<div class='fo-mr-line'><span>" + E(b.p.name) + "</span><b>" + b.r + (b.out ? "" : "*") + "</b><i>" + b.b + "b</i></div>";
    }).join("");
    var bwl = side.bowlers.slice().sort(function (a, b) { return (b.w - a.w) || (a.r - b.r); }).slice(0, 2).map(function (b) {
      return "<div class='fo-mr-line'><span>" + E(b.p.name) + "</span><b>" + b.w + "/" + b.r + "</b><i>" + foMrOvers(b.b) + "ov</i></div>";
    }).join("");
    return "<div class='fo-mr-side'>" +
      "<div class='fo-mr-sh'><b>" + E(side.team) + "</b><u>" + side.runs + (side.allOut ? "" : "/" + side.wkts) + "</u><i>" + side.overs + " ov</i></div>" +
      "<div class='fo-mr-sub'>Top scorers</div>" + bat +
      (bwl ? "<div class='fo-mr-sub'>Best of the bowling faced</div>" + bwl : "") +
      "</div>";
  }

  function foMrGroundArt(f) {
    var slug = FO_MR_GROUND[f.ground] || "";
    return slug ? (ART + "cities/" + slug + "-ground.webp") : (ART + "home/hgm-dressing-room.webp");
  }

  // ---- THE SCORECARD ---------------------------------------------------------
  // Save-slimming throws away a lot of a finished match, but never the batting
  // and bowling cards - so every match ever played still has one of these,
  // however old.
  function foMrScorecard(rec) {
    var inn = (rec && (rec.innings || rec.scorecard)) || [];
    inn = inn.filter(Boolean);
    if (!inn.length) return foMrNone("No scorecard for this match", "Its innings were not recorded.");
    var html = "";
    try { if (typeof window.foScorecardCards === "function") html = window.foScorecardCards(inn); } catch (e) {}
    return html || foMrNone("No scorecard for this match", "Its innings were not recorded.");
  }

  // ---- THE COMMENTARY --------------------------------------------------------
  // The ball-by-ball log is the biggest thing a match carries and only the two
  // most recent are kept whole; the rest are slimmed so a season's save still
  // fits in the browser's five megabytes. So this says plainly when a log has
  // been let go rather than showing an empty box.
  //
  // A fifty-over match is about seven hundred deliveries. Printed end to end
  // that is a page ninety thousand pixels tall, which is not commentary, it is
  // a wall. So the default is the match as you would want it retold - every
  // wicket, every boundary, every milestone - and every ball is one tap away
  // for anyone who wants to sit through the lot.
  var FO_MR_MARK = { "★": 1, "⚑": 1, "▶": 1 };
  function foMrIsKey(L) {
    var o = String((L && L.out) || "");
    if (o === "4" || o === "6") return true;
    if (FO_MR_MARK[o]) return true;
    try { if (typeof isWkt === "function" && o && isWkt(o)) return true; } catch (e) {}
    return /^w/.test(o) && o !== "wide";
  }
  function foMrCommentary(rec, f, all) {
    var log = (rec && rec.log) || null;
    if (!log || !log.length) {
      // a served match with no log is a different story from a trimmed save:
      // the card came off the record, but this device could not re-run the
      // match ball for ball, and inventing the balls is not on offer
      if (rec && rec.__servedCard) {
        return foMrNone("The commentary has aged out",
          "The umpire keeps every ball of the running season; when a season ends, its commentary goes with it - " +
          "the scorecard, the chart and the points above are his own record and are kept forever.");
      }
      return foMrNone("The commentary has been let go",
        "Only the two most recent matches keep their ball-by-ball; older ones are trimmed so a whole career still fits on your phone. " +
        "The scorecard and the report are kept for every match, forever.");
    }
    // the engine writes the log newest-first, which is what a live feed wants
    // and the opposite of what a retelling wants: a match is read from the
    // first ball forward. Reversing keeps every marker row beside the ball it
    // belongs to, which re-sorting by over number would not.
    var chrono = log.slice().reverse();
    var shown = all ? chrono : chrono.filter(foMrIsKey);
    if (!shown.length) shown = chrono;
    var ix = (rec && rec.ix != null) ? rec.ix : "";
    var toggle = "<div class='fo-mr-cf'>" +
      "<a class='" + (all ? "" : "on") + "' href='#/report?i=" + ix + "&t=comm'>Key moments</a>" +
      "<a class='" + (all ? "on" : "") + "' href='#/report?i=" + ix + "&t=comm&c=all'>Every ball</a>" +
      "<b>" + shown.length + " of " + log.length + "</b></div>";

    // WHOSE INNINGS THIS IS, BY ORDER RATHER THAN BY NUMBER. The log's own
    // innings field is the engine's internal index and this module has no
    // business assuming whether it counts from nought or one. The first value
    // that appears in a chronological read IS the first innings, whatever it
    // is called, and the side that batted it is a better heading than a
    // number anyway.
    var seen = [], lastInn = null, rows = "";
    var innName = function (inn) {
      if (seen.indexOf(inn) < 0) seen.push(inn);
      var nth = seen.indexOf(inn);
      var side = nth === 0 ? (f && f.first && f.first.team) : (f && f.second && f.second.team);
      return side ? (side + " batting") : (nth === 0 ? "First innings" : "Second innings");
    };
    shown.forEach(function (L) {
      if (!L) return;
      var inn = L.inn == null ? null : (L.inn | 0);
      if (inn != null && inn !== lastInn) {
        lastInn = inn;
        rows += "<div class='fo-mr-innmark'>" + E(innName(inn)) + "</div>";
      }
      var o = String(L.out || "");
      var cls = o === "4" ? "four" : o === "6" ? "six" : (foMrIsKey(L) && !FO_MR_MARK[o] && o !== "4" && o !== "6") ? "wkt" : "";
      if (FO_MR_MARK[o]) cls = "mark";
      return rows += "<div class='fo-mr-ball" + (cls ? " " + cls : "") + "'>" +
        "<b>" + E(L.no || o || "") + "</b><span>" + E(L.txt || "") + "</span></div>";
    });
    return "<div class='fo-mr-comm'>" +
      "<div class='fo-mr-rule'><span>Ball by ball</span></div>" + toggle +
      "<div class='fo-mr-commlist'>" + rows + "</div>" +
      "<div class='fo-mr-by'>" + E((f && f.text) || "") + "</div></div>";
  }

  // ---- THE FANTASY TABLE -----------------------------------------------------
  // The same points that name the player of the match when a match is saved, so
  // the table and the medal can never disagree.
  function foMrFantasy(rec) {
    var inn = (rec && (rec.innings || rec.scorecard)) || [];
    inn = inn.filter(Boolean);
    // The marks come first: each side's units out of ten and, above them, the
    // TEAM MATCH RATING out of a hundred - the number the world rankings read.
    // The margin is half of that mark, so the result has to come along too.
    var rat = "";
    try {
      if (typeof window.foRatingsPanelHTML === "function") {
        rat = window.foRatingsPanelHTML(inn, (rec && rec.result) || null) || "";
      }
    } catch (eR) {}
    var html = "";
    try { if (typeof window.foFantasyPanel === "function") html = window.foFantasyPanel(inn); } catch (e) {}
    if (!html || /No fantasy data/.test(html)) {
      return rat || foMrNone("No fantasy points for this match", "Its innings were not recorded in enough detail to score.");
    }
    return rat + html;
  }

  function foMrNone(title, line) {
    return "<div class='fo-mr-none'><h3>" + E(title) + "</h3><p>" + E(line) + "</p></div>";
  }

  // ---- A MATCH THIS DEVICE NEVER PLAYED --------------------------------------
  // The league's results are the World Service's, and this device holds a card
  // for none of them: they are resolved on the server and the snapshot carries
  // the scoreline, not the ball-by-ball. So every one of those rows used to be
  // unopenable - the report page reads App.results, found nothing, and said
  // "nothing to report" or bounced. This is the report the world CAN tell:
  // both sides, both scores, the margin and the round. The scorecard,
  // commentary and fantasy views are not offered, because the ball-by-ball
  // they read is not published for these matches.
  function foMrServedRow(nat, id) {
    try {
      var snap = window.__foWorldLg && window.__foWorldLg.get(nat);
      if (!snap || !snap.results) return null;
      var nm = null; try { nm = window.__foWorldNames && window.__foWorldNames.get(nat); } catch (eN) {}
      for (var i = 0; i < snap.results.length; i++) {
        var r = snap.results[i];
        if (String(r.id) !== String(id)) continue;
        return { row: r, season: snap.seasonNo || 1, names: nm };
      }
    } catch (e) {}
    return null;
  }
  function foMrServedSide(nm, sc, win) {
    if (!sc) return "<div class='fo-mr-t'><b>" + E(nm) + "</b><u>&mdash;</u></div>";
    return "<div class='fo-mr-t" + (win ? " won" : "") + "'><b>" + E(nm) + "</b>" +
      "<u>" + (sc.r | 0) + (sc.w >= 10 ? "" : "/" + (sc.w | 0)) + "</u>" +
      (sc.ov ? "<i>" + E(sc.ov) + " ov</i>" : "") + "</div>";
  }
  // THE MATCH THIS DEVICE NEVER PLAYED, PLAYED AGAIN. The World Service does
  // not publish ball-by-ball - sixty per cent of the old league state was
  // commentary nobody read, and it was taken out on purpose. But the engine is
  // deterministic and version-stamped, the squads are generated from a seed the
  // client can derive, and the match id is a pure function of nation, season,
  // round and the two slots. So the report rebuilds the match from first
  // principles, exactly as the world theatre does when it spectates one live.
  //
  // It is only allowed to SHOW that reconstruction if it agrees with the
  // scoreline the server published. If a single run differs - a squad drifted,
  // an engine version moved, a manager's orders were in play - the page falls
  // back to the published scoreline rather than print a match that never
  // happened.
  // REBUILD THE MATCH THAT WAS PLAYED, NOT A MATCH FROM THE SAME SEED.
  // The umpire does not run a clean generated eleven: he runs the men as they
  // were that day - the experience the season has given them, the form of
  // their last five, the tiredness in the arm - and he runs whatever team
  // sheets managers filed. `state` carries both, straight from the World
  // Service, exactly as the broadcast takes them. Replay without it and the
  // engine plays a different, equally valid match; the verdicts disagree, the
  // agreement check does its job, and the reader gets a bare scoreline.
  function foMrReplayServed(nat, row, seasonNo, state) {
    try {
      var G = window.__foGame, WT = window.__foWT, PL = window.__foPlanet;
      if (!G || !G.simWorld || !WT || !WT.serverSquad || !PL) return null;
      var sides = PL.sidesOf(nat) || [];
      var bySlot = {}, byName = {};
      sides.forEach(function (sd) { bySlot[sd.slot] = sd; byName[sd.name] = sd; });
      var nm = null; try { nm = window.__foWorldNames && window.__foWorldNames.get(nat); } catch (eN) {}
      if (nm) Object.keys(nm).forEach(function (k) { if (bySlot[k]) byName[nm[k]] = bySlot[k]; });
      var hSd = byName[row.home], aSd = byName[row.away];
      if (!hSd || !aSd) return null;
      var sqH = WT.serverSquad(nat, hSd.slot), sqA = WT.serverSquad(nat, aSd.slot);
      if (!sqH || !sqA) return null;
      var liv = state && state.living;
      if (liv && WT.applyLiving) {
        sqH = WT.applyLiving(sqH, liv[row.home]);
        sqA = WT.applyLiving(sqA, liv[row.away]);
      }
      var matchId = nat + ":s" + (seasonNo | 0) + ":r" + (row.round | 0) + ":h" + hSd.slot + "a" + aSd.slot;
      var seed = (G.hash ? G.hash(matchId) : 0) || 1;
      var ground = (hSd.city || row.home) + " Ground";
      var out = G.simWorld({ name: row.home, ground: ground, players: sqH },
                           { name: row.away, players: sqA }, "balanced", "Sunny", seed,
                           (state && state.orders) || null);
      if (!out || !out.innings || !out.result) return null;
      // the agreement check: the same verdict, to the word
      if (String(out.result.text || "") !== String(row.text || "")) return null;
      return { ix: -1, date: "", home: row.home, away: row.away, ground: ground,
        pitch: "balanced", weather: "Sunny", seed: seed, result: out.result,
        innings: out.innings, worm: out.worm, log: out.log,
        comp: "league", round: (row.round | 0) - 1, seasonNo: seasonNo | 0 };
    } catch (e) { return null; }
  }
  // A rebuilt match is fifty overs of engine work. The four tabs are four
  // views of ONE match, so it is played once and kept; switching tabs should
  // cost a repaint, not a re-simulation.
  var MR_REP = {};
  // A CLUB ANSWERS TO THE NAME ITS MANAGER GAVE IT. The snapshot publishes
  // christened names - Mashed Potatoes, Thunder Emperor - while the squad
  // generator only knows slots, so the replay has to translate one to the
  // other. get() reads a cache and never fills it, so a report opened before
  // anything else had asked the world could not place a renamed club at all,
  // and fell back to the scoreline. Ask properly, and wait.
  function foMrNames(nat) {
    return new Promise(function (res) {
      try {
        var WN = window.__foWorldNames;
        if (!WN || !WN.want) return res(null);
        if (WN.get(nat)) return res(WN.get(nat));          // already in hand
        var done = false;
        var settle = function () { if (done) return; done = true; res(WN.get(nat)); };
        WN.want(nat, settle);
        setTimeout(settle, 4000);          // want() stays silent inside its courtesy window
      } catch (e) { res(null); }
    });
  }
  // ---- THE CARD THE UMPIRE WROTE ------------------------------------------
  // Migration 025 hands over `matches.result` - the canonical card, banked the
  // moment the match was played: both innings, every batsman as the cricketer
  // he actually was that day, every bowler's figures, the fielding, the worm.
  // A replay can only ever be an argument that it got the same answer; this IS
  // the answer. It also survives what no replay can - a club whose men have
  // been bought and sold since the season began.
  //
  // One thing it deliberately does not carry: the ball-by-ball. That is the
  // largest part of a match and the cheapest to re-derive, so commentary
  // still comes from the replay, and only when the replay agrees.
  var MR_SB = "https://egaipdksvztqqgouriyc.supabase.co";
  var MR_KEY = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var MR_CARD = {};
  function foMrCardFetch(nat, id) {
    var k = nat + "|" + id;
    if (MR_CARD[k]) return MR_CARD[k];
    var p = fetch(MR_SB + "/rest/v1/rpc/world_match_card", {
      method: "POST",
      headers: { apikey: MR_KEY, Authorization: "Bearer " + MR_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_country: nat, p_match_id: id })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.card) ? j : null; })
      .catch(function () { return null; });      // no RPC yet: the replay still stands
    MR_CARD[k] = p;
    return p;
  }
  // THE UMPIRE'S OWN COMMENTARY, kept for the whole running season (migration 066; was a week under
  // 045). Where it exists it outranks the replay's - it is the very
  // ball-by-ball the match was settled on - and after the week it is let go,
  // scorecard forever, exactly as the save's own slimming has always worked.
  var MR_LOG = {};
  function foMrLogFetch(nat, id) {
    var k = nat + "|" + id;
    if (MR_LOG[k]) return MR_LOG[k];
    var p = fetch(MR_SB + "/rest/v1/rpc/world_match_log", {
      method: "POST",
      headers: { apikey: MR_KEY, Authorization: "Bearer " + MR_KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_country: nat, p_match_id: id })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.log && j.log.length) ? j.log : null; })
      .catch(function () { return null; });      // no RPC yet: the replay still stands
    MR_LOG[k] = p;
    return p;
  }
  // the clubs of a nation, by the name the snapshot publishes AND by the name
  // a manager christened - the same translation the replay needs
  function foMrSidesBy(nat) {
    var byName = {};
    try {
      var PL = window.__foPlanet; if (!PL) return byName;
      var bySlot = {};
      (PL.sidesOf(nat) || []).forEach(function (sd) { bySlot[sd.slot] = sd; byName[sd.name] = sd; });
      var nm = null; try { nm = window.__foWorldNames && window.__foWorldNames.get(nat); } catch (eN) {}
      if (nm) Object.keys(nm).forEach(function (k) { if (bySlot[k]) byName[nm[k]] = bySlot[k]; });
    } catch (e) {}
    return byName;
  }
  // the banked card, dressed as the record every view already knows how to
  // read. The log rides along only if the replay earned it.
  function foMrRecFromCard(nat, hit, got, rep) {
    try {
      if (!got || !got.card || !got.card.innings) return null;
      var c = got.card, row = hit.row;
      var sd = foMrSidesBy(nat)[row.home];
      return {
        ix: -1, date: "",
        home: row.home, away: row.away,
        ground: (rep && rep.ground) || ((sd && sd.city ? sd.city : row.home) + " Ground"),
        pitch: "balanced", weather: "Sunny", seed: 0,
        result: { winner: c.winner, text: c.text, mom: c.mom },
        innings: c.innings, worm: c.worm || [[], []],
        log: (rep && rep.log) || [],
        comp: "league", round: (row.round | 0) - 1, seasonNo: hit.season | 0,
        __servedCard: 1
      };
    } catch (e) { return null; }
  }

  var MR_ASKED = {};
  function foMrRenderServed(nat, id, page) {
    var hit = foMrServedRow(nat, id);
    if (!hit) {
      // "Not in the record" was often a lie: the round WAS settled, this
      // device simply had not fetched the nation's book yet. get() reads a
      // cache and never fills it, so a report opened cold - a reload, a
      // shared link, a tap before anything else had asked - accused the
      // World Service of not having played the match. Ask for the book.
      var LG = window.__foWorldLg;
      if (LG && LG.want && !MR_ASKED[nat]) {
        MR_ASKED[nat] = 1;
        page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
          "<h1 class='fo-mr-head'>Sending for the book&hellip;</h1>" +
          "<p class='fo-mr-dek'>Reaching the World Service for this round's record.</p></div></div>";
        var again = function () {
          if ((location.hash || "").split("?")[0] !== "#/report") return;
          page.__foMrSig = null;
          try { window.foRenderReport(); } catch (eR2) {}
        };
        LG.want(nat, again);
        setTimeout(again, 5000);        // want() stays silent inside its courtesy window
        return;
      }
      page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
        "<h1 class='fo-mr-head'>That match is not in the record yet</h1>" +
        "<p class='fo-mr-dek'>The World Service has not published this round. Try again once it has settled.</p>" +
        "<div class='fo-mr-foot'><a class='fo-mr-back' href='#/league?t=results'>&#8592; Results</a></div></div></div>";
      return;
    }
    MR_ASKED[nat] = 0;                  // the book arrived; a later gap may ask again
    // The living state and the filed sheets come over the wire, so the full
    // report cannot be painted in the same breath as the click. Ask the world
    // first, paint the scoreline meanwhile, and upgrade in place when the
    // replay agrees. If the world is unreachable the scoreline simply stays -
    // never a report built from the wrong eleven.
    var WTs = window.__foWT;
    var ck = nat + "|" + id + "|" + (hit.season | 0);
    if (WTs && WTs.roundState && hit.row && hit.row.round && MR_REP[ck] !== false) {
      var sigOwn = location.hash;
      var have = MR_REP[ck];
      (have ? Promise.resolve(have) : Promise.all([
        foMrNames(nat), WTs.roundState(nat, hit.row.round | 0), foMrCardFetch(nat, id), foMrLogFetch(nat, id)
      ]).then(function (all) {
        // WHICH OF THE TWO TO READ FROM. A replay that AGREES with the banked
        // verdict is not a rival account of the match - it is the same match,
        // same seed, same men, same engine - and it carries more than the
        // canonical card does: the ball-by-ball, and the fall of wickets the
        // turning-point analysis is read from. So an agreeing replay wins.
        // The card is the floor, not the ceiling: it is what the reader gets
        // whenever the replay cannot be made to agree, and it is exact.
        var rep = foMrReplayServed(nat, hit.row, hit.season, all[1]);
        var built = rep || foMrRecFromCard(nat, hit, all[2], null);
        // the umpire's banked commentary outranks anything re-derived
        if (built && all[3] && all[3].length) built.log = all[3];
        MR_REP[ck] = built || false;                       // false: neither could be had
        return built;
      })).then(function (rep) {
        if (!rep) return;                                  // the scoreline stands
        if (location.hash !== sigOwn) return;              // the reader moved on
        var mt2 = /[?&]t=(\w+)/.exec(location.hash || "");
        var tab2 = mt2 ? mt2[1] : "sum";
        if (["sum", "card", "comm", "chart", "fantasy"].indexOf(tab2) < 0) tab2 = "sum";
        var base2 = "#/report?n=" + encodeURIComponent(nat) + "&w=" + encodeURIComponent(id);
        foMrPaint(rep, page, {
          tab: tab2,
          commAll: /[?&]c=all\b/.test(location.hash || ""),
          href: function (t) { return base2 + "&t=" + t; },
          others: [],
          back: "#/fixtures",
          nat: nat, roundNo: hit.row.round | 0
        });
      }).catch(function () {});
    }
    var r = hit.row, nm = hit.names;
    var say = function (n) { return n; };
    if (nm) { /* the snapshot already speaks current names; keep as published */ }
    var hN = say(r.home), aN = say(r.away);
    var art = ART + "home/hgm-dressing-room.webp";
    page.innerHTML =
      "<div class='fo-mr'>" +
      "<header class='fo-mr-hero'>" +
      "<figure class='fo-mr-plate'><img src='" + art + "' alt='' onerror=\"this.parentNode.style.display='none'\"></figure>" +
      "<div class='fo-mr-in fo-mr-in--hero'>" +
      "<div class='fo-mr-mast'>The Fifty Overs Journal <em>&middot; Match Report</em></div>" +
      "<div class='fo-mr-folio'>Season " + (window.foSeasonN ? foSeasonN(hit.season | 0) : (hit.season | 0)) + " &middot; Round " + (r.round | 0) + " &middot; League</div>" +
      "<h1 class='fo-mr-head'>" + E(String(r.text || (hN + " v " + aN))) + "</h1>" +
      "<p class='fo-mr-dek'>" + E(hN) + " against " + E(aN) + " &middot; round " + (r.round | 0) + " of the season.</p>" +
      "<div class='fo-mr-score'>" +
      foMrServedSide(hN, r.hs, r.winner === r.home) +
      "<span class='fo-mr-v'>v</span>" +
      foMrServedSide(aN, r.as, r.winner === r.away) +
      "</div>" +
      "</div></header>" +
      "<div class='fo-mr-in fo-mr-in--body'>" +
      "<div class='fo-mr-body'><article class='fo-mr-report'>" +
      "<p class='lead'>" + E(hN) + " " + (r.hs ? (r.hs.r | 0) + (r.hs.w >= 10 ? " all out" : "/" + (r.hs.w | 0)) + (r.hs.ov ? " from " + E(r.hs.ov) + " overs" : "") : "did not bat") + ". " +
      E(aN) + " " + (r.as ? (r.as.r | 0) + (r.as.w >= 10 ? " all out" : "/" + (r.as.w | 0)) + (r.as.ov ? " from " + E(r.as.ov) + " overs" : "") : "did not bat") + ".</p>" +
      "<div class='fo-mr-by'>Scoreline from the World Service &middot; round " + (r.round | 0) + "</div>" +
      "</article></div>" +
      "<div class='fo-mr-foot'>" +
      "<a class='fo-mr-back' href='#/league?t=results'>&#8592; Results</a>" +
      "<a class='fo-mr-back' href='#/league'>The league</a>" +
      "<a class='fo-mr-back' href='#/club'>Club</a>" +
      "</div></div></div>";
    try {
      var tb = document.getElementById("topbar"), mr = page.querySelector(".fo-mr");
      if (tb && mr) mr.style.paddingTop = (tb.offsetHeight || 0) + "px";
    } catch (eTb) {}
  }

  // ==== THE SUMMARY: the post-match dashboard (approved mock) ===============
  // The front room of a finished match: navy hero with both crests and the
  // verdict, then key moments, top performers, conditions, league impact,
  // momentum, runs-per-over, partnerships and the next engagement - every
  // figure read off the banked record, never invented.
  function foMrSumCrest(nm) {
    try { if (window.foClubCrest) return window.foClubCrest(nm, 66) || ""; } catch (e) {}
    return "";
  }
  function foMrCum(worm) {
    // per-over cumulative [runs, wkts] off the per-ball worm rows
    var out = [[0, 0]], last = [0, 0];
    (worm || []).forEach(function (p) {
      if (!p) return;
      var o = Math.ceil(p[0] - 1e-6);
      while (out.length <= o) out.push(last.slice());
      out[o] = [p[1], p[2]]; last = out[o];
    });
    for (var i = 1; i < out.length; i++) { if (!out[i]) out[i] = out[i - 1].slice(); }
    return out;
  }
  // MOMENTUM, as promised to the manager: for every over, the trailing five -
  // 4 x (runs above par) minus 22 per wicket, clamped to +/-100. Par is 5.4
  // an over in the first innings (the real-ODI rate the engine is calibrated
  // to) and the required rate in a chase. Positive = the batting side on top.
  function foMrMomentum(f, rec) {
    var w = (rec && rec.worm) || [];
    if (!w[0] || !w[0].length) return "";
    var series = [];
    [0, 1].forEach(function (ix) {
      var rows = w[ix]; if (!rows || !rows.length) return;
      var cum = foMrCum(rows), lastOv = cum.length - 1;
      var pts = [];
      for (var o = 1; o <= lastOv; o++) {
        var win = Math.min(5, o);
        var r0 = cum[o - win][0], k0 = cum[o - win][1];
        var runs = cum[o][0] - r0, wk = cum[o][1] - k0;
        var par;
        if (ix === 0) par = 5.4 * win;
        else {
          var need = Math.max(0, (f.target || 0) - r0);
          var left = 50 - (o - win);
          par = left > 0 ? (need / left) * win : 5.4 * win;
        }
        var m = 4 * (runs - par) - 22 * wk;
        pts.push(Math.max(-100, Math.min(100, m)));
      }
      series.push({ ix: ix, pts: pts, team: ix === 0 ? f.first.team : (f.second && f.second.team) });
    });
    if (!series.length) return "";
    var W = 520, H = 210, PT = 30, PB = 20, PL = 10, PR = 10;
    var half = (W - PL - PR - 14) / 2, y0 = PT + (H - PT - PB) / 2;
    var Y = function (m) { return y0 - (m / 100) * (H - PT - PB) / 2; };
    var COL = ["#C9571F", "#177A57"], FILL = ["rgba(201,87,31,.14)", "rgba(23,122,87,.13)"];
    var svg = "<line x1='" + PL + "' y1='" + y0 + "' x2='" + (W - PR) + "' y2='" + y0 + "' stroke='#e3dccb'/>";
    if (series.length > 1) svg += "<line x1='" + (PL + half + 7) + "' y1='" + (PT - 8) + "' x2='" + (PL + half + 7) + "' y2='" + (H - PB + 6) + "' stroke='#e3dccb' stroke-dasharray='4 4'/>";
    series.forEach(function (s, si) {
      var x0 = PL + si * (half + 14);
      var X = function (i) { return x0 + (s.pts.length > 1 ? (i / (s.pts.length - 1)) * half : 0); };
      var line = s.pts.map(function (m, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(m).toFixed(1); }).join(" ");
      var area = line + " L" + X(s.pts.length - 1).toFixed(1) + " " + y0 + " L" + x0 + " " + y0 + " Z";
      svg += "<path d='" + area + "' fill='" + FILL[si] + "' stroke='none'/>";
      svg += "<path d='" + line + "' fill='none' stroke='" + COL[si] + "' stroke-width='2.4' stroke-linejoin='round'/>";
      svg += "<text x='" + (x0 + half / 2) + "' y='" + (PT - 12) + "' text-anchor='middle' font-family='Oswald' font-size='9.5' letter-spacing='1.5' fill='#8a8272'>" + E(String(s.team || "").toUpperCase()) + " INNINGS</text>";
      if (si === series.length - 1 && s.pts.length) {
        svg += "<circle cx='" + X(s.pts.length - 1).toFixed(1) + "' cy='" + Y(s.pts[s.pts.length - 1]).toFixed(1) + "' r='4' fill='" + COL[si] + "'/>";
      }
    });
    return "<svg viewBox='0 0 " + W + " " + H + "' width='100%' role='img' aria-label='Match momentum'>" + svg + "</svg>" +
      "<div class='fo-ms-legend'><span><i style='background:#C9571F'></i>" + E(f.first.team) + "</span>" +
      (f.second ? "<span><i style='background:#177A57'></i>" + E(f.second.team) + "</span>" : "") +
      "<em title='Trailing five overs: 4 x (runs above par) - 22 per wicket; par is 5.4 an over, or the required rate in a chase'>above zero = batting side on top</em></div>";
  }
  function foMrManhattan(rec, f) {
    var w = (rec && rec.worm) || [];
    if (!w[0] || !w[0].length) return "";
    var W = 520, H = 140, PB = 16, PL = 8, PR = 8, PT = 10;
    var groups = [];
    [0, 1].forEach(function (ix) {
      var cum = foMrCum(w[ix] || []);
      if (cum.length < 2) return;
      var bars = [];
      for (var o = 1; o < cum.length; o++) bars.push({ r: cum[o][0] - cum[o - 1][0], k: cum[o][1] - cum[o - 1][1] });
      groups.push({ ix: ix, bars: bars });
    });
    if (!groups.length) return "";
    var maxR = 6; groups.forEach(function (g) { g.bars.forEach(function (b) { if (b.r > maxR) maxR = b.r; }); });
    var total = groups.reduce(function (s, g) { return s + g.bars.length; }, 0) + (groups.length > 1 ? 3 : 0);
    var bw = Math.max(3, Math.min(9, (W - PL - PR) / total - 1.5));
    var COL = ["#C9571F", "#177A57"];
    var x = PL, svg = "<line x1='" + PL + "' y1='" + (H - PB) + "' x2='" + (W - PR) + "' y2='" + (H - PB) + "' stroke='#e3dccb'/>";
    groups.forEach(function (g, gi) {
      g.bars.forEach(function (b) {
        var h = Math.max(2, (b.r / maxR) * (H - PB - PT));
        svg += "<rect x='" + x.toFixed(1) + "' y='" + (H - PB - h).toFixed(1) + "' width='" + bw + "' height='" + h.toFixed(1) + "' rx='1' fill='" + COL[gi] + "'/>";
        if (b.k > 0) svg += "<circle cx='" + (x + bw / 2).toFixed(1) + "' cy='" + (H - PB - h - 5).toFixed(1) + "' r='2.6' fill='#8E1F13'/>";
        x += bw + 1.5;
      });
      x += 10;
    });
    return "<svg viewBox='0 0 " + W + " " + H + "' width='100%' role='img' aria-label='Runs per over'>" + svg + "</svg>";
  }
  // the moments worth retelling: every wicket and the loudest blows, weighted
  // toward the business end of a chase, told in the broadcast's own words
  function foMrSumMoments(rec, f) {
    var out = [];
    var log = (rec && rec.log) || [];
    if (log.length) {
      var chrono = log.slice().reverse();
      var seen = [], cand = [];
      chrono.forEach(function (L, i) {
        if (!L || L.mile) return;
        var o = String(L.out || "");
        var isW = false; try { isW = (typeof isWkt === "function") ? !!(o && isWkt(o)) : /^w/.test(o) && o !== "wide"; } catch (e) {}
        if (!isW && o !== "4" && o !== "6") return;
        var inn = L.inn == null ? 0 : (L.inn | 0);
        if (seen.indexOf(inn) < 0) seen.push(inn);
        var nth = seen.indexOf(inn);
        var ov = parseFloat(L.no) || 0;
        var wt = (isW ? 30 : o === "6" ? 12 : 8) + (nth === 1 && ov >= 40 ? 14 : 0) + ov * 0.05;
        cand.push({ i: i, wt: wt, L: L, nth: nth, ov: ov, kind: isW ? "w" : o });
      });
      cand.sort(function (a, b) { return b.wt - a.wt; });
      out = cand.slice(0, 7).sort(function (a, b) { return a.i - b.i; }).map(function (c) {
        var side = c.nth === 0 ? f.first : f.second;
        var cum = foMrCum(((rec && rec.worm) || [])[c.nth] || []);
        var at = cum[Math.min(cum.length - 1, Math.ceil(c.ov))] || null;
        var m9 = /^(.{2,40}? to .{2,34}?)\s*[:—]\s*(.*)$/.exec(String(c.L.txt || ""));
        return { ov: c.L.no, kind: c.kind, who: m9 ? m9[1] : "", txt: m9 ? m9[2] : String(c.L.txt || ""),
          sc: at ? at[0] + "/" + at[1] : "", side: side ? side.team : "" };
      });
    } else {
      // no ball-by-ball for this card: the worm is per-ball and always banked,
      // so every fall of a wicket - its exact over and the score it fell at -
      // is still on the record, plus the ball the chase came home on
      var rows = [];
      var w9 = (rec && rec.worm) || [];
      [0, 1].forEach(function (ix9) {
        var side = ix9 === 0 ? f.first : f.second;
        var balls = w9[ix9]; if (!side || !balls) return;
        var lastK = 0, fow9 = (side.fow || []);
        balls.forEach(function (p9) {
          if (!p9 || p9[2] <= lastK) return;
          var fw = fow9[p9[2] - 1];
          rows.push({ ov: (+p9[0]).toFixed(1), kind: "w", who: fw && fw.who ? fw.who + " out" : "",
            txt: (fw && fw.who ? "" : "Wicket falls - ") + side.team + " " + p9[1] + "/" + p9[2],
            sc: p9[1] + "/" + p9[2], side: side.team, o9: +p9[0], second: ix9 === 1 });
          lastK = p9[2];
        });
      });
      if (f.second && f.chased && w9[1] && w9[1].length) {
        var lastB = w9[1][w9[1].length - 1];
        rows.push({ ov: (+lastB[0]).toFixed(1), kind: String(f.margin <= 2 ? "&#9733;" : "&#9654;"), who: "The winning runs",
          txt: f.second.team + " home at " + lastB[1] + "/" + lastB[2],
          sc: lastB[1] + "/" + lastB[2], side: f.second.team, o9: +lastB[0] + 0.01, second: true });
      }
      rows.sort(function (a, b) { return (a.second === b.second) ? a.o9 - b.o9 : (a.second ? 1 : -1); });
      // both halves of the story: the last blows of each innings, not just
      // the tail of the chase
      var one = rows.filter(function (r9) { return !r9.second; });
      var two = rows.filter(function (r9) { return r9.second; });
      out = one.slice(-3).concat(two.slice(-4));
    }
    return out;
  }
  function foMrSumMilestones(f) {
    var out = [];
    [f.first, f.second].forEach(function (side) {
      if (!side) return;
      side.bat.forEach(function (b) {
        if ((b.r | 0) >= 100) out.push({ tag: "100", head: "Hundred for " + b.p.name, sub: b.r + (b.out ? "" : "*") + " off " + b.b + " balls", side: side.team });
        else if ((b.r | 0) >= 50) out.push({ tag: "50", head: "Fifty for " + b.p.name, sub: b.r + (b.out ? "" : "*") + " off " + b.b + " balls", side: side.team });
      });
      // a bowler on this innings' card plays for the OTHER side: the innings
      // belongs to the batting team, its bowlers are the men who bowled at them
      var oppSide = side === f.first ? f.second : f.first;
      var oppNm = oppSide ? oppSide.team : side.bowlTeam || "";
      side.bowlers.forEach(function (b) {
        if ((b.w | 0) >= 4) {
          var wd = foMrWord(b.w | 0);
          out.push({ tag: (b.w | 0) + "W", head: wd.charAt(0).toUpperCase() + wd.slice(1) + " wickets for " + b.p.name,
            sub: b.w + "/" + b.r + " from " + foMrOvers(b.b) + " overs", side: oppNm });
        }
      });
    });
    return out.slice(0, 5);
  }
  function foMrStars10(p, bowl) {
    try {
      var sf = window.foStarsFor;
      if (sf && p && p.skills) {
        var n = sf.stars(bowl ? sf.bowl(p) : sf.bat(p));
        return "<span class='fo-ms-st'>" + sf.html(n) + "</span>";
      }
    } catch (e) {}
    return "";
  }
  function foMrSummary(rec, f, O, tabBar) {
    var hd = foMrHeadline(f), turn = foMrTurning(f);
    var a = f.first, b = f.second;
    // every club named on the hero is a door: the served league body knows
    // each club's seat, so a name resolves to its team page by lookup
    var slotOf = function (nm) {
      try {
        var lg9 = O.nat && window.__foWorldLg && window.__foWorldLg.get(O.nat);
        if (!lg9) return null;
        var hit9 = null;
        ((lg9.table || []).concat(lg9.table2 || [])).forEach(function (r9) { if (r9.name === nm) hit9 = r9.slot; });
        return hit9;
      } catch (e9) { return null; }
    };
    var teamL = function (nm) {
      var s9 = slotOf(nm);
      return s9 != null
        ? "<a class='fo-ms-tml' href='#/team?c=" + encodeURIComponent(O.nat) + "&s=" + (s9 | 0) + "'>" + E(nm) + "</a>"
        : E(nm);
    };
    var sideHTML = function (side, right) {
      if (!side) return "<div></div>";
      return "<div class='fo-ms-side" + (right ? " right" : "") + "'>" +
        (right ? "" : "<span class='cr'>" + foMrSumCrest(side.team) + "</span>") +
        "<div><div class='tn'>" + teamL(side.team) + "</div>" +
        "<div class='sc'>" + side.runs + (side.allOut ? "" : "/" + side.wkts) + "</div>" +
        "<div class='ov'>" + (side.allOut ? "ALL OUT &middot; " : "") + side.overs + " OVERS</div></div>" +
        (right ? "<span class='cr'>" + foMrSumCrest(side.team) + "</span>" : "") + "</div>";
    };
    var momSide = "";
    if (f.mom) {
      // batting card names his own side; a bowling card names the side he
      // bowled AT, so his club is the other one
      [a, b].forEach(function (s) {
        if (!s || momSide) return;
        if (s.bat.some(function (x) { return x.p && x.p.name === f.mom.name; })) momSide = s.team;
        else if (s.bowlers.some(function (x) { return x.p && x.p.name === f.mom.name; })) {
          var o9 = s === a ? b : a; momSide = o9 ? o9.team : "";
        }
      });
    }
    var hero =
      "<div class='fo-ms-hero'><div class='fo-ms-hg'>" +
      sideHTML(a, false) +
      "<div class='fo-ms-mid'><div class='mc'>Match Complete</div>" +
      "<div class='vd'>" + E(f.text || (f.winner ? f.winner + " win" : "Match tied")) + "</div>" +
      (f.mom ? "<div class='potm'><i>Player of the Match</i><b>" + E(f.mom.name) + (momSide ? " &middot; " + E(momSide) : "") + "</b></div>" : "") +
      "</div>" + sideHTML(b, true) + "</div></div>";

    // key moments
    var BB = { "w": ["W", "wk"], "4": ["4", "f4"], "6": ["6", "f6"] };
    var moments = foMrSumMoments(rec, f).map(function (m) {
      var bb = BB[m.kind] || [String(m.kind), "oth"];
      return "<div class='fo-ms-km'><span class='ov'>" + E(String(m.ov)) + "</span>" +
        "<span class='bb " + bb[1] + "'>" + bb[0] + "</span>" +
        "<span class='tx'>" + (m.who ? "<b>" + E(m.who) + "</b>" : "") + "<span>" + (m.who ? E(m.txt) : m.txt) + "</span></span>" +
        "<span class='sc'>" + E(m.sc) + "<i>" + E(m.side) + "</i></span></div>";
    }).join("") || "<div class='fo-ms-dim'>No moments recorded for this card.</div>";

    // the written summary, off the same generators the Journal writes with
    var prose = E(hd.dek || "") + (turn ? " " + E(turn.line) + " &mdash; " + E(turn.detail) : "");

    var miles = foMrSumMilestones(f).map(function (m) {
      return "<div class='fo-ms-km mile'><span class='ov'></span><span class='bb ms'>" + E(m.tag) + "</span>" +
        "<span class='tx'><b>" + E(m.head) + "</b><span>" + E(m.sub) + "</span></span>" +
        "<span class='sc'><i>" + E(m.side) + "</i></span></div>";
    }).join("");

    // top performers: the best bat and the best ball from each side
    var perf = "";
    var pfRow = function (p9, sub, num, bowl) {
      if (!p9) return "";
      return "<div class='fo-ms-pf'><span class='face'><img src='" + ART + (typeof foPkArt === "function" ? foPkArt(p9.p) : "") + "' alt='' onerror=\"this.style.visibility='hidden'\" loading='lazy'></span>" +
        "<span class='id'><b>" + E(p9.p.name) + "</b><span>" + E(sub) + "</span>" + foMrStars10(p9.p, bowl) + "</span>" +
        "<span class='num'>" + num + "</span></div>";
    };
    [a, b].forEach(function (s) { if (s && s.top) perf += pfRow(s.top, s.team, "<b>" + s.top.r + (s.top.out ? "" : "*") + "</b> <i>(" + s.top.b + ")</i>", false); });
    // the best bowling on each innings' card belongs to the OTHER side - the
    // men who bowled at them
    var perfB = "";
    [a, b].forEach(function (s) {
      var owner = s === a ? b : a;
      if (s && s.best) perfB += pfRow(s.best, owner ? owner.team : (s.bowlTeam || ""), "<b>" + s.best.w + "/" + s.best.r + "</b> <i>" + foMrOvers(s.best.b) + " ov</i>", true);
    });

    // conditions: the umpire's own, or the locally recorded ones - never a guess
    var cond = null, condRows = "";
    try {
      if (O.nat && O.roundNo && window.__foPlanet && window.__foPlanet.condOf) {
        var sd9 = foMrSidesBy(O.nat)[rec.home];
        if (sd9) cond = window.__foPlanet.condOf(O.nat, sd9.slot, rec.seasonNo || 1, O.roundNo | 0);
      } else if (!rec.__servedCard && rec.pitch) cond = { pitch: rec.pitch, weather: rec.weather };
    } catch (eC) {}
    var PITCH_W9 = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Dry", slow: "Slow", cracked: "Cracked", twoPaced: "Two-paced" };
    if (cond) {
      condRows += (cond.weather ? "<div class='fo-ms-kv'><span>Weather</span><b>" + E(String(cond.weather)) + "</b></div>" : "") +
        (cond.pitch ? "<div class='fo-ms-kv'><span>Pitch</span><b>" + E(PITCH_W9[cond.pitch] || String(cond.pitch)) + "</b></div>" : "");
    }
    condRows = "<div class='fo-ms-kv'><span>Batted first</span><b>" + E(a.team) + "</b></div>" + condRows +
      (f.ground ? "<div class='fo-ms-kv'><span>Ground</span><b>" + E(f.ground) + "</b></div>" : "");

    // league impact: only when this is my club's own league match, off the
    // served snapshot - the same book the table reads
    var impact = "";
    try {
      var sv = window.__foServed;
      if (sv && sv.on() && O.nat === sv.nation()) {
        var myN = sv.name();
        if (myN && (rec.home === myN || rec.away === myN) && sv.roundsPlayed() >= (O.roundNo | 0)) {
          var me9 = sv.me(), rows9 = sv.rows(), pos9 = 0;
          rows9.forEach(function (r9, i9) { if (r9.nm === myN) pos9 = i9 + 1; });
          var frm = sv.form();
          impact = "<div class='fo-ms-ck'><span>League impact</span></div>" +
            "<div class='fo-ms-kv'><span>Points</span><b>" + (me9 ? me9.pts : "-") + " pts &middot; " + (me9 ? me9.w + "W " + me9.l + "L" + (me9.t ? " " + me9.t + "T" : "") : "") + "</b></div>" +
            (pos9 ? "<div class='fo-ms-kv'><span>Position</span><b>" + foMrOrd(pos9) + " &middot; Division " + (sv.myDiv() === 2 ? "Two" : "One") + "</b></div>" : "") +
            (me9 ? "<div class='fo-ms-kv'><span>Net run rate</span><b>" + (me9.nrr > 0 ? "+" : "") + (+me9.nrr).toFixed(2) + "</b></div>" : "") +
            (frm.length ? "<div class='fo-ms-kv'><span>Form</span><b>" + frm.slice(-5).map(function (x) { return "<u class='f" + x + "'>" + x + "</u>"; }).join("") + "</b></div>" : "");
        }
      }
    } catch (eI) {}

    // partnerships: the three biggest stands of the night
    var stands = [];
    [0, 1].forEach(function (ix9) {
      var inn9 = (f.rec.innings || [])[ix9], side9 = ix9 === 0 ? a : b;
      if (!inn9 || !side9) return;
      (inn9.pships || []).forEach(function (p9) { stands.push({ p: p9, side: side9.team }); });
    });
    stands.sort(function (x, y) { return (y.p.runs | 0) - (x.p.runs | 0); });
    var maxSt = stands.length ? (stands[0].p.runs | 0) : 1;
    var pships = stands.slice(0, 3).map(function (s9) {
      return "<div class='fo-ms-pr'><span>" + E(String(s9.p.pair || "").replace(" / ", " & ")) + " &middot; " + foMrOrd(s9.p.w | 0) + " wkt</span>" +
        "<b>" + (s9.p.runs | 0) + "</b><span class='bar'><i style='width:" + Math.max(8, Math.round((s9.p.runs | 0) / maxSt * 100)) + "%'></i></span></div>";
    }).join("");

    // the next engagement, when this is my own league
    var nextFix = "";
    try {
      var sv2 = window.__foServed;
      if (sv2 && sv2.on() && O.nat === sv2.nation()) {
        var myN2 = sv2.name();
        if (myN2 && (rec.home === myN2 || rec.away === myN2)) {
          var fx = sv2.fixtures(1)[0];
          if (fx) {
            var when = "";
            try {
              var P9 = window.__foPlanet, t9 = sv2.ballAt(fx.round);
              var d9 = P9.dayOfSeasonRound(sv2.seasonNo(), fx.round + 1);
              when = (P9.dateTxt ? P9.dateTxt(d9) : "") + " &middot; " + ("0" + P9.natHour(O.nat)).slice(-2) + ":00 UTC";
            } catch (eW9) {}
            nextFix = "<div class='fo-ms-dark'><div class='dk'>Next fixture</div>" +
              "<div class='nf'><div><b>" + (fx.isHome ? "v " : "at ") + E(fx.opp.name) + "</b>" +
              "<span>Round " + fx.roundNo + (when ? " &middot; " + when : "") + "</span></div><span class='vs'>VS</span></div>" +
              "<a class='go' href='#/fixtures'>View fixtures &rarr;</a></div>";
          }
        }
      }
    } catch (eNx) {}

    // a sibling tab hands its own body in and borrows the hero + tab bar, so
    // every view of the match stands in the same room
    if (O && O.__tabBody != null) return hero + (tabBar || "") + O.__tabBody;
    // THE STORY READS DOWNWARD: what happened (prose), who did it (performers),
    // the shape of it (charts) - and only then the blow-by-blow. Key moments
    // close the page as a full-width strip, one step from the ball-by-ball
    // book they are excerpts of.
    return hero + (tabBar || "") +
      "<div class='fo-ms-g'>" +
      "<div class='fo-ms-card'>" +
      "<div class='fo-ms-ck'><span>Match summary</span></div><div class='fo-ms-prose'>" + prose + "</div>" +
      (miles ? "<div class='fo-ms-ck'><span>Milestones</span></div>" + miles : "") +
      "</div>" +
      "<div class='fo-ms-card'>" +
      "<div class='fo-ms-ck'><span>Top performers</span></div>" +
      "<div class='fo-ms-ph'>BATTING</div>" + perf +
      "<div class='fo-ms-ph'>BOWLING</div>" + perfB +
      "<a class='fo-ms-more' href='" + O.href("fantasy") + "'>View full player stats &rarr;</a>" +
      "<div class='fo-ms-ck'><span>Toss &amp; conditions</span></div>" + condRows + impact +
      "</div>" +
      "<div class='fo-ms-card'>" +
      "<div class='fo-ms-ck'><span>Match momentum</span></div><div class='fo-ms-pad'>" + foMrMomentum(f, rec) + "</div>" +
      "<div class='fo-ms-ck'><span>Runs per over</span><em class='fo-ms-note'>&#9679; wicket</em></div><div class='fo-ms-pad'>" + foMrManhattan(rec, f) + "</div>" +
      (pships ? "<div class='fo-ms-dark first'><div class='dk'>Best partnerships</div>" + pships + "</div>" : "") +
      nextFix +
      "</div>" +
      "<div class='fo-ms-card fo-ms-wide'>" +
      "<div class='fo-ms-ck'><span>Key moments</span></div>" + moments +
      "<a class='fo-ms-more' href='" + O.href("comm") + "'>Read it ball by ball &rarr;</a>" +
      "</div>" +
      "</div>";
  }

  // ONE PAINTER, TWO SOURCES. A match played on this device and a world
  // match rebuilt from its seed produce the same record, so they get the
  // same page - the report, the scorecard, the commentary, the run chart
  // and the fantasy points - and only the links differ.
  function foMrPaint(rec, page, O) {
    var tab = O.tab, commAll = O.commAll;
      var f = foMrFacts(rec);
      if (!f) { page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><h1 class='fo-mr-head'>Report unavailable</h1>" +
        "<p class='fo-mr-dek'>That match did not finish an innings.</p></div></div>"; return; }

      var hd = foMrHeadline(f), turn = foMrTurning(f);
      var others = O.others || [];

      var scoreline = "<div class='fo-mr-score'>" +
        "<div class='fo-mr-t'><b>" + E(f.first.team) + "</b><u>" + f.first.runs + (f.first.allOut ? "" : "/" + f.first.wkts) + "</u><i>" + f.first.overs + " ov</i></div>" +
        "<span class='fo-mr-v'>v</span>" +
        (f.second ? "<div class='fo-mr-t'><b>" + E(f.second.team) + "</b><u>" + f.second.runs + (f.second.allOut ? "" : "/" + f.second.wkts) + "</u><i>" + f.second.overs + " ov</i></div>" : "") +
        "</div><div class='fo-mr-verdict'>" + E(f.text) + "</div>";

      var momCard = "";
      if (f.mom) {
        var bits = [];
        if (f.mom.bat != null && f.mom.bat > 0) bits.push("<div class='fo-mr-line'><span>With the bat</span><b>" + f.mom.bat + (f.mom.notOut ? "*" : "") + "</b><i>" + f.mom.balls + "b</i></div>");
        if (f.mom.w > 0) bits.push("<div class='fo-mr-line'><span>With the ball</span><b>" + f.mom.w + "/" + f.mom.conc + "</b><i>" + foMrOvers(f.mom.ovBalls) + "ov</i></div>");
        momCard = "<div class='fo-mr-mom'><div class='fo-mr-kick'>Man of the match</div>" +
          "<h3>" + E(f.mom.name) + "</h3>" + (bits.join("") || "<div class='fo-mr-line'><span>Named by the umpires</span></div>") + "</div>";
      }

      var turnCard = turn ? "<div class='fo-mr-turn'><div class='fo-mr-kick'>" + E(turn.kick) + "</div>" +
        "<h3>" + E(turn.line) + "</h3><p>" + E(turn.detail) + "</p></div>" : "";

      var moreHTML = others.length ? "<section class='fo-mr-more'>" +
        "<div class='fo-mr-rule'><span>Earlier in the season</span></div>" +
        "<div class='fo-mr-morelist'>" + others.map(function (o) {
          return "<a class='fo-mr-mrow' href='#/report?i=" + o.ix + "'>" +
            "<i>" + E(o.date || "") + "</i><b>" + E(o.home) + " v " + E(o.away) + "</b>" +
            "<span>" + E((o.result && o.result.text) || "") + "</span></a>";
        }).join("") + "</div></section>" : "";

      // ---- the four ways to read a finished match --------------------------
      // FOUR WAYS TO READ A FINISHED MATCH, none of them prose. The written
      // report was the page's front room; it is gone, and the chart it used to
      // carry at the bottom is a room of its own.
      var TABS = [["sum", "Summary"], ["card", "Scorecard"], ["comm", "Ball by Ball"], ["chart", "Charts"], ["fantasy", "Match Ratings"]];
      var tabBar = "<nav class='fo-mr-tabs' aria-label='Match views'>" + TABS.map(function (t) {
        return "<a class='fo-mr-tab" + (t[0] === tab ? " on" : "") + "' href='" + O.href(t[0]) + "'" +
          (t[0] === tab ? " aria-current='page'" : "") + ">" + t[1] + "</a>";
      }).join("") + "</nav>";

      // ONE ROOM, FIVE VIEWS. Every tab now stands inside the Summary's own
      // daylight skeleton - crumb, navy hero, tab bar - and only the body
      // below the tabs changes. The old newspaper shell (Journal masthead,
      // painting, its own scoreline) is gone; the hero already says all of it.
      var crumb = "<div class='fo-ms-crumb'>&#8249;&#8249; &nbsp;" +
        (f.ground ? E(f.ground) + " &nbsp;&middot;&nbsp; " : "") +
        (O.roundNo ? "Round " + (O.roundNo | 0) + " &nbsp;&middot;&nbsp; " : (f.date ? E(f.date) + " &nbsp;&middot;&nbsp; " : "")) +
        // a friendly is not a league match and should not claim to be one
        (rec.friendly ? "Friendly" : rec.seasonNo ? "Season " + (window.foSeasonN ? foSeasonN(rec.seasonNo | 0) : (rec.seasonNo | 0)) : "League") + "</div>";
      var dayFoot = "<div class='fo-mr-foot'>" +
        "<a class='fo-mr-back day' href='" + (O.back || "#/fixtures") + "'>" + (O.backLbl || "&#8592; Results") + "</a>" +
        (rec.friendly ? "<a class='fo-mr-back day' href='#/home'>The club</a>"
                      : "<a class='fo-mr-back day' href='#/league'>The league</a>") +
        "<a class='fo-mr-back day' href='#/home'>Club</a>" +
        "</div>";

      var body;
      if (tab === "sum") {
        body = foMrSummary(rec, f, O, tabBar);
      } else {
        var inner;
        if (tab === "chart") {
          inner =
            "<div class='fo-mr-row2'>" + turnCard + momCard + "</div>" +
            "<div class='fo-mr-cards fo-mr-cards--row'>" + foMrCard(f.first) + foMrCard(f.second) + "</div>" +
            "<section class='fo-mr-wormsec'><div class='fo-mr-rule'><span>How it was scored</span></div>" + foMrWorm(f) + "</section>" +
            moreHTML;
        } else if (tab === "card") {
          inner = "<div class='fo-mr-panel'>" + foMrScorecard(rec) + "</div>";
        } else if (tab === "comm") {
          inner = "<div class='fo-mr-panel'>" + foMrCommentary(rec, f, commAll) + "</div>";
        } else {
          inner = "<div class='fo-mr-panel'>" + foMrFantasy(rec) + "</div>";
        }
        var O2 = Object.assign({}, O, { __tabBody: "<div class='fo-ms-tabbody'>" + inner + "</div>" });
        body = foMrSummary(rec, f, O2, tabBar);
      }

      page.innerHTML =
        "<div class='fo-mr fo-mr--sum'><div class='fo-ms-in'>" +
        crumb + body + dayFoot +
        "</div></div>";
      try {
        var tb9 = document.getElementById("topbar"), mr9 = page.querySelector(".fo-mr");
        if (tb9 && mr9) mr9.style.paddingTop = (tb9.offsetHeight || 0) + "px";
      } catch (eTb9) {}
  }

  /* ==========================================================================
     A FRIENDLY GETS THE SAME REPORT.
     The Journal page above is the best thing the game prints about a match -
     the headline, the turning point, the man of the match, the worm, the card
     and the commentary - and a friendly could not reach it. Not because a
     friendly deserves less, but because this page reads a SERVED LEAGUE row
     and a friendly is a ball-by-ball log behind a different RPC.
     So the log is turned into the record this page already knows how to read.
     One page, every match in the game.
     THE UMPIRE OUTRANKS THE WALK. Walking the deliveries gives complete
     figures to the last ball - better than his over prints, which stop at the
     last completed over - but it disagreed with him on wickets, crediting
     Noah Wright three where his own card says five. Where he has printed a
     bowler's figures they are used; the walk fills in only the men he never
     printed, which is anybody pulled up mid-over.
     ========================================================================== */
  var FR_WKT = { wC: "caught", wB: "bowled", wLBW: "lbw", wST: "stumped", wRO: "run out" };
  function foFrBallRuns(r) {
    var o = r && r.out, t = (r && r.txt) || "";
    if (!o) return 0;
    if (/^[0-9]+$/.test(o)) return +o;
    if (o === "dot") return 0;
    if (o === "wide") return /\bfour\b/i.test(t) ? 5 : 1;
    if (o === "noball") return /\bsix\b/i.test(t) ? 7 : /\bfour\b/i.test(t) ? 5 : 1;
    if (o === "bye" || o === "legbye") return /\bfour\b/i.test(t) ? 4 : /\btwo\b/i.test(t) ? 2 : 1;
    return 0;
  }
  function foFrOvOf(legal) { return Math.floor(legal / 6) + (legal % 6) / 10; }

  function foMrRecFromFriendly(j, resultText) {
    if (!j || !j.log || !j.log.length) return null;
    var log = (j.log || []).slice().reverse();        // the RPC serves newest first
    var hN = (j.home && j.home.name) || "Home", aN = (j.away && j.away.name) || "Away";
    var mk = function () {
      return { batTeam: "", runs: 0, wkts: 0, legal: 0, bat: [], byName: {}, bowlers: {}, printed: {},
               fow: [], pships: [], pairNow: [], pshipBalls: 0, extras: { wd: 0, nb: 0, b: 0, lb: 0 }, worm: [] };
    };
    var I = [mk(), mk()], meta = { wx: "", pitch: "", toss: "", elected: "" };
    for (var i = 0; i < log.length; i++) {
      var r = log[i]; if (!r) continue;
      var S = I[(r.inn | 0) === 1 ? 1 : 0];
      if (r.out === "▶") {                       // the umpire's opening line
        var cw = /with (.+?) conditions and an? (.+?) pitch/i.exec(r.txt || "");
        var ct = /([A-Za-z0-9 '&-]+?) won the toss and chose to (\w+)/i.exec(r.txt || "");
        if (cw) { meta.wx = cw[1]; meta.pitch = cw[2]; }
        if (ct) { meta.toss = ct[1].trim(); meta.elected = ct[2]; }
        continue;
      }
      if (r._top) {                                   // an end-of-over print
        var tp = /-\s*(.+?)\s+(\d+)\/(\d+)\./.exec(r.txt || "");
        if (tp && !S.batTeam) S.batTeam = tp[1].trim();
        var ovm = /End of over (\d+)/.exec(r.txt || "");
        if (ovm) S.worm.push([+ovm[1], S.runs, S.wkts]);
        // his own figures for the man who bowled it
        var bw = /([A-Z][A-Za-z .'’-]+?) (\d+)-(\d+)-(\d+)\.\s*$/.exec(r.txt || "");
        if (bw) S.printed[bw[1].trim()] = { o: +bw[2], r: +bw[3], w: +bw[4] };
        continue;
      }
      if (/Innings break/.test(r.txt || "")) {
        var cl = /Innings break\.\s*(.+?)\s+(\d+)\/(\d+)\./.exec(r.txt || "");
        if (cl && !S.batTeam) S.batTeam = cl[1].trim();
        continue;
      }
      var fx = /Partnership ends at (\d+)\s*-\s*(.+?) out for (\d+)\s*\((\d+)\)\.\s*(.+?)\s+(\d+)\/(\d+)\./.exec(r.txt || "");
      if (fx) {
        if (!S.batTeam) S.batTeam = fx[5].trim();
        S.fow.push({ sc: +fx[6], wkt: +fx[7], who: fx[2], ov: foFrOvOf(S.legal) });
        // A STAND IS TWO MEN, and the page names them: "put on 74 from 61
        // balls". The umpire prints the runs and who fell; the pair and the
        // balls come off the deliveries since the last wicket.
        var dn = fx[2].trim(), db = S.byName[dn];
        if (!db) { db = { p: { name: dn }, r: 0, b: 0, f4: 0, f6: 0, out: null }; S.byName[dn] = db; S.bat.push(db); }
        db.r = +fx[3]; db.b = +fx[4];              // his figures, in his own hand
        db.out = S.pendWk || "out";
        S.pendWk = null;
        S.pships.push({ runs: +fx[1], balls: S.pshipBalls || 0, w: +fx[7],
                        pair: (S.pairNow || []).slice(0, 2).join(" / ") });
        S.pshipBalls = 0;
        S.pairNow = (S.pairNow || []).filter(function (n) { return n !== fx[2]; });
        continue;
      }
      if (r.no === "" || r.intro) continue;

      // ---- a delivery -----------------------------------------------------
      var o = r.out, runs = foFrBallRuns(r);
      var wide = o === "wide", nb = o === "noball", bye = (o === "bye" || o === "legbye");
      S.runs += runs;
      if (!wide && !nb) S.legal++;
      if (wide) S.extras.wd += runs;
      else if (nb) S.extras.nb += runs;
      else if (o === "bye") S.extras.b += runs;
      else if (o === "legbye") S.extras.lb += runs;
      S.pshipBalls = (S.pshipBalls || 0) + (wide ? 0 : 1);
      if (r.strikerNm) {
        S.pairNow = S.pairNow || [];
        if (S.pairNow.indexOf(r.strikerNm) < 0) S.pairNow.push(r.strikerNm);
        if (S.pairNow.length > 2) S.pairNow = S.pairNow.slice(-2);
        var b = S.byName[r.strikerNm];
        if (!b) { b = { p: { name: r.strikerNm }, r: 0, b: 0, f4: 0, f6: 0, out: null }; S.byName[r.strikerNm] = b; S.bat.push(b); }
        if (!wide) b.b++;                              // a wide is not a ball faced
        if (/^[0-9]+$/.test(o)) { b.r += +o; if (+o === 4) b.f4++; if (+o === 6) b.f6++; }

      }
      // A RUN-OUT CAN TAKE THE MAN AT THE OTHER END. Hanging the dismissal on
      // the striker of the delivery gave Theo Crawford's run-out to whoever
      // happened to be facing, and his figures to the wrong man with it. The
      // umpire's fall-of-wicket note names him, so the wicket waits for it.
      if (FR_WKT[o]) {
        var bo9 = foMrSurname(r.bowlerNm || ""), fl9 = foMrSurname((r.ev && r.ev.fldNm) || "");
        S.pendWk = o === "wC" ? ("c " + (fl9 || "sub") + " b " + bo9)
                 : o === "wB" ? ("b " + bo9)
                 : o === "wLBW" ? ("lbw b " + bo9)
                 : o === "wST" ? ("st \u2020 b " + bo9)
                 : "run out";
      }
      if (r.bowlerNm) {
        var w = S.bowlers[r.bowlerNm];
        if (!w) { w = { p: { name: r.bowlerNm }, b: 0, r: 0, w: 0 }; S.bowlers[r.bowlerNm] = w; }
        if (!wide && !nb) w.b++;
        if (!bye) w.r += runs;                         // a bye is not the bowler's
        if (FR_WKT[o] && o !== "wRO") w.w++;
      }
      if (FR_WKT[o]) S.wkts++;
    }
    // the innings may close mid-over, so the worm gets its true last point
    I.forEach(function (S) {
      if (!S.legal) return;
      var pt = [Math.round(foFrOvOf(S.legal) * 10) / 10, S.runs, S.wkts];
      if (!S.worm.length || S.worm[S.worm.length - 1][0] < pt[0]) S.worm.push(pt);
      // the last stand never gets a fall-of-wicket note, so it is closed here
      if (S.pshipBalls && (S.pairNow || []).length) {
        var lastF = S.fow.length ? S.fow[S.fow.length - 1].sc : 0;
        S.pships.push({ runs: Math.max(0, S.runs - lastF), balls: S.pshipBalls,
                        w: S.wkts + 1, pair: S.pairNow.slice(0, 2).join(" / ") });
      }
      // HIS CARD, NOT MINE, wherever he wrote one down
      Object.keys(S.printed).forEach(function (k) {
        var pr = S.printed[k], mine = null, best = null;
        Object.keys(S.bowlers).forEach(function (nm) {
          if (nm === k || foMrSurname(nm) === foMrSurname(k)) mine = S.bowlers[nm];
        });
        if (mine) { mine.b = pr.o * 6; mine.r = pr.r; mine.w = pr.w; }
        else { S.bowlers[k] = { p: { name: k }, b: pr.o * 6, r: pr.r, w: pr.w }; }
        if (best) { /* unused */ }
      });
    });
    if (!I[0].batTeam) I[0].batTeam = (meta.elected === "bat") ? meta.toss : (meta.toss === hN ? aN : hN);
    if (!I[1].batTeam) I[1].batTeam = (I[0].batTeam === hN ? aN : hN);
    if (!I[1].legal) I[1] = null;

    // who won, off the umpire's own words
    var txt = resultText || "", winner = null;
    if (txt) {
      [hN, aN].forEach(function (n) {
        if (winner) return;
        if (new RegExp("^" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(txt)) winner = n;
      });
    }
    return {
      ix: "fr" + (j.id || ""), home: hN, away: aN, comp: "friendly",
      date: j.playAtMs ? new Date(+j.playAtMs).toISOString().slice(0, 10) : "",
      ground: (j.home && j.home.ground) || (hN + " Ground"),
      pitch: meta.pitch, weather: meta.wx,
      innings: I[1] ? [I[0], I[1]] : [I[0]],
      worm: I[1] ? [I[0].worm, I[1].worm] : [I[0].worm],
      result: { text: txt, winner: winner },
      // THE PAGE REVERSES THIS ITSELF. Every reader downstream - the key
      // moments, the commentary - takes rec.log NEWEST FIRST, which is how the
      // World Service serves a league card. Handing over the oldest-first copy
      // the walk above needed made the moments read the second innings as the
      // first, and put Somerset's score beside a Mashed Potatoes wicket.
      log: (j.log || []).slice(), friendly: true
    };
  }

  // one fetch for the two things a friendly report needs
  var FR_REC = {};
  function foMrFriendlyFetch(id) {
    if (FR_REC[id]) return Promise.resolve(FR_REC[id]);
    var SB = "https://egaipdksvztqqgouriyc.supabase.co";
    var KEY = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
    var call = function (fn) {
      return fetch(SB + "/rest/v1/rpc/" + fn, {
        method: "POST", headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ p_id: +id })
      }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    };
    return Promise.all([call("world_friendly_log"), call("world_friendly_detail")])
      .then(function (a) {
        if (!a[0] || !a[0].log) return null;
        var rec = foMrRecFromFriendly(a[0], (a[1] && a[1].text) || "");
        if (rec) FR_REC[id] = rec;
        return rec;
      });
  }

  window.foRenderReport = function () {
    try {
      try { if (typeof window.foCxNav === "function") window.foCxNav(); } catch (eN) {}
      if ((location.hash || "").split("?")[0] !== "#/report") return;
      var page = document.getElementById("page"); if (!page) return;
      foMrCss();
      // A FRIENDLY NAMES ITSELF BY ITS OWN ID. Same page, same painter.
      var mfr = /[?&]fr=(\d+)/.exec(location.hash || "");
      if (mfr) {
        var mtF = /[?&]t=(\w+)/.exec(location.hash || "");
        var tabF = mtF ? mtF[1] : "sum";
        if (["sum", "card", "comm", "chart", "fantasy"].indexOf(tabF) < 0) tabF = "sum";
        var sigF = "mrf|" + mfr[1] + "|" + tabF + "|" + (/[?&]c=all\b/.test(location.hash || "") ? "all" : "key");
        if (page.__foMrSig === sigF && page.querySelector(".fo-mr")) return;
        page.__foMrSig = sigF;
        document.body.classList.add("fo-mr-on");
        var ownF = location.hash;
        page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
          "<h1 class='fo-mr-head'>Sending for the book&hellip;</h1>" +
          "<p class='fo-mr-dek'>Reaching the umpire for this friendly's record.</p></div></div>";
        foMrFriendlyFetch(mfr[1]).then(function (rec) {
          if (location.hash !== ownF) return;          // the reader moved on
          if (!rec) {
            page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
              "<h1 class='fo-mr-head'>That friendly is not in the book</h1>" +
              "<p class='fo-mr-dek'>It may not have been played yet.</p>" +
              "<div class='fo-mr-foot'><a class='fo-mr-back' href='#/home'>&#8592; The club</a></div></div></div>";
            return;
          }
          var baseF = "#/report?fr=" + encodeURIComponent(mfr[1]);
          foMrPaint(rec, page, {
            tab: tabF, commAll: /[?&]c=all\b/.test(location.hash || ""),
            href: function (t) { return baseF + "&t=" + t; },
            others: [], back: "#/feed?fr=" + encodeURIComponent(mfr[1])
          });
        }).catch(function (eF) {
          // a swallowed rejection here is a page stuck on "sending for the
          // book" with nothing anywhere to say why
          try { console.warn("friendly report failed", eF); } catch (e2) {}
          if (location.hash !== ownF) return;
          page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
            "<h1 class='fo-mr-head'>The book would not open</h1>" +
            "<p class='fo-mr-dek'>" + E(String((eF && eF.message) || eF).slice(0, 140)) + "</p>" +
            "<div class='fo-mr-foot'><a class='fo-mr-back' href='#/feed?fr=" + encodeURIComponent(mfr[1]) + "'>&#8592; The match</a></div></div></div>";
        });
        return;
      }
      // a served match names itself by nation + the World Service's match id
      var mw = /[?&]w=([^&]+)/.exec(location.hash || "");
      var mn = /[?&]n=([a-z]+)/.exec(location.hash || "");
      if (mw && mn) {
        // the tab belongs in the signature: without it, switching to the
        // scorecard or the commentary matched the cached signature and the
        // page simply did not repaint
        var mtW = /[?&]t=(\w+)/.exec(location.hash || "");
        var sigW = "mrw|" + mn[1] + "|" + mw[1] + "|" + (mtW ? mtW[1] : "sum") +
          "|" + (/[?&]c=all\b/.test(location.hash || "") ? "all" : "key");
        if (page.__foMrSig === sigW && page.querySelector(".fo-mr")) return;
        page.__foMrSig = sigW;
        document.body.classList.add("fo-mr-on");
        foMrRenderServed(mn[1], decodeURIComponent(mw[1]), page);
        return;
      }
      var m = /[?&]i=(\d+)/.exec(location.hash || "");
      var ix = m ? +m[1] : (App.results.length - 1);
      var rec = App.results && App.results[ix];
      var mt = /[?&]t=(\w+)/.exec(location.hash || "");
      var tab = mt ? mt[1] : "sum";
      if (["sum", "card", "comm", "chart", "fantasy"].indexOf(tab) < 0) tab = "sum";
      var commAll = /[?&]c=all\b/.test(location.hash || "");
      var sig = "mr|" + ix + "|" + tab + "|" + (commAll ? "all" : "key") + "|" + (rec ? rec.date : "-");
      if (page.__foMrSig === sig && page.querySelector(".fo-mr")) return;
      page.__foMrSig = sig;
      document.body.classList.add("fo-mr-on");

      if (!rec) {
        page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
          "<h1 class='fo-mr-head'>Nothing to report</h1>" +
          "<p class='fo-mr-dek'>No match has been played yet.</p>" +
          "<div class='fo-mr-foot'><a class='fo-mr-back' href='#/club'>&#8592; Club</a></div></div></div>";
        return;
      }
      foMrPaint(rec, page, {
        tab: tab, commAll: commAll,
        href: function (t) { return "#/report?i=" + ix + "&t=" + t; },
        others: (App.results || []).slice(-7).filter(function (x) { return x.ix !== ix; }).reverse()
      });
    } catch (e) { try { console.warn("foRenderReport", e); } catch (e2) {} }
  };

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").split("?")[0];
    if (h === "#/report") setTimeout(window.foRenderReport, 40);
    else try { document.body.classList.remove("fo-mr-on"); } catch (eR) {}
  });

  function foMrCss() {
    if (document.getElementById("fo-mr-css")) return;
    var s = document.createElement("style"); s.id = "fo-mr-css";
    s.textContent = [
      "html body.fo-mr-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-mr-on #topbar,html body.ftpskin.fo-mr-on #topbar{position:fixed;top:0;left:0;right:0;z-index:60;background:#070c16 !important;border-bottom:1px solid rgba(230,177,94,.16) !important;box-shadow:none !important}",
      "html body.fo-mr-on #page{padding-top:0 !important;margin-top:0 !important}",
      "html body.fo-mr-on #fo-top-status{display:none}",
      "#page .fo-mr{--gold:#E6B15E;--paper:#F4EFE4;position:relative;min-height:100vh;background:#070c16;color:#e9eefa;overflow-x:clip}",
      "#page .fo-mr *{box-sizing:border-box}",
      // THE GROUND IS A PICTURE, NOT A BACKGROUND.
      // It used to be a band of fixed height hung from the top of the page
      // with the type laid over it, which meant that on any screen taller
      // than the headline the story began ON TOP OF THE PAINTING - drop cap
      // and all. Darkening it further would only have traded one problem for
      // another. So the art is now a plate: its own whole 16:9 frame, at full
      // brightness, nothing over it and nothing cropped off it. Every word of
      // the page sits below it, on the page's own colour, where words belong.
      ".fo-mr-hero{position:relative;background:#070c16}",
      ".fo-mr-plate{margin:0;line-height:0;background:#0b1424}",
      // A BAND, NOT A WALL. Sixteen by nine meant 720px of painting on a
      // desk - a whole screen of it before a word of the match. The picture
      // is a header; it keeps its full width and its own crop, and gives the
      // page back the room. Phones stay closer to square, where a letterbox
      // this wide would be a stripe.
      ".fo-mr-plate img{display:block;width:100%;aspect-ratio:32/9;max-height:300px;object-fit:cover;object-position:center 42%}",
      "@media(max-width:760px){.fo-mr-plate img{aspect-ratio:2/1;max-height:210px}}",
      ".fo-mr-in{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:78px clamp(16px,4vw,44px) 60px}",
      ".fo-mr-in--hero{width:100%;padding-top:20px;padding-bottom:18px}",
      ".fo-mr-in--body{padding-top:0}",
      ".fo-mr-mast{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.4em;font-size:clamp(9px,1vw,11.5px);font-weight:600;color:var(--gold)}",
      ".fo-mr-mast em{font-style:normal;color:#8ea3c4;letter-spacing:.28em}",
      ".fo-mr-folio{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.22em;font-size:9.5px;color:#7d8fad;margin-top:7px;padding-bottom:9px;border-bottom:1px solid rgba(230,177,94,.28)}",
      ".fo-mr-head{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;line-height:.86;letter-spacing:-.005em;font-size:clamp(30px,4.6vw,62px);margin:14px 0 0;color:var(--paper);text-wrap:balance}",
      ".fo-mr-dek{font-family:Fraunces,Georgia,'Times New Roman',serif;font-style:normal;font-size:clamp(14px,1.3vw,17px);line-height:1.4;color:#e6dcc6;margin:10px 0 0;max-width:52ch}",
      // scoreline
      ".fo-mr-score{display:flex;align-items:center;gap:clamp(14px,3vw,34px);margin-top:16px;flex-wrap:wrap}",
      ".fo-mr-t{display:flex;flex-direction:column;gap:2px}",
      ".fo-mr-t b{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#93a5c2}",
      ".fo-mr-t u{font-family:Inter,sans-serif;font-weight:700;font-size:clamp(28px,3.4vw,44px);line-height:1;color:#fff;text-decoration:none;font-variant-numeric:tabular-nums}",
      ".fo-mr-t i{font-family:Oswald,sans-serif;font-style:normal;letter-spacing:.16em;font-size:9.5px;color:#6f819e}",
      ".fo-mr-v{font-family:Fraunces,Georgia,serif;font-style:normal;color:#5f7392;font-size:18px}",
      ".fo-mr-verdict{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:11.5px;color:var(--gold);margin-top:11px;padding-top:11px;border-top:1px solid rgba(150,180,225,.16)}",
      // body
      ".fo-mr-body{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:clamp(22px,4vw,52px);margin-top:30px;align-items:start}",
      ".fo-mr-report p{font-family:Fraunces,Georgia,serif;font-size:15.5px;line-height:1.78;color:#c8d3e6;margin:0 0 16px}",
      ".fo-mr-report p.lead{font-size:17px;color:#dbe4f2}",
      ".fo-mr-report p.lead:first-letter{float:left;font-family:Oswald,sans-serif;font-weight:700;font-size:56px;line-height:.82;padding:4px 10px 0 0;color:var(--gold)}",
      ".fo-mr-by{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:9.5px;color:#6f819e;margin-top:22px;padding-top:12px;border-top:1px solid rgba(150,180,225,.14)}",
      // rail
      ".fo-mr-rail{display:flex;flex-direction:column;gap:14px}",
      ".fo-mr-kick{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.26em;font-size:9px;font-weight:600;color:var(--gold)}",
      ".fo-mr-turn,.fo-mr-mom{padding:16px 17px;border-radius:13px;background:linear-gradient(180deg,rgba(16,27,50,.82),rgba(8,14,26,.82));border:1px solid rgba(230,177,94,.24)}",
      ".fo-mr-turn h3,.fo-mr-mom h3{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:19px;line-height:1.1;margin:7px 0 8px;color:var(--paper)}",
      ".fo-mr-turn p{font-family:Fraunces,Georgia,serif;font-size:13px;line-height:1.6;color:#aebbd2;margin:0}",
      ".fo-mr-line{display:grid;grid-template-columns:1fr auto auto;align-items:baseline;gap:9px;padding:5px 0;border-top:1px solid rgba(150,180,225,.12)}",
      ".fo-mr-line span{font-family:Fraunces,Georgia,serif;font-size:13px;color:#c8d3e6;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-mr-line b{font-family:Inter,sans-serif;font-size:14px;color:#fff;font-variant-numeric:tabular-nums}",
      ".fo-mr-line i{font-family:Oswald,sans-serif;font-style:normal;font-size:9.5px;letter-spacing:.1em;color:#6f819e}",
      ".fo-mr-cards{display:grid;gap:12px}",
      ".fo-mr-row2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;align-items:start;margin-bottom:14px}",
      ".fo-mr-cards--row{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:18px}",
      ".fo-mr-side{padding:14px 16px;border-radius:13px;background:linear-gradient(140deg,#0B1D33,#132E4E);border:1px solid rgba(235,194,113,.18);box-shadow:0 14px 30px rgba(11,29,51,.28)}",
      ".fo-mr-sh{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".fo-mr-sh b{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:12.5px;color:var(--paper);flex:1;min-width:0}",
      ".fo-mr-sh u{font-family:Inter,sans-serif;font-weight:700;font-size:19px;color:var(--gold);text-decoration:none;font-variant-numeric:tabular-nums}",
      ".fo-mr-sh i{font-family:Oswald,sans-serif;font-style:normal;font-size:9.5px;letter-spacing:.12em;color:#6f819e}",
      ".fo-mr-sub{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:8.5px;color:#7d8fad;margin:11px 0 2px}",
      // rules + worm
      ".fo-mr-rule{display:flex;align-items:center;gap:15px;margin:38px 0 14px}",
      ".fo-mr-rule:before{content:'';height:1px;flex:0 0 40px;background:linear-gradient(90deg,transparent,rgba(230,177,94,.45))}",
      ".fo-mr-rule:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,rgba(230,177,94,.45),transparent)}",
      ".fo-mr-rule span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.32em;font-size:10.5px;font-weight:600;color:var(--gold);white-space:nowrap}",
      ".fo-mr-worm{padding:14px 12px;border-radius:13px;background:linear-gradient(140deg,#0B1D33,#132E4E);border:1px solid rgba(235,194,113,.18)}",
      ".fo-mr-worm svg{width:100%;height:auto;display:block;overflow:visible}",
      ".fo-mr-worm .g{stroke:rgba(150,180,225,.14);stroke-width:1}",
      ".fo-mr-worm .gl{fill:#6f819e;font-family:Oswald,sans-serif;font-size:8.5px;letter-spacing:.08em}",
      ".fo-mr-worm .w1{fill:none;stroke:#E6B15E;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}",
      ".fo-mr-worm .w2{fill:none;stroke:#6FB4F5;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}",
      ".fo-mr-worm .d1{fill:#E6B15E;stroke:#070c16;stroke-width:1.4}.fo-mr-worm .d2{fill:#6FB4F5;stroke:#070c16;stroke-width:1.4}",
      ".fo-mr-key{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:9px;color:#93a5c2}",
      ".fo-mr-key span{width:16px;height:3px;border-radius:2px;margin-left:8px}",
      ".fo-mr-key span:first-child{margin-left:0}",
      ".fo-mr-key .k1{background:#E6B15E}.fo-mr-key .k2{background:#6FB4F5}",
      ".fo-mr-key em{font-style:normal;color:#6f819e;margin-left:auto}",
      // earlier reports
      ".fo-mr-morelist{display:grid;gap:2px}",
      "html body #page a.fo-mr-mrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:baseline;gap:14px;padding:11px 6px;border-bottom:1px solid rgba(150,180,225,.12);text-decoration:none !important;color:#c8d3e6 !important;transition:background .18s,padding .18s}",
      "html body #page a.fo-mr-mrow:hover{background:linear-gradient(90deg,rgba(230,177,94,.12),transparent);padding-left:12px}",
      ".fo-mr-mrow i{font-family:Oswald,sans-serif;font-style:normal;letter-spacing:.14em;font-size:9px;color:#6f819e;white-space:nowrap}",
      ".fo-mr-mrow b{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:13px;color:var(--paper);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-mr-mrow span{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:12.5px;color:#8ea3c4;white-space:nowrap}",
      // ---- the four views ------------------------------------------------
      ".fo-mr-tabs{display:flex;gap:4px;overflow-x:auto;margin:0 0 22px;padding-bottom:2px;border-bottom:1px solid rgba(230,177,94,.22);scrollbar-width:none}",
      ".fo-mr-tabs::-webkit-scrollbar{display:none}",
      "html body #page a.fo-mr-tab{flex:0 0 auto;min-height:44px;display:inline-flex;align-items:center;padding:0 15px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:10.5px;font-weight:600;color:#8ea3c4 !important;text-decoration:none !important;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}",
      "html body #page a.fo-mr-tab:hover{color:#d6e0f2 !important}",
      "html body #page a.fo-mr-tab.on{color:var(--gold) !important;border-bottom-color:var(--gold)}",
      // the scorecard and fantasy tables are the game's own panels, borrowed
      // whole; these few lines put them on the report's dark ground rather
      // than rebuilding a second scorecard that could disagree with the first
      // THE DATA VIEWS KEEP THE GAME'S OWN DRESS.
      // The scorecard and the fantasy table are the panels the rest of the
      // game uses, borrowed whole rather than rebuilt - a second scorecard is
      // a scorecard that can disagree with the first. They are built for a
      // light card, and the white they carry is spread over a dozen legacy
      // rules; the matchday centre already settled this argument by leaving
      // such panels light on its dark page, so this does the same rather than
      // start a specificity war it would have to keep winning forever. The
      // Report tab is the story and stays dark; these three are the record.
      ".fo-mr-panel{margin-top:4px}",
      "#page .fo-mr-panel .panel{border-radius:12px;overflow:hidden;margin-bottom:12px;box-shadow:0 10px 30px rgba(0,0,0,.34)}",
      // these cards are light, and they are sitting inside a page whose text
      // colour is set for a dark ground - without this every figure on the
      // scorecard is pale blue on cream
      "#page .fo-mr-panel{color:#2a2b2e}",
      // the fantasy table is seven columns wide and a phone is not; let it
      // scroll inside its own card rather than lose the points column off the
      // right-hand edge
      "#page .fo-mr-panel .pad{overflow-x:auto;-webkit-overflow-scrolling:touch}",
      "#page .fo-mr-panel .fo-fp{min-width:440px}",
      // ON A PHONE, POINTS IS THE COLUMN. Seven columns do not fit in 390px
      // and the one that fell off the right-hand edge was the total - the
      // only number the table exists to show. The rank and the club go
      // instead: the rank is the row order, and there are only two clubs in
      // a match, both named at the top of the page.
      "@media(max-width:560px){#page .fo-mr-panel .fo-fp{min-width:0}",
      "#page .fo-mr-panel .fo-fp th:nth-child(1),#page .fo-mr-panel .fo-fp td:nth-child(1),",
      "#page .fo-mr-panel .fo-fp th:nth-child(3),#page .fo-mr-panel .fo-fp td:nth-child(3){display:none}",
      "}",
      // ball by ball, on the same light card as the rest of the record
      ".fo-mr-comm{background:#FFFDF7;border-radius:12px;padding:14px 12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.34)}",
      ".fo-mr-comm .fo-mr-rule{margin:0 0 10px}",
      ".fo-mr-comm .fo-mr-rule span{color:#8a7a55}",
      ".fo-mr-comm .fo-mr-rule:before,.fo-mr-comm .fo-mr-rule:after{background:rgba(20,28,40,.14)}",
      ".fo-mr-commlist{display:flex;flex-direction:column;gap:2px}",
      ".fo-mr-ball{display:grid;grid-template-columns:48px minmax(0,1fr);gap:10px;align-items:baseline;padding:8px 9px;border-radius:7px;background:#F6F2E6}",
      ".fo-mr-ball b{font-family:Inter,sans-serif;font-size:11px;letter-spacing:.06em;color:#7a7566;font-variant-numeric:tabular-nums}",
      ".fo-mr-ball span{font-family:Fraunces,Georgia,serif;font-size:13.5px;line-height:1.6;color:#2a2b2e}",
      ".fo-mr-ball.four{background:#E8F0F8}.fo-mr-ball.four b{color:#2d6a8f}",
      ".fo-mr-ball.six{background:#FBF0D6}.fo-mr-ball.six b{color:#9a6b12}",
      ".fo-mr-ball.wkt{background:#F8E4E0}.fo-mr-ball.wkt b{color:#A6392B}",
      ".fo-mr-ball.mile{box-shadow:inset 3px 0 0 #C9A24B}",
      ".fo-mr-comm .fo-mr-by{color:#7a7566;border-top:1px solid rgba(20,28,40,.12);margin-top:12px;padding-top:10px}",
      ".fo-mr-cf{display:flex;align-items:center;gap:6px;margin:0 0 12px;flex-wrap:wrap}",
      "html body #page .fo-mr-cf a{min-height:36px;display:inline-flex;align-items:center;padding:0 13px;border-radius:999px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:600;color:#5c5647 !important;text-decoration:none !important;background:#EFEADA !important;border:1px solid rgba(20,28,40,.10) !important}",
      "html body #page .fo-mr-cf a.on{color:#101B2D !important;background:#F0B94E !important;border-color:#DDA83F !important}",
      ".fo-mr-cf b{margin-left:auto;font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#8a7a55;font-weight:600}",
      ".fo-mr-innmark{margin:14px 0 6px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:9.5px;font-weight:600;color:#8a7a55;border-bottom:1px solid rgba(20,28,40,.12);padding-bottom:5px}",
      ".fo-mr-innmark:first-child{margin-top:0}",
      ".fo-mr-ball.mark{background:#EDEFF3}.fo-mr-ball.mark b{color:#5b6478}",
      ".fo-mr-ball.mark span{font-style:normal;color:#4a5568}",
      // nothing to show, said plainly
      ".fo-mr-none{background:rgba(12,20,36,.6);border:1px solid rgba(230,177,94,.18);border-radius:14px;padding:26px 22px;text-align:center}",
      ".fo-mr-none h3{margin:0 0 8px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:14px;color:var(--paper)}",
      ".fo-mr-none p{margin:0 auto;max-width:56ch;font-family:Fraunces,Georgia,serif;font-size:13.5px;line-height:1.7;color:#8ea3c4}",
      ".fo-mr-foot{display:flex;gap:10px;flex-wrap:wrap;margin-top:38px}",
      "html body #page a.fo-mr-back{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:10.5px;font-weight:600;color:#F5EFDC !important;text-decoration:none !important;background:rgba(12,20,36,.6);border:1.5px solid rgba(235,194,113,.42) !important;border-radius:999px !important;padding:11px 19px !important;transition:.16s}",
      "html body #page a.fo-mr-back:hover{color:#F3D37A !important;border-color:var(--gold) !important}",
      "html body #page a.fo-mr-jump{display:inline-block;margin:0 0 10px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:10.5px;font-weight:600;color:#0d1526 !important;text-decoration:none !important;background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;border:0 !important;border-radius:999px !important;padding:9px 17px !important;box-shadow:0 5px 16px rgba(230,177,94,.22)}",
      "html body #page a.fo-mr-jump:hover{filter:brightness(1.06)}",
      "@media(max-width:900px){.fo-mr-body{grid-template-columns:1fr;gap:24px}.fo-mr-in{padding-top:62px}",
      ".fo-mr-mrow span{display:none}.fo-mr-report p.lead:first-letter{font-size:44px}}",
      // ==== THE SUMMARY (daylight dashboard) ================================
      "#page .fo-mr--sum{background:#F6F3EB;color:#14243A}",
      ".fo-ms-in{max-width:1400px;margin:0 auto;padding:20px 22px 44px;font-family:Inter,-apple-system,'Segoe UI',sans-serif}",
      ".fo-ms-crumb{font:600 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#8a8272;margin-bottom:10px}",
      ".fo-ms-hero{position:relative;background:linear-gradient(115deg,#0B1D33,#14243A 55%,#1B3A5F);border-radius:18px;overflow:hidden;padding:28px 38px 24px;color:#F6F3EB;box-shadow:0 18px 44px rgba(11,29,51,.35)}",
      ".fo-ms-hero:before{content:'';position:absolute;inset:0;background:radial-gradient(110% 90% at 85% -10%,rgba(232,185,106,.16),transparent 55%)}",
      ".fo-ms-hg{position:relative;display:grid;grid-template-columns:1fr auto 1fr;gap:22px;align-items:center}",
      ".fo-ms-side{display:flex;align-items:center;gap:16px}",
      ".fo-ms-side.right{justify-content:flex-end;text-align:right}",
      ".fo-ms-side .cr svg{filter:drop-shadow(0 4px 12px rgba(0,0,0,.4))}",
      ".fo-ms-side .tn{font:600 12.5px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#c9d0da}",
      ".fo-ms-side .sc{font:800 48px Inter,sans-serif;letter-spacing:-.02em;color:#fff;line-height:1;margin:4px 0 3px;font-variant-numeric:tabular-nums}",
      ".fo-ms-side .ov{font:600 10.5px Oswald,sans-serif;letter-spacing:.16em;color:#8ea0b8}",
      ".fo-ms-mid{text-align:center;max-width:420px}",
      ".fo-ms-mid .mc{font:700 10.5px Oswald,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#E8B96A;margin-bottom:7px}",
      ".fo-ms-mid .vd{font:600 23px Fraunces,Georgia,serif;font-style:normal;color:#fff;line-height:1.2}",
      ".fo-ms-mid .potm{margin-top:12px;padding-top:10px;border-top:1px solid rgba(232,185,106,.35)}",
      ".fo-ms-mid .potm i{display:block;font:700 9px Oswald,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:#E8B96A;font-style:normal;margin-bottom:3px}",
      ".fo-ms-mid .potm b{font:600 15px Fraunces,Georgia,serif;color:#fff}",
      // tab bar in daylight
      ".fo-mr--sum .fo-mr-tabs{margin:14px 0;border-bottom:2px solid #e3dccb}",
      // the sibling tabs live in the same daylight: their bodies sit on white
      // cards under the navy hero, nothing routes back to the old newspaper
      ".fo-mr--sum .fo-ms-tabbody{margin-top:2px}",
      "html body #page a.fo-ms-tml{color:inherit !important;text-decoration:none}",
      "html body #page a.fo-ms-tml:hover{color:#E8B96A !important;text-decoration:underline}",
      ".fo-mr--sum .fo-ms-tabbody .fo-mr-panel{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:16px 18px}",
      ".fo-mr--sum .fo-ms-tabbody .fo-mr-row2{margin-bottom:14px}",
      ".fo-mr--sum .fo-ms-tabbody .fo-mr-turn,.fo-mr--sum .fo-ms-tabbody .fo-mr-mom{background:#14243A;border:none;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.12)}",
      ".fo-mr--sum .fo-ms-tabbody .fo-mr-wormsec{margin-top:14px}",
      "@media(max-width:820px){.fo-mr--sum .fo-ms-tabbody .fo-mr-panel{padding:12px 10px}}",
      "html body #page .fo-mr--sum a.fo-mr-tab{color:#8a8272 !important}",
      "html body #page .fo-mr--sum a.fo-mr-tab:hover{color:#14243A !important}",
      "html body #page .fo-mr--sum a.fo-mr-tab.on{color:#C9571F !important;border-bottom-color:#C9571F}",
      // grid + cards
      ".fo-ms-g{display:grid;grid-template-columns:1.05fr 1fr 1.35fr;gap:14px;align-items:start}",
      ".fo-ms-card.fo-ms-wide{grid-column:1/-1}",
      ".fo-ms-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);overflow:hidden}",
      ".fo-ms-ck{display:flex;justify-content:space-between;align-items:center;padding:12px 15px 9px;font:700 11px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#14243A;border-bottom:1px solid #eee7d9}",
      ".fo-ms-note{font:500 9px Oswald,sans-serif;letter-spacing:.1em;color:#8E1F13;font-style:normal}",
      ".fo-ms-km{display:grid;grid-template-columns:36px 28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 13px;border-bottom:1px solid #f3eee1}",
      ".fo-ms-km .ov{font:700 10.5px Inter,sans-serif;color:#8a8272;font-variant-numeric:tabular-nums}",
      ".fo-ms-km .bb{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 10.5px Inter,sans-serif;color:#fff}",
      ".fo-ms-km .bb.wk{background:#8E1F13}.fo-ms-km .bb.f4{background:#C9571F}",
      ".fo-ms-km .bb.f6{background:#14243A;border:1.5px solid #E8B96A;color:#E8B96A}",
      ".fo-ms-km .bb.oth{background:#efe9da;color:#6d6455}",
      ".fo-ms-km .bb.ms{background:#F8ECD4;color:#8a6a1f;border:1px solid #e8d5a8;border-radius:8px;font-size:9px}",
      ".fo-ms-km .tx b{display:block;font:700 12px Inter,sans-serif;color:#14243A}",
      ".fo-ms-km .tx>span{display:block;font:400 11px/1.45 Inter,sans-serif;color:#6d6455}",
      ".fo-ms-km .sc{text-align:right;font:700 11.5px Inter,sans-serif;color:#14243A;white-space:nowrap;font-variant-numeric:tabular-nums}",
      ".fo-ms-km .sc i{display:block;font:400 9.5px Inter,sans-serif;color:#8a8272;font-style:normal}",
      ".fo-ms-more{display:block;margin:10px 13px 13px;text-align:center;font:700 10px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#C9571F !important;border:1px solid #C9571F;border-radius:9px;padding:9px;text-decoration:none !important}",
      ".fo-ms-more:hover{background:#C9571F;color:#fff !important}",
      ".fo-ms-prose{padding:11px 15px 14px;font:400 12.5px/1.65 Fraunces,Georgia,serif;color:#4c4437}",
      ".fo-ms-dim{padding:14px;font:400 12px Fraunces,Georgia,serif;color:#8a8272}",
      ".fo-ms-ph{padding:8px 15px 4px;font:700 9.5px Oswald,sans-serif;letter-spacing:.2em;color:#C9571F}",
      ".fo-ms-pf{display:flex;align-items:center;gap:11px;padding:8px 15px;border-bottom:1px solid #f3eee1}",
      ".fo-ms-pf .face{width:38px;height:38px;border-radius:50%;overflow:hidden;background:#e8e2d4;border:2px solid #d9d0bc;flex:0 0 38px}",
      ".fo-ms-pf .face img{width:100%;height:100%;object-fit:cover;object-position:top}",
      ".fo-ms-pf .id{min-width:0}",
      ".fo-ms-pf .id b{display:block;font:700 12.5px Inter,sans-serif;color:#14243A}",
      ".fo-ms-pf .id>span{display:block;font:400 10.5px Inter,sans-serif;color:#8a8272}",
      ".fo-ms-pf .num{margin-left:auto;text-align:right;font:400 12px Inter,sans-serif;color:#8a8272;white-space:nowrap}",
      ".fo-ms-pf .num b{font:800 17px Inter,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      ".fo-ms-pf .num i{font-style:normal;font-size:10px}",
      ".fo-ms-st .st{text-decoration:none;font-size:9.5px;letter-spacing:.4px;white-space:nowrap}",
      ".fo-ms-st .st em{font-style:normal;color:#e3dccb}",
      ".fo-ms-st .st em.f{color:#E8B96A}",
      ".fo-ms-st .st em.h{background:linear-gradient(90deg,#E8B96A 50%,#e3dccb 50%);-webkit-background-clip:text;background-clip:text;color:transparent}",
      ".fo-ms-kv{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 15px;font:500 12px Inter,sans-serif;color:#6d6455;border-bottom:1px solid #f3eee1}",
      ".fo-ms-kv b{font:700 12px Inter,sans-serif;color:#14243A;text-align:right}",
      ".fo-ms-kv b u{text-decoration:none;display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;font:800 9.5px Inter,sans-serif;margin-left:3px;color:#fff;background:#b0a794}",
      ".fo-ms-kv b u.fW{background:#177A57}.fo-ms-kv b u.fL{background:#C0392E}",
      ".fo-ms-pad{padding:12px 14px}",
      ".fo-ms-legend{display:flex;gap:14px;align-items:center;font:600 9.5px Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a8272;margin-top:6px;flex-wrap:wrap}",
      ".fo-ms-legend i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:5px;vertical-align:2px}",
      ".fo-ms-legend em{font-style:normal;font-family:Fraunces,Georgia,serif;text-transform:none;letter-spacing:0;color:#b0a794;margin-left:auto}",
      ".fo-ms-dark{background:#14243A;color:#F6F3EB;padding:14px 16px}",
      ".fo-ms-dark.first{border-top:1px solid #eee7d9}",
      ".fo-ms-dark .dk{font:700 9.5px Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A;margin-bottom:9px}",
      ".fo-ms-pr{display:grid;grid-template-columns:minmax(0,1.3fr) 34px 1fr;gap:9px;align-items:center;font:600 11px Inter,sans-serif;margin:6px 0}",
      ".fo-ms-pr>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#c9d0da}",
      ".fo-ms-pr b{text-align:right;font-variant-numeric:tabular-nums;color:#fff}",
      ".fo-ms-pr .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}",
      ".fo-ms-pr .bar i{display:block;height:100%;background:#4DA67E}",
      ".fo-ms-dark .nf{display:flex;align-items:center;gap:14px}",
      ".fo-ms-dark .nf b{display:block;font:700 15px Inter,sans-serif;color:#fff}",
      ".fo-ms-dark .nf span{font:400 11px Inter,sans-serif;color:#9fb0c5}",
      ".fo-ms-dark .vs{margin-left:auto;font:800 20px Fraunces,Georgia,serif;color:#E8B96A}",
      "html body #page .fo-ms-dark a.go{display:block;margin-top:11px;text-align:center;font:700 10px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#E8B96A !important;border:1px solid rgba(232,185,106,.6);border-radius:9px;padding:8px;text-decoration:none !important}",
      "html body #page a.fo-mr-back.day{background:#FFFEFC;border-color:#d9d0bc !important;color:#4c4437 !important}",
      "html body #page a.fo-mr-back.day:hover{color:#C9571F !important;border-color:#C9571F !important}",
      "@media(max-width:1100px){.fo-ms-g{grid-template-columns:1fr 1fr}}",
      "@media(max-width:820px){",
      ".fo-ms-in{padding:14px 10px 34px}",
      ".fo-ms-g{grid-template-columns:1fr}",
      ".fo-ms-hero{padding:20px 18px 18px}",
      ".fo-ms-hg{grid-template-columns:1fr 1fr;gap:12px}",
      ".fo-ms-mid{grid-column:1/-1;grid-row:2;max-width:none;border-top:1px solid rgba(232,185,106,.3);padding-top:12px}",
      ".fo-ms-side .sc{font-size:36px}",
      ".fo-ms-side .cr{display:none}",
      ".fo-ms-mid .vd{font-size:19px}",
      "}"
    ].join("");
    document.head.appendChild(s);
  }

  // The scorecard is painted by whichever of several historic overrides wins,
  // so rather than edit one of them, the link is added to the finished page.
  function foMrScorecardLink() {
    try {
      var h = location.hash || "";
      if (h.split("?")[0] !== "#/scorecard") return;
      var m = /[?&]i=(\d+)/.exec(h); if (!m) return;
      var page = document.getElementById("page"); if (!page) return;
      if (page.querySelector(".fo-mr-jump")) return;
      foMrCss();   // the chip is styled by the report sheet, which may not be in yet
      var sub = page.querySelector(".navsub") || page.firstElementChild; if (!sub) return;
      var a = document.createElement("a");
      a.className = "fo-mr-jump"; a.href = "#/report?i=" + (+m[1]);
      a.textContent = "Read the match report \u203A";
      sub.parentNode.insertBefore(a, sub.nextSibling);
    } catch (e) {}
  }
  setInterval(foMrScorecardLink, 700);
  window.addEventListener("hashchange", function () { setTimeout(foMrScorecardLink, 60); });

  // let the rest of the app link to a report without knowing the module exists
  try {
    window.foMatchFacts = foMrFacts;
    window.foMatchHeadline = foMrHeadline;
  } catch (eX) {}
})();

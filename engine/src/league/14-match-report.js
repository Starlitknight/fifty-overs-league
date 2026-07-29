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
      f.mom = { name: String(rawMom).replace(/\s*\(\s*[\d.]+\s*pts?\s*\)\s*$/i, "").trim() };
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
  function foMrParagraphs(f) {
    var out = [], a = f.first, b = f.second;
    var cond = [];
    if (f.weather) cond.push(String(f.weather).toLowerCase());
    if (f.pitch) cond.push("a " + String(f.pitch).replace(/([A-Z])/g, " $1").toLowerCase().trim() + " pitch");

    // 1. the first innings
    if (a) {
      var s = a.team + " batted first" + (cond.length ? " at " + f.ground + ", " + cond.join(" and ") + "," : " at " + f.ground) +
        " and made " + a.runs + (a.allOut ? " all out" : "/" + a.wkts) + " from " + a.overs + " overs";
      s += a.phases ? ", " + foMrPowerplay(a.phases.pp) + " (" + a.phases.pp.runs + "/" + a.phases.pp.wkts + ")" : "";
      s += ".";
      if (a.top && a.top.r > 0) {
        s += " " + a.top.p.name + " top-scored with " + a.top.r + " from " + a.top.b + " " + foMrPlural(a.top.b, "ball") +
          ((a.top.f6 || 0) >= 2 ? ", clearing the rope " + a.top.f6 + " times" : (a.top.f4 || 0) >= 6 ? ", " + a.top.f4 + " of them to the fence" : "") + ".";
      }
      if (a.stand && a.stand.runs >= 45) {
        s += " The stand that built it was " + a.stand.runs + " for the " + foMrOrd(a.stand.w) + " wicket between " + a.stand.pair.replace(" / ", " and ") + ".";
      }
      if (a.phases && a.phases.death && a.phases.death.runs >= 60) {
        s += " The last ten brought " + a.phases.death.runs + ".";
      }
      out.push(s);
    }

    // 2. the bowling that shaped it
    if (a && a.best && a.best.w > 0) {
      var s2 = a.best.p.name + " was the pick of the bowling with " + a.best.w + " for " + a.best.r +
        " from " + foMrOvers(a.best.b) + " overs";
      var econ = a.best.b ? (a.best.r / (a.best.b / 6)) : 0;
      s2 += econ <= 4.2 ? ", and went at " + econ.toFixed(2) + " an over doing it." : ".";
      if (a.collapse && a.collapse.wkts >= 3) {
        s2 += " " + a.team + " lost " + foMrWord(a.collapse.wkts) + " wickets for " + a.collapse.runs +
          " between the " + foMrOrd(Math.floor(a.collapse.firstOv)) + " and " + foMrOrd(Math.floor(a.collapse.lastOv)) + " overs";
        s2 += a.allOut ? " and never recovered." : ", which is where the innings stopped growing.";
      } else if (a.ducks >= 2) {
        s2 += " Two of the order went without scoring.";
      }
      out.push(s2);
    }

    // 3. the chase
    if (a && b) {
      var need = (a.runs + 1), reqRate = need * 6 / 300;
      var s3 = "Chasing " + need + " at " + reqRate.toFixed(2) + " an over, " + b.team + " ";
      if (f.chased) {
        s3 += "got there with " + f.ballsLeft + " " + foMrPlural(f.ballsLeft, "ball") + " and " + (10 - b.wkts) + " " +
          foMrPlural(10 - b.wkts, "wicket") + " in hand";
      } else {
        s3 += "finished on " + b.runs + (b.allOut ? " all out" : "/" + b.wkts) + ", " + (a.runs - b.runs) + " short";
      }
      s3 += b.phases ? ", having been " + b.phases.pp.runs + "/" + b.phases.pp.wkts + " after ten." : ".";
      if (b.top && b.top.r >= 30) {
        s3 += " " + b.top.p.name + " made " + b.top.r + " from " + b.top.b +
          (b.top.notOut === undefined && !b.top.out ? " not out" : "") + ".";
      }
      if (b.collapse && b.collapse.wkts >= 3 && !f.chased) {
        s3 += " The chase came apart when " + foMrWord(b.collapse.wkts) + " went down for " + b.collapse.runs +
          ", the last of them " + foMrSurname(b.collapse.lastMan) + " in the " + foMrOrd(Math.floor(b.collapse.lastOv)) + ".";
      }
      if (b.best && b.best.w >= 3 && !f.chased) {
        s3 += " " + b.best.p.name + " finished with " + b.best.w + " for " + b.best.r + ".";
      }
      out.push(s3);
    }

    // 4. the verdict
    if (a && b) {
      var s4 = f.tied ? "The match was tied - " + a.runs + " apiece."
        : f.winner + " win by " + f.margin + " " + f.marginUnit + ".";
      if (f.mom) {
        var mline = [];
        if (f.mom.bat != null && f.mom.bat > 0) mline.push(f.mom.bat + (f.mom.notOut ? "*" : "") + " from " + f.mom.balls);
        if (f.mom.w > 0) mline.push(f.mom.w + " for " + f.mom.conc);
        s4 += " " + f.mom.name + " took the match award" + (mline.length ? " for " + mline.join(" and ") : "") + ".";
      }
      if (!f.tight && !f.chased && f.margin >= 80) s4 += " It was over long before it ended.";
      else if (f.tight) s4 += " Either side could have taken it.";
      out.push(s4);
    }
    return out.slice(0, FO_MR_MAXP);
  }


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
    var html = "";
    try { if (typeof window.foFantasyPanel === "function") html = window.foFantasyPanel(inn); } catch (e) {}
    if (!html || /No fantasy data/.test(html)) {
      return foMrNone("No fantasy points for this match", "Its innings were not recorded in enough detail to score.");
    }
    return html;
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
  function foMrReplayServed(nat, row, seasonNo) {
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
      var matchId = nat + ":s" + (seasonNo | 0) + ":r" + (row.round | 0) + ":h" + hSd.slot + "a" + aSd.slot;
      var seed = (G.hash ? G.hash(matchId) : 0) || 1;
      var ground = (hSd.city || row.home) + " Ground";
      var out = G.simWorld({ name: row.home, ground: ground, players: sqH },
                           { name: row.away, players: sqA }, "balanced", "Sunny", seed, null);
      if (!out || !out.innings || !out.result) return null;
      // the agreement check: the same verdict, to the word
      if (String(out.result.text || "") !== String(row.text || "")) return null;
      return { ix: -1, date: "", home: row.home, away: row.away, ground: ground,
        pitch: "balanced", weather: "Sunny", seed: seed, result: out.result,
        innings: out.innings, worm: out.worm, log: out.log,
        comp: "league", round: (row.round | 0) - 1, seasonNo: seasonNo | 0 };
    } catch (e) { return null; }
  }
  function foMrRenderServed(nat, id, page) {
    var hit = foMrServedRow(nat, id);
    if (!hit) {
      page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
        "<h1 class='fo-mr-head'>That match is not in the record yet</h1>" +
        "<p class='fo-mr-dek'>The World Service has not published this round. Try again once it has settled.</p>" +
        "<div class='fo-mr-foot'><a class='fo-mr-back' href='#/league?t=results'>&#8592; Results</a></div></div></div>";
      return;
    }
    var rep = foMrReplayServed(nat, hit.row, hit.season);
    if (rep) {
      var mt2 = /[?&]t=(\w+)/.exec(location.hash || "");
      var tab2 = mt2 ? mt2[1] : "report";
      if (["report", "card", "comm", "fantasy"].indexOf(tab2) < 0) tab2 = "report";
      var base2 = "#/report?n=" + encodeURIComponent(nat) + "&w=" + encodeURIComponent(id);
      foMrPaint(rep, page, {
        tab: tab2,
        commAll: /[?&]c=all\b/.test(location.hash || ""),
        href: function (t) { return base2 + "&t=" + t; },
        others: [],
        back: "#/league?t=results"
      });
      return;
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
      "<div class='fo-mr-folio'>Season " + (hit.season | 0) + " &middot; Round " + (r.round | 0) + " &middot; League</div>" +
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

  // ONE PAINTER, TWO SOURCES. A match played on this device and a world
  // match rebuilt from its seed produce the same record, so they get the
  // same page - the report, the scorecard, the commentary, the run chart
  // and the fantasy points - and only the links differ.
  function foMrPaint(rec, page, O) {
    var tab = O.tab, commAll = O.commAll;
      var f = foMrFacts(rec);
      if (!f) { page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><h1 class='fo-mr-head'>Report unavailable</h1>" +
        "<p class='fo-mr-dek'>That match did not finish an innings.</p></div></div>"; return; }

      var hd = foMrHeadline(f), paras = foMrParagraphs(f), turn = foMrTurning(f);
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
      var TABS = [["report", "Report"], ["card", "Scorecard"], ["comm", "Commentary"], ["fantasy", "Fantasy"]];
      var tabBar = "<nav class='fo-mr-tabs' aria-label='Match views'>" + TABS.map(function (t) {
        return "<a class='fo-mr-tab" + (t[0] === tab ? " on" : "") + "' href='" + O.href(t[0]) + "'" +
          (t[0] === tab ? " aria-current='page'" : "") + ">" + t[1] + "</a>";
      }).join("") + "</nav>";

      var main;
      if (tab === "card") {
        main = "<div class='fo-mr-panel'>" + foMrScorecard(rec) + "</div>";
      } else if (tab === "comm") {
        main = "<div class='fo-mr-panel'>" + foMrCommentary(rec, f, commAll) + "</div>";
      } else if (tab === "fantasy") {
        main = "<div class='fo-mr-panel'>" + foMrFantasy(rec) + "</div>";
      } else {
        main =
          "<div class='fo-mr-body'>" +
          "<article class='fo-mr-report'>" +
          paras.map(function (p, i) { return "<p" + (i === 0 ? " class='lead'" : "") + ">" + E(p) + "</p>"; }).join("") +
          "<div class='fo-mr-by'>Report by Eleanor March &middot; written from the ball-by-ball record</div>" +
          "</article>" +
          "<aside class='fo-mr-rail'>" +
          turnCard + momCard +
          "<div class='fo-mr-cards'>" + foMrCard(f.first) + foMrCard(f.second) + "</div>" +
          "</aside>" +
          "</div>" +
          "<section class='fo-mr-wormsec'><div class='fo-mr-rule'><span>How it was scored</span></div>" + foMrWorm(f) + "</section>" +
          moreHTML;
      }

      page.innerHTML =
        "<div class='fo-mr'>" +
        // THE ARTWORK IS A HEADER, NOT A BACKGROUND. It used to be a band of
        // fixed height hung from the top of the page, which meant that on any
        // screen taller than the headline the story began ON TOP OF IT - the
        // drop cap and the whole first paragraph laid over a painting. Now the
        // art lives inside the hero and is bounded by it, so no matter the
        // viewport the writing starts below the picture, on solid ground.
        "<header class='fo-mr-hero'>" +
        "<figure class='fo-mr-plate'><img src='" + foMrGroundArt(f) + "' alt='' " +
        "onerror=\"this.parentNode.style.display='none'\"></figure>" +
        "<div class='fo-mr-in fo-mr-in--hero'>" +
        "<div class='fo-mr-mast'>The Fifty Overs Journal <em>&middot; Match Report</em></div>" +
        "<div class='fo-mr-folio'>" + E(f.date || "") + (f.ground ? " &middot; " + E(f.ground) : "") +
        (f.comp ? " &middot; " + E(String(f.comp).charAt(0).toUpperCase() + String(f.comp).slice(1)) : "") + "</div>" +
        "<h1 class='fo-mr-head'>" + E(hd.head) + "</h1>" +
        "<p class='fo-mr-dek'>" + E(hd.dek) + "</p>" +
        scoreline +
        "</div></header>" +
        "<div class='fo-mr-in fo-mr-in--body'>" +
        tabBar + main +
        "<div class='fo-mr-foot'>" +
        (tab === "report" ? "<a class='fo-mr-back' href='" + O.href("card") + "'>Full scorecard</a>"
                          : "<a class='fo-mr-back' href='" + O.href("report") + "'>The report</a>") +
        "<a class='fo-mr-back' href='" + (O.back || "#/lore") + "'>" + (O.backLbl || "The Journal") + "</a>" +
        "<a class='fo-mr-back' href='#/club'>Club</a>" +
        "</div></div></div>";

      // The topbar stays fixed so the nav is always in reach, and it is opaque
      // now rather than a gradient - a gradient over the top of the painting
      // is still something laid over the painting. So the page starts below
      // it, measured rather than guessed.
      try {
        var tb = document.getElementById("topbar"), mr = page.querySelector(".fo-mr");
        if (tb && mr) mr.style.paddingTop = (tb.offsetHeight || 0) + "px";
      } catch (eTb) {}
  }

  window.foRenderReport = function () {
    try {
      try { if (typeof window.foCxNav === "function") window.foCxNav(); } catch (eN) {}
      if ((location.hash || "").split("?")[0] !== "#/report") return;
      var page = document.getElementById("page"); if (!page) return;
      foMrCss();
      // a served match names itself by nation + the World Service's match id
      var mw = /[?&]w=([^&]+)/.exec(location.hash || "");
      var mn = /[?&]n=([a-z]+)/.exec(location.hash || "");
      if (mw && mn) {
        // the tab belongs in the signature: without it, switching to the
        // scorecard or the commentary matched the cached signature and the
        // page simply did not repaint
        var mtW = /[?&]t=(\w+)/.exec(location.hash || "");
        var sigW = "mrw|" + mn[1] + "|" + mw[1] + "|" + (mtW ? mtW[1] : "report") +
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
      var tab = mt ? mt[1] : "report";
      if (["report", "card", "comm", "fantasy"].indexOf(tab) < 0) tab = "report";
      var commAll = /[?&]c=all\b/.test(location.hash || "");
      var sig = "mr|" + ix + "|" + tab + "|" + (commAll ? "all" : "key") + "|" + (rec ? rec.date : "-");
      if (page.__foMrSig === sig && page.querySelector(".fo-mr")) return;
      page.__foMrSig = sig;
      document.body.classList.add("fo-mr-on");

      if (!rec) {
        page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><div class='fo-mr-mast'>The Fifty Overs Journal</div>" +
          "<h1 class='fo-mr-head'>Nothing to report</h1>" +
          "<p class='fo-mr-dek'>No match has been played yet. Every finished match is written up here the moment it ends.</p>" +
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
      ".fo-mr-plate img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;object-position:center}",
      ".fo-mr-in{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:78px clamp(16px,4vw,44px) 60px}",
      ".fo-mr-in--hero{width:100%;padding-top:26px;padding-bottom:22px}",
      ".fo-mr-in--body{padding-top:0}",
      ".fo-mr-mast{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.4em;font-size:clamp(9px,1vw,11.5px);font-weight:600;color:var(--gold)}",
      ".fo-mr-mast em{font-style:normal;color:#8ea3c4;letter-spacing:.28em}",
      ".fo-mr-folio{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.22em;font-size:9.5px;color:#7d8fad;margin-top:9px;padding-bottom:12px;border-bottom:1px solid rgba(230,177,94,.28)}",
      ".fo-mr-head{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;line-height:.86;letter-spacing:-.005em;font-size:clamp(38px,7.4vw,104px);margin:20px 0 0;color:var(--paper);text-wrap:balance}",
      ".fo-mr-dek{font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:clamp(15px,1.7vw,22px);line-height:1.44;color:#e6dcc6;margin:14px 0 0;max-width:44ch}",
      // scoreline
      ".fo-mr-score{display:flex;align-items:center;gap:clamp(14px,3vw,34px);margin-top:26px;flex-wrap:wrap}",
      ".fo-mr-t{display:flex;flex-direction:column;gap:2px}",
      ".fo-mr-t b{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#93a5c2}",
      ".fo-mr-t u{font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(28px,3.4vw,44px);line-height:1;color:#fff;text-decoration:none;font-variant-numeric:tabular-nums}",
      ".fo-mr-t i{font-family:Oswald,sans-serif;font-style:normal;letter-spacing:.16em;font-size:9.5px;color:#6f819e}",
      ".fo-mr-v{font-family:Georgia,serif;font-style:italic;color:#5f7392;font-size:18px}",
      ".fo-mr-verdict{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:11.5px;color:var(--gold);margin-top:14px;padding-top:14px;border-top:1px solid rgba(150,180,225,.16)}",
      // body
      ".fo-mr-body{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:clamp(22px,4vw,52px);margin-top:30px;align-items:start}",
      ".fo-mr-report p{font-family:Georgia,serif;font-size:15.5px;line-height:1.78;color:#c8d3e6;margin:0 0 16px}",
      ".fo-mr-report p.lead{font-size:17px;color:#dbe4f2}",
      ".fo-mr-report p.lead:first-letter{float:left;font-family:Oswald,sans-serif;font-weight:700;font-size:56px;line-height:.82;padding:4px 10px 0 0;color:var(--gold)}",
      ".fo-mr-by{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:9.5px;color:#6f819e;margin-top:22px;padding-top:12px;border-top:1px solid rgba(150,180,225,.14)}",
      // rail
      ".fo-mr-rail{display:flex;flex-direction:column;gap:14px}",
      ".fo-mr-kick{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.26em;font-size:9px;font-weight:600;color:var(--gold)}",
      ".fo-mr-turn,.fo-mr-mom{padding:16px 17px;border-radius:13px;background:linear-gradient(180deg,rgba(16,27,50,.82),rgba(8,14,26,.82));border:1px solid rgba(230,177,94,.24)}",
      ".fo-mr-turn h3,.fo-mr-mom h3{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:19px;line-height:1.1;margin:7px 0 8px;color:var(--paper)}",
      ".fo-mr-turn p{font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#aebbd2;margin:0}",
      ".fo-mr-line{display:grid;grid-template-columns:1fr auto auto;align-items:baseline;gap:9px;padding:5px 0;border-top:1px solid rgba(150,180,225,.12)}",
      ".fo-mr-line span{font-family:Georgia,serif;font-size:13px;color:#c8d3e6;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-mr-line b{font-family:Oswald,sans-serif;font-size:14px;color:#fff;font-variant-numeric:tabular-nums}",
      ".fo-mr-line i{font-family:Oswald,sans-serif;font-style:normal;font-size:9.5px;letter-spacing:.1em;color:#6f819e}",
      ".fo-mr-cards{display:grid;gap:12px}",
      ".fo-mr-side{padding:14px 16px;border-radius:13px;background:rgba(9,15,28,.7);border:1px solid rgba(150,180,225,.16)}",
      ".fo-mr-sh{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".fo-mr-sh b{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:12.5px;color:var(--paper);flex:1;min-width:0}",
      ".fo-mr-sh u{font-family:Oswald,sans-serif;font-weight:700;font-size:19px;color:var(--gold);text-decoration:none;font-variant-numeric:tabular-nums}",
      ".fo-mr-sh i{font-family:Oswald,sans-serif;font-style:normal;font-size:9.5px;letter-spacing:.12em;color:#6f819e}",
      ".fo-mr-sub{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:8.5px;color:#7d8fad;margin:11px 0 2px}",
      // rules + worm
      ".fo-mr-rule{display:flex;align-items:center;gap:15px;margin:38px 0 14px}",
      ".fo-mr-rule:before{content:'';height:1px;flex:0 0 40px;background:linear-gradient(90deg,transparent,rgba(230,177,94,.45))}",
      ".fo-mr-rule:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,rgba(230,177,94,.45),transparent)}",
      ".fo-mr-rule span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.32em;font-size:10.5px;font-weight:600;color:var(--gold);white-space:nowrap}",
      ".fo-mr-worm{padding:14px 12px;border-radius:13px;background:rgba(9,15,28,.66);border:1px solid rgba(150,180,225,.16)}",
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
      ".fo-mr-mrow span{font-family:Georgia,serif;font-style:italic;font-size:12.5px;color:#8ea3c4;white-space:nowrap}",
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
      ".fo-mr-ball b{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.06em;color:#7a7566;font-variant-numeric:tabular-nums}",
      ".fo-mr-ball span{font-family:Georgia,serif;font-size:13.5px;line-height:1.6;color:#2a2b2e}",
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
      ".fo-mr-ball.mark span{font-style:italic;color:#4a5568}",
      // nothing to show, said plainly
      ".fo-mr-none{background:rgba(12,20,36,.6);border:1px solid rgba(230,177,94,.18);border-radius:14px;padding:26px 22px;text-align:center}",
      ".fo-mr-none h3{margin:0 0 8px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:14px;color:var(--paper)}",
      ".fo-mr-none p{margin:0 auto;max-width:56ch;font-family:Georgia,serif;font-size:13.5px;line-height:1.7;color:#8ea3c4}",
      ".fo-mr-foot{display:flex;gap:10px;flex-wrap:wrap;margin-top:38px}",
      "html body #page a.fo-mr-back{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:10.5px;font-weight:600;color:#F5EFDC !important;text-decoration:none !important;background:rgba(12,20,36,.6);border:1.5px solid rgba(235,194,113,.42) !important;border-radius:999px !important;padding:11px 19px !important;transition:.16s}",
      "html body #page a.fo-mr-back:hover{color:#F3D37A !important;border-color:var(--gold) !important}",
      "html body #page a.fo-mr-jump{display:inline-block;margin:0 0 10px;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.18em;font-size:10.5px;font-weight:600;color:#0d1526 !important;text-decoration:none !important;background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;border:0 !important;border-radius:999px !important;padding:9px 17px !important;box-shadow:0 5px 16px rgba(230,177,94,.22)}",
      "html body #page a.fo-mr-jump:hover{filter:brightness(1.06)}",
      "@media(max-width:900px){.fo-mr-body{grid-template-columns:1fr;gap:24px}.fo-mr-in{padding-top:62px}",
      ".fo-mr-mrow span{display:none}.fo-mr-report p.lead:first-letter{font-size:44px}}"
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

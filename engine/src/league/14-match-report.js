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

  window.foRenderReport = function () {
    try {
      try { if (typeof window.foCxNav === "function") window.foCxNav(); } catch (eN) {}
      if ((location.hash || "").split("?")[0] !== "#/report") return;
      var page = document.getElementById("page"); if (!page) return;
      foMrCss();
      var m = /[?&]i=(\d+)/.exec(location.hash || "");
      var ix = m ? +m[1] : (App.results.length - 1);
      var rec = App.results && App.results[ix];
      var sig = "mr|" + ix + "|" + (rec ? rec.date : "-");
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
      var f = foMrFacts(rec);
      if (!f) { page.innerHTML = "<div class='fo-mr'><div class='fo-mr-in'><h1 class='fo-mr-head'>Report unavailable</h1>" +
        "<p class='fo-mr-dek'>That match did not finish an innings.</p></div></div>"; return; }

      var hd = foMrHeadline(f), paras = foMrParagraphs(f), turn = foMrTurning(f);
      var others = (App.results || []).slice(-7).filter(function (x) { return x.ix !== ix; }).reverse();

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

      page.innerHTML =
        "<div class='fo-mr'>" +
        "<div class='fo-mr-bg' style='background-image:url(" + foMrGroundArt(f) + ")'></div><div class='fo-mr-veil'></div>" +
        "<div class='fo-mr-in'>" +
        "<div class='fo-mr-mast'>The Fifty Overs Journal <em>&middot; Match Report</em></div>" +
        "<div class='fo-mr-folio'>" + E(f.date || "") + (f.ground ? " &middot; " + E(f.ground) : "") +
        (f.comp ? " &middot; " + E(String(f.comp).charAt(0).toUpperCase() + String(f.comp).slice(1)) : "") + "</div>" +
        "<h1 class='fo-mr-head'>" + E(hd.head) + "</h1>" +
        "<p class='fo-mr-dek'>" + E(hd.dek) + "</p>" +
        scoreline +
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
        moreHTML +
        "<div class='fo-mr-foot'>" +
        "<a class='fo-mr-back' href='#/scorecard?i=" + ix + "'>Full scorecard</a>" +
        "<a class='fo-mr-back' href='#/lore'>The Journal</a>" +
        "<a class='fo-mr-back' href='#/club'>Club</a>" +
        "</div></div></div>";
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
      "html body.fo-mr-on #topbar,html body.ftpskin.fo-mr-on #topbar{position:fixed;top:0;left:0;right:0;z-index:60;background:linear-gradient(180deg,rgba(4,10,20,.86),rgba(4,10,20,.3) 62%,transparent) !important;border-bottom:0 !important;box-shadow:none !important}",
      "html body.fo-mr-on #page{padding-top:0 !important;margin-top:0 !important}",
      "html body.fo-mr-on #fo-top-status{display:none}",
      "#page .fo-mr{--gold:#E6B15E;--paper:#F4EFE4;position:relative;min-height:100vh;background:#070c16;color:#e9eefa;overflow-x:clip}",
      "#page .fo-mr *{box-sizing:border-box}",
      ".fo-mr-bg{position:absolute;top:0;left:0;right:0;height:min(62vh,560px);background-size:cover;background-position:center 42%;z-index:0;filter:saturate(.9)}",
      ".fo-mr-veil{position:absolute;top:0;left:0;right:0;height:min(62vh,560px);z-index:0;background:linear-gradient(180deg,rgba(7,12,22,.26) 0%,rgba(7,12,22,.16) 34%,rgba(7,12,22,.40) 78%,#E9E4D8 100%)}",
      ".fo-mr-in{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:78px clamp(16px,4vw,44px) 60px}",
      ".fo-mr-mast{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.4em;font-size:clamp(9px,1vw,11.5px);font-weight:600;color:var(--gold)}",
      ".fo-mr-mast em{font-style:normal;color:#8ea3c4;letter-spacing:.28em}",
      ".fo-mr-folio{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.22em;font-size:9.5px;color:#7d8fad;margin-top:9px;padding-bottom:12px;border-bottom:1px solid rgba(230,177,94,.28)}",
      ".fo-mr-head{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;line-height:.86;letter-spacing:-.005em;font-size:clamp(38px,7.4vw,104px);margin:20px 0 0;color:var(--paper);text-shadow:0 6px 34px rgba(0,0,0,.6);text-wrap:balance}",
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

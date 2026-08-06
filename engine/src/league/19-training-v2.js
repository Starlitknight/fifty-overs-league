/* ============================================================================
   THE NETS (#/training) — A LEDGER, AN ACADEMY AND A BOOK.

   THE PAGE IS A CHORE, and it is built like one: you come here to set fifteen
   men and leave. So the plan table is the page - one row a man, two pickers a
   row - and everything else stands out of its way. Above it, the one building
   that touches the nets. Below it, the charts, which are a reward for having
   played rather than a thing to read on the way in.

   TWO DECISIONS A MAN, AND ONLY TWO:
     - his PROGRAMME, which is what he works on. Eight of them, the way From
       the Pavilion does it: one a trainable skill, plus Rest.
     - his FOCUS, which is where inside that programme the work lands. Auto
       spreads it by the programme's own weights; naming a sub-skill DOUBLES
       that skill's share and rescales the rest, so a session is still a
       session and only its aim has moved.

   WHAT THIS PAGE WILL NOT TELL YOU. How long a man has left before he steps
   up. It knows - the engine's thresholds are right there - and it says
   nothing, because a countdown turns the nets into a progress bar you tick
   off rather than a judgement you make. What it shows instead is everything
   that has ALREADY happened: every step every man has taken, round by round,
   for as long as the club has existed. The past in full, the future not at
   all.

   HONESTY RULES. Every number here is real. The charts are drawn from the
   umpire's own replay of every training round this club has ever worked
   (server/living.mjs), not from anything this page invents.

   THE STORED SHAPE. The umpire's trainRound reads { "<player>": "<prog>" },
   and still does - that is every plan ever filed. A plan with a focus files
   { "<player>": { "p": "<prog>", "f": "<skill>" } }. Banked rounds are
   replayed from genesis to rebuild a squad, so the old shape has to keep
   meaning exactly what it always meant, and it does.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foTrainV2) return; window.__foTrainV2 = 1;
  try { window.__foNets = 1; } catch (eN) {}

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof userTeam === "function" && userTeam(); }

  var PACE_T = { seamFast: 1, seamFastMedium: 1, seamMedium: 1, partTimeSeam: 1 };
  function defaultProg(p) {
    if (p.keeper || p.role === "wicketkeeper") return "Keeping";
    if (p.role === "allRounder") return "All-rounder";
    var bt = p.bowlTypeFull || p.bowlType || "";
    if (PACE_T[bt] || /seam/i.test(bt) || /spin|wrist|finger/i.test(bt)) return "Bowling";
    return "Batting";
  }
  function progsOf() { try { return window.FO_TRAIN_PROGS || {}; } catch (e) { return {}; } }
  var SKILL_NM = { vsPace: "playing pace", vsSpin: "playing spin", rotation: "strike rotation", temperament: "temperament",
    power: "power", stamina: "stamina", wicket: "wicket threat", economy: "economy", discipline: "discipline",
    moveTurn: "movement and turn", variation: "variation", keeping: "keeping", catching: "catching",
    stumping: "stumping", fielding: "fielding" };
  var SKILL_SHORT = { vsPace: "pace", vsSpin: "spin", rotation: "rotation", temperament: "temperament",
    power: "power", stamina: "stamina", wicket: "wickets", economy: "economy", discipline: "discipline",
    moveTurn: "movement", variation: "variation", keeping: "keeping", catching: "catching",
    stumping: "stumping", fielding: "fielding" };

  function offered() {
    try { if (window.FO_TRAIN_OFFERED) return window.FO_TRAIN_OFFERED.slice(); } catch (e) {}
    return ["Batting", "Bowling", "Keeping", "Fielding", "Fitness", "Power hitting", "All-rounder", "Rest"];
  }
  // the engine's own reader and the engine's own focus arithmetic, quoted
  // rather than re-implemented - the phone and the umpire must price a focus
  // identically or a manager is shown a plan he is not getting
  function readEntry(v) {
    try { if (window.FO_PLAN_ENTRY) return window.FO_PLAN_ENTRY(v); } catch (e) {}
    if (typeof v === "string") return { p: v, f: null };
    if (v && typeof v === "object" && typeof v.p === "string") {
      return { p: v.p, f: (typeof v.f === "string" && v.f) ? v.f : null };
    }
    return null;
  }
  function focusWeights(prog, focus) {
    try { if (window.FO_TRAIN_FOCUS) return window.FO_TRAIN_FOCUS(prog, focus); } catch (e) {}
    var w = progsOf()[prog]; if (!w) return null;
    if (!focus || w[focus] === undefined) return w;
    var o = {}; for (var k in w) o[k] = w[k];
    o[focus] = w[focus] * 2; return o;
  }
  // what a man can be focused on: the skills his programme actually trains,
  // and no others. Rest trains nothing, so Rest has no focus.
  function focusOptions(prog) {
    var w = progsOf()[prog] || {}, out = [];
    for (var k in w) out.push(k);
    out.sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
    return out;
  }

  // ---- the plan: a name, a programme, a focus ------------------------------
  function served() {
    try { return !!(window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null")); }
    catch (e) { return false; }
  }
  var sv = null;
  function loadState() {
    if (sv) return sv;
    sv = { plan: {}, dirty: 0 };
    try {
      if (served()) {
        var stored = window.__foWorldPlan || {};
        for (var k in stored) {
          if (k.indexOf("__") === 0) continue;         // the retired v2 model
          var e = readEntry(stored[k]);
          if (e && progsOf()[e.p]) sv.plan[k] = e;
        }
      } else {
        var me = userTeam(), all = (me.players || []).concat(me.youth || []);
        all.forEach(function (p) {
          var t = p.training || {};
          if (t.program && progsOf()[t.program]) {
            sv.plan[p.name] = { p: t.program, f: (t.focus && progsOf()[t.program][t.focus] !== undefined) ? t.focus : null };
          }
        });
      }
    } catch (e) {}
    return sv;
  }
  function entryFor(p) {
    var st = loadState();
    return st.plan[p.name] || { p: defaultProg(p), f: null };
  }
  // the filed plan is EXPLICIT for every man - what the page shows is what
  // the umpire works, with nothing left to a default the manager cannot see.
  // A man on auto files the bare string, which is the shape every round
  // before this one banked: no focus, no new key, nothing to replay wrong.
  function buildPlan(squad) {
    var plan = {};
    squad.forEach(function (p) {
      var e = entryFor(p);
      plan[p.name] = e.f ? { p: e.p, f: e.f } : e.p;
    });
    return plan;
  }

  // ---- the shirt number: the umpire's own algorithm, quoted ----------------
  function h32n(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function squadNumbers(squad) {
    var taken = {}, out = {};
    var byName = squad.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    byName.forEach(function (p) { var n = p.no | 0; if (n >= 1 && n <= 99 && !taken[n]) { taken[n] = p.name; out[p.name] = n; } });
    byName.forEach(function (p) {
      if (out[p.name]) return;
      var v = (h32n(p.name) % 99) + 1, guard = 0;
      while (taken[v] && guard++ < 120) v = (v % 99) + 1;
      taken[v] = p.name; out[p.name] = v;
    });
    return out;
  }
  function abbrevOf(p) {
    var L = p.hand === "L";
    var bt = String(p.bowlTypeFull || p.bowlType || "");
    if (/fingerSpin|partTimeSpin/.test(bt)) return L ? "SLA" : "OB";
    if (/wristSpin/.test(bt)) return L ? "SLC" : "LB";
    if (/seamFastMedium/.test(bt)) return (L ? "L" : "R") + "FM";
    if (/seamFast/.test(bt)) return (L ? "L" : "R") + "F";
    if (/seam/i.test(bt)) return (L ? "L" : "R") + "M";
    return L ? "LH Bat" : "RH Bat";
  }

  /* ==========================================================================
     THE ACADEMY, as the nets see it. One building, ten rungs, and the only
     thing outside a man himself that changes what a session is worth. The
     rates below are the umpire's own (server/living.mjs academyRate) and the
     bills are the books' own (server/economy.mjs).
     ====================================================================== */
  var ACAD_MAX = 10;
  var ACAD_UPKEEP = [0, 6000, 14000, 26000, 44000, 70000, 90000, 112000, 136000, 162000, 190000];
  var ACAD_BUILD = [0, 400000, 900000, 1800000, 3200000, 3600000, 4200000, 4900000, 5700000, 6600000];
  function acadRate(lv) {
    lv = Math.max(1, Math.min(ACAD_MAX, +lv || 2));
    return lv <= 5 ? 1 + 0.08 * (lv - 2) : 1.24 + 0.05 * (lv - 5);
  }
  function acadLevel() {
    try { if (window.__foWorldAcademy != null) return Math.max(1, Math.min(ACAD_MAX, +window.__foWorldAcademy)); } catch (e) {}
    try { var t = userTeam(); if (t && t.acadY) return Math.max(1, Math.min(ACAD_MAX, +t.acadY)); } catch (e2) {}
    return 2;
  }
  function money(n) {
    n = Math.round(+n || 0);
    if (n >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "m";
    if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
    return "$" + n;
  }

  /* ==========================================================================
     THE BOOK OF THE NETS.

     The umpire replays every training round this club has ever worked and
     hands back what came of it: a list of STEPS - { s, r, n, k, to }, the
     season, the round, the man, the skill and the figure he reached - and a
     per-round tally of which programmes the squad was set to.

     From that plus today's squad, every past state is exactly recoverable
     WITHOUT storing one: walk the steps backwards from now, and a step to
     `to` means the man stood at `to - 1` before it. So no baseline is kept
     and none can go stale.
     ====================================================================== */
  function bookOf() {
    try {
      var h = window.__foNetsHistory;
      if (h && Array.isArray(h.steps)) {
        return { steps: h.steps, rounds: Array.isArray(h.rounds) ? h.rounds : [] };
      }
    } catch (e) {}
    return null;
  }
  // every round the club trained, oldest first, as a flat ordered list
  function roundKeys(bk) {
    var seen = {}, out = [];
    function add(s, r) { var k = s + "|" + r; if (!seen[k]) { seen[k] = 1; out.push({ s: +s, r: +r, k: k }); } }
    (bk.rounds || []).forEach(function (x) { add(x.s, x.r); });
    (bk.steps || []).forEach(function (x) { add(x.s, x.r); });
    out.sort(function (a, b) { return a.s - b.s || a.r - b.r; });
    return out;
  }
  // name -> [{ k, skills }] : what every man's skills were at the END of each
  // round, reconstructed backwards from today
  function timeline(bk, squad) {
    var keys = roundKeys(bk);
    if (!keys.length) return { keys: keys, at: {} };
    // today's reading is the state after the last round
    var now = {};
    squad.forEach(function (p) {
      var s = {}; for (var k in (p.skills || {})) s[k] = Math.round(p.skills[k] || 0);
      now[p.name] = s;
    });
    // start every man at today's figures for every round, then walk the steps
    // from newest to oldest, pushing the earlier value back through time
    var at = {};
    for (var nm in now) at[nm] = keys.map(function () { return null; });
    var cur = {};
    for (var nm2 in now) { cur[nm2] = {}; for (var sk in now[nm2]) cur[nm2][sk] = now[nm2][sk]; }
    var byRound = {};
    (bk.steps || []).forEach(function (g) { (byRound[g.s + "|" + g.r] = byRound[g.s + "|" + g.r] || []).push(g); });
    for (var i2 = keys.length - 1; i2 >= 0; i2--) {
      // the state AFTER round i2 is whatever `cur` holds right now
      for (var nm3 in cur) {
        if (!at[nm3]) continue;
        var snap = {}; for (var s3 in cur[nm3]) snap[s3] = cur[nm3][s3];
        at[nm3][i2] = snap;
      }
      // and rewinding this round's steps gives the state after round i2-1.
      // BACKWARDS THROUGH THE ROUND, and it matters: a young man can pop the
      // same skill twice in one week (50 -> 51 -> 52), and rewinding those in
      // the order they happened lands on 51 instead of the 50 he started on.
      // The last figure written must be the earliest step's.
      var gs = byRound[keys[i2].k] || [];
      for (var j = gs.length - 1; j >= 0; j--) {
        var g = gs[j];
        if (cur[g.n] && cur[g.n][g.k] !== undefined) cur[g.n][g.k] = (+g.to || 1) - 1;
      }
    }
    return { keys: keys, at: at };
  }
  function sumSkills(s) { var t = 0; for (var k in s) t += s[k] || 0; return t; }

  /* ==========================================================================
     THE CHARTS. Hand-built SVG, because a chart library is three hundred
     kilobytes to draw five shapes. Every one of them reads the book above and
     shows only what has happened.
     ====================================================================== */
  var CHARTS = [
    { id: "climb", nm: "The climb", sub: "One man, skill by skill, round by round" },
    { id: "thenNow", nm: "Then &amp; now", sub: "His shape today against ten rounds back" },
    { id: "growing", nm: "Who is growing", sub: "The squad ranked by skill points added" },
    { id: "work", nm: "Where the work went", sub: "Sessions by programme, across the record" },
    { id: "age", nm: "Growth against age", sub: "Points added plotted on the age he is" }
  ];
  var LINE_C = ["#C9571F", "#177A57", "#14243A", "#B8933A", "#7A4E8C", "#2E7BA6", "#9C3B3B", "#4B7F3A"];

  // Only the flat programme bar may be stretched to fill its box; anything
  // with a circle or a polygon in it keeps its shape, or a radar becomes an
  // ellipse on a narrow phone and reads as a different man.
  function svgWrap(w, h, inner, cls) {
    var par = (cls === "flat") ? "none" : "xMidYMid meet";
    return "<svg class='fo-t2-svg" + (cls ? " " + cls : "") + "' viewBox='0 0 " + w + " " + h +
      "' preserveAspectRatio='" + par + "' role='img'>" + inner + "</svg>";
  }
  function emptyChart(msg) {
    return "<div class='fo-t2-empty'>" + msg + "</div>";
  }

  // ---- the climb: one man's trained skills, round by round -----------------
  // the man-picker, which every single-player chart wears and NONE of them
  // may drop: a chart with nothing to draw still has to leave a manager a way
  // to look at somebody else, or he is stuck on the one flat line in the club
  function manBar(squad, man, tail) {
    return "<div class='fo-t2-cbar'><select class='fo-t2-who-pick' id='fo-t2-who'>" +
      squad.map(function (p) {
        return "<option value='" + E(p.name) + "'" + (p.name === man ? " selected" : "") + ">" + E(p.name) + "</option>";
      }).join("") + "</select>" + (tail ? "<i>" + tail + "</i>" : "") + "</div>";
  }
  function chartClimb(bk, squad, who) {
    var tl = timeline(bk, squad);
    var man = squad.filter(function (p) { return p.name === who; })[0] || squad[0];
    var bar = manBar(squad, man ? man.name : null, null);
    if (tl.keys.length < 2) return bar + emptyChart("The climb draws itself once this club has trained a second round.");
    if (!man || !tl.at[man.name]) return bar + emptyChart("No book for " + E(who || "") + " yet.");
    var series = tl.at[man.name];
    // only the skills that actually moved: a flat line teaches nothing
    var moved = [];
    for (var k in (series[series.length - 1] || {})) {
      var lo = series[0] ? (series[0][k] || 0) : 0, hi = series[series.length - 1][k] || 0;
      if (hi > lo) moved.push({ k: k, gain: hi - lo });
    }
    moved.sort(function (a, b) { return b.gain - a.gain; });
    moved = moved.slice(0, 6);
    if (!moved.length) return bar + emptyChart(E(man.name) + " has not stepped up in anything yet. Keep him at it.");

    var W = 640, H = 260, L = 34, R = 12, T = 14, B = 26;
    var n = tl.keys.length;
    var vals = [];
    moved.forEach(function (m) { series.forEach(function (s) { if (s) vals.push(s[m.k] || 0); }); });
    var lo2 = Math.max(0, Math.min.apply(null, vals) - 2), hi2 = Math.max.apply(null, vals) + 2;
    if (hi2 <= lo2) hi2 = lo2 + 1;
    var X = function (i) { return L + (n === 1 ? 0 : i * (W - L - R) / (n - 1)); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - lo2) / (hi2 - lo2)); };

    var g = "";
    for (var gi = 0; gi <= 4; gi++) {
      var gy = T + gi * (H - T - B) / 4;
      var gv = Math.round(hi2 - gi * (hi2 - lo2) / 4);
      g += "<line x1='" + L + "' y1='" + gy.toFixed(1) + "' x2='" + (W - R) + "' y2='" + gy.toFixed(1) + "' class='gr'/>" +
           "<text x='" + (L - 6) + "' y='" + (gy + 3.5).toFixed(1) + "' class='ax r'>" + gv + "</text>";
    }
    var lines = "", dots = "", defs = "";
    moved.forEach(function (m, mi) {
      var c = LINE_C[mi % LINE_C.length], d = "", area = "";
      for (var i = 0; i < n; i++) {
        var v = (series[i] || {})[m.k];
        if (v == null) continue;
        d += (d ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " ";
      }
      if (!d) return;
      if (mi === 0) {
        area = d + "L" + X(n - 1).toFixed(1) + " " + (H - B) + " L" + X(0).toFixed(1) + " " + (H - B) + " Z";
        defs += "<linearGradient id='foClG' x1='0' y1='0' x2='0' y2='1'>" +
          "<stop offset='0' stop-color='" + c + "' stop-opacity='.22'/>" +
          "<stop offset='1' stop-color='" + c + "' stop-opacity='0'/></linearGradient>";
        lines += "<path d='" + area + "' fill='url(#foClG)' stroke='none'/>";
      }
      lines += "<path d='" + d.trim() + "' fill='none' stroke='" + c + "' stroke-width='2.2' stroke-linejoin='round' stroke-linecap='round'/>";
      var lastV = (series[n - 1] || {})[m.k];
      if (lastV != null) {
        dots += "<circle cx='" + X(n - 1).toFixed(1) + "' cy='" + Y(lastV).toFixed(1) + "' r='4' fill='" + c + "' stroke='#FFFEFC' stroke-width='1.6'/>";
      }
    });
    // the ends of the record, named, so the axis means something
    var ax = "<text x='" + L + "' y='" + (H - 8) + "' class='ax'>S" + tl.keys[0].s + " R" + tl.keys[0].r + "</text>" +
      "<text x='" + (W - R) + "' y='" + (H - 8) + "' class='ax e'>S" + tl.keys[n - 1].s + " R" + tl.keys[n - 1].r + "</text>";

    var key = moved.map(function (m, mi) {
      return "<span><s style='background:" + LINE_C[mi % LINE_C.length] + "'></s>" +
        E(SKILL_NM[m.k] || m.k) + " <b>+" + m.gain + "</b></span>";
    }).join("");

    return manBar(squad, man.name, n + (n === 1 ? " round" : " rounds") + " on the record") +
      svgWrap(W, H, "<defs>" + defs + "</defs>" + g + lines + dots + ax) +
      "<div class='fo-t2-key'>" + key + "</div>";
  }

  // ---- then & now: a shape, twice ------------------------------------------
  function chartThenNow(bk, squad, who) {
    var tl = timeline(bk, squad);
    var man = squad.filter(function (p) { return p.name === who; })[0] || squad[0];
    var bar0 = manBar(squad, man ? man.name : null, null);
    if (tl.keys.length < 2) return bar0 + emptyChart("There is only one round on the record. Come back when there are two shapes to compare.");
    var series = tl.at[man.name] || [];
    var n = tl.keys.length;
    var back = Math.max(0, n - 1 - 10);
    var then = series[back] || series[0] || {}, now = series[n - 1] || {};
    var keys = [];
    for (var k in now) if (now[k] != null) keys.push(k);
    keys.sort(function (a, b) { return (now[b] || 0) - (now[a] || 0); });
    keys = keys.slice(0, 8);
    if (keys.length < 3) return bar0 + emptyChart("Not enough of a shape to draw yet.");

    var W = 420, H = 300, cx = W / 2, cy = H / 2 + 4, R = 108;
    var maxV = Math.max(20, Math.max.apply(null, keys.map(function (k2) { return Math.max(now[k2] || 0, then[k2] || 0); })) + 6);
    var pt = function (i, v) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / keys.length, r = R * Math.max(0, v) / maxV;
      return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)];
    };
    var web = "";
    for (var ring = 1; ring <= 4; ring++) {
      var pts = keys.map(function (k3, i) { return pt(i, maxV * ring / 4).join(","); }).join(" ");
      web += "<polygon points='" + pts + "' class='web'/>";
    }
    keys.forEach(function (k4, i) {
      var p2 = pt(i, maxV);
      web += "<line x1='" + cx + "' y1='" + cy + "' x2='" + p2[0] + "' y2='" + p2[1] + "' class='web'/>";
    });
    var polyThen = keys.map(function (k5, i) { return pt(i, then[k5] || 0).join(","); }).join(" ");
    var polyNow = keys.map(function (k6, i) { return pt(i, now[k6] || 0).join(","); }).join(" ");
    var labels = keys.map(function (k7, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / keys.length;
      var lx = cx + (R + 22) * Math.cos(a), ly = cy + (R + 22) * Math.sin(a) + 3.5;
      var anch = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
      var d = (now[k7] || 0) - (then[k7] || 0);
      return "<text x='" + lx.toFixed(1) + "' y='" + ly.toFixed(1) + "' text-anchor='" + anch + "' class='rl'>" +
        E(SKILL_SHORT[k7] || k7) + (d > 0 ? " <tspan class='up'>+" + d + "</tspan>" : "") + "</text>";
    }).join("");
    var defs = "<radialGradient id='foRdG' cx='.5' cy='.5' r='.5'>" +
      "<stop offset='0' stop-color='#C9571F' stop-opacity='.34'/>" +
      "<stop offset='1' stop-color='#C9571F' stop-opacity='.10'/></radialGradient>";

    var gap = n - 1 - back;
    return manBar(squad, man.name, "against " + gap + (gap === 1 ? " round" : " rounds") + " back") +
      "<div class='fo-t2-radar'>" + svgWrap(W, H, "<defs>" + defs + "</defs>" + web +
        "<polygon points='" + polyThen + "' class='then'/>" +
        "<polygon points='" + polyNow + "' fill='url(#foRdG)' stroke='#C9571F' stroke-width='2'/>" + labels, "radar") + "</div>" +
      "<div class='fo-t2-key'><span><s class='hollow'></s>then</span><span><s style='background:#C9571F'></s>now</span></div>";
  }

  // ---- who is growing: the squad, ranked ------------------------------------
  function chartGrowing(bk, squad) {
    var tl = timeline(bk, squad);
    if (!tl.keys.length) return emptyChart("Nobody has been through the nets yet.");
    var rows = squad.map(function (p) {
      var s = tl.at[p.name];
      if (!s || !s.length) return { n: p.name, age: p.age | 0, g: 0 };
      var a = s[0] || {}, b = s[s.length - 1] || {};
      return { n: p.name, age: p.age | 0, g: Math.max(0, sumSkills(b) - sumSkills(a)) };
    }).sort(function (x, y) { return y.g - x.g; }).slice(0, 14);
    var top = Math.max(1, rows[0] ? rows[0].g : 1);
    if (!rows.some(function (r) { return r.g > 0; })) {
      return emptyChart("No man has stepped up yet. Skills move slowly and on purpose.");
    }
    var bars = rows.map(function (r) {
      var w = Math.round(100 * r.g / top);
      return "<div class='fo-t2-bar'><span>" + E(r.n) + "<i>" + r.age + "</i></span>" +
        "<u><b style='width:" + w + "%'></b></u><em>" + (r.g ? "+" + r.g : "&mdash;") + "</em></div>";
    }).join("");
    return "<div class='fo-t2-bars'>" + bars + "</div>" +
      "<p class='fo-t2-cnote'>Skill points added since this club's first round in the nets. Age is on the left of the bar because it explains most of what you are looking at.</p>";
  }

  // ---- where the work went --------------------------------------------------
  function chartWork(bk) {
    var tally = {};
    (bk.rounds || []).forEach(function (r) {
      for (var pg in (r.p || {})) tally[pg] = (tally[pg] || 0) + r.p[pg];
    });
    var rows = Object.keys(tally).map(function (k) { return { k: k, v: tally[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
    if (!rows.length) return emptyChart("No rounds have been worked yet.");
    var total = rows.reduce(function (t, r) { return t + r.v; }, 0) || 1;
    var W = 640, H = 46, x = 0, seg = "", defs = "";
    rows.forEach(function (r, i) {
      var w = W * r.v / total, c = LINE_C[i % LINE_C.length];
      defs += "<linearGradient id='foWk" + i + "' x1='0' y1='0' x2='0' y2='1'>" +
        "<stop offset='0' stop-color='" + c + "' stop-opacity='1'/>" +
        "<stop offset='1' stop-color='" + c + "' stop-opacity='.72'/></linearGradient>";
      seg += "<rect x='" + x.toFixed(1) + "' y='0' width='" + Math.max(0, w - 1.5).toFixed(1) +
        "' height='" + H + "' rx='4' fill='url(#foWk" + i + ")'/>";
      x += w;
    });
    var key = rows.map(function (r, i) {
      return "<span><s style='background:" + LINE_C[i % LINE_C.length] + "'></s>" + E(r.k) +
        " <b>" + Math.round(100 * r.v / total) + "%</b></span>";
    }).join("");
    return svgWrap(W, H, "<defs>" + defs + "</defs>" + seg, "flat") +
      "<div class='fo-t2-key'>" + key + "</div>" +
      "<p class='fo-t2-cnote'>Every man-round this club has ever worked, by the programme he was on at the time &mdash; read off the plans actually in force, not the pickers above.</p>";
  }

  // ---- growth against age ---------------------------------------------------
  function chartAge(bk, squad) {
    var tl = timeline(bk, squad);
    if (!tl.keys.length) return emptyChart("Nobody has been through the nets yet.");
    var pts = squad.map(function (p) {
      var s = tl.at[p.name];
      if (!s || !s.length) return null;
      var a = s[0] || {}, b = s[s.length - 1] || {};
      return { n: p.name, age: p.age | 0, g: Math.max(0, sumSkills(b) - sumSkills(a)) };
    }).filter(Boolean);
    if (!pts.length) return emptyChart("Nothing to plot yet.");
    var W = 640, H = 250, L = 34, R = 16, T = 16, B = 30;
    var ages = pts.map(function (q) { return q.age; });
    var aLo = Math.min.apply(null, ages) - 1, aHi = Math.max.apply(null, ages) + 1;
    var gHi = Math.max(1, Math.max.apply(null, pts.map(function (q) { return q.g; })));
    var X = function (a) { return L + (W - L - R) * (a - aLo) / Math.max(1, aHi - aLo); };
    var Y = function (g) { return T + (H - T - B) * (1 - g / gHi); };
    var grid = "";
    for (var i = 0; i <= 4; i++) {
      var gy = T + i * (H - T - B) / 4;
      grid += "<line x1='" + L + "' y1='" + gy.toFixed(1) + "' x2='" + (W - R) + "' y2='" + gy.toFixed(1) + "' class='gr'/>" +
        "<text x='" + (L - 6) + "' y='" + (gy + 3.5).toFixed(1) + "' class='ax r'>" + Math.round(gHi - i * gHi / 4) + "</text>";
    }
    var axis = "";
    for (var a2 = Math.ceil(aLo); a2 <= aHi; a2++) {
      if (a2 % 2) continue;
      axis += "<text x='" + X(a2).toFixed(1) + "' y='" + (H - 9) + "' text-anchor='middle' class='ax'>" + a2 + "</text>";
    }
    var dots = pts.map(function (q) {
      var r = 5 + Math.min(4, q.g / Math.max(1, gHi) * 4);
      return "<circle cx='" + X(q.age).toFixed(1) + "' cy='" + Y(q.g).toFixed(1) + "' r='" + r.toFixed(1) +
        "' fill='#C9571F' fill-opacity='.55' stroke='#C9571F' stroke-width='1.4'><title>" +
        E(q.n) + " · " + q.age + " · +" + q.g + "</title></circle>";
    }).join("");
    return svgWrap(W, H, grid + axis + dots) +
      "<p class='fo-t2-cnote'>Points added against the age he is now. The slope is the whole law of the nets: a nineteen-year-old banks a session at more than five times the rate a thirty-three-year-old does, and no building changes that.</p>";
  }

  function drawChart(chart, who, bk, squad) {
    if (!bk) {
      return emptyChart("The book of the nets is written by the world update. Play a round and the charts fill from the club's whole history at once.");
    }
    if (chart === "thenNow") return chartThenNow(bk, squad, who);
    if (chart === "growing") return chartGrowing(bk, squad);
    if (chart === "work") return chartWork(bk);
    if (chart === "age") return chartAge(bk, squad);
    return chartClimb(bk, squad, who);
  }

  // WHICH CHART, AND ABOUT WHOM. Not held in the state above, deliberately:
  // that is cached for the life of the page load, while the bay rebuilds
  // whole on every keystroke - a plan saved, a picker moved. The choice lives
  // on the window and is read fresh each render, so it survives a rebuild
  // without surviving a change of club.
  function chartId() {
    var ch = "climb";
    try { if (window.__foNetsChart) ch = String(window.__foNetsChart); } catch (e) {}
    return CHARTS.some(function (c) { return c.id === ch; }) ? ch : "climb";
  }
  function whoFor(squad, bk) {
    var w = null;
    try { w = window.__foNetsWho ? String(window.__foNetsWho) : null; } catch (e) {}
    if (w && squad.some(function (p) { return p.name === w; })) return w;
    // NOT THE YOUNGEST MAN, tempting as he is. The youngest is usually a colt
    // who has never been through a senior net, and a climb chart that opens on
    // a flat line reads as a broken page. Open on whoever the book has the
    // most to say about, and fall back to the youngest only when it is empty.
    var count = {};
    ((bk && bk.steps) || []).forEach(function (g) { count[g.n] = (count[g.n] || 0) + 1; });
    var best = null, bn = 0;
    squad.forEach(function (p) { if ((count[p.name] || 0) > bn) { bn = count[p.name]; best = p.name; } });
    if (best) return best;
    var y = squad.slice().sort(function (a, b) { return (a.age | 0) - (b.age | 0); })[0];
    return y ? y.name : null;
  }

  // ---- the room -------------------------------------------------------------
  window.foRenderNetsPage = function () {
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foT2Css();
    try { document.body.classList.add("fo-nets-on"); } catch (eB) {}
    var st = loadState(), me = userTeam();
    var squad = (me.players || []).concat(me.youth || []);
    var bk = bookOf();
    var chart = chartId(), who = whoFor(squad, bk);

    var crest = ""; try { crest = window.foClubCrest ? foClubCrest(me.name, 56) : ""; } catch (eCr) {}
    var hero = "<div class='fo-t2-hero'><div>" +
      "<i>" + E(String(me.name || "").toUpperCase()) + " &middot; THE TRAINING GROUND</i>" +
      "<h1>The Nets</h1></div>" +
      "<span class='cr'>" + crest + "</span></div>";

    // ---- THE ACADEMY STRIP --------------------------------------------------
    var lv = acadLevel(), rate = acadRate(lv);
    var nextC = lv < ACAD_MAX ? ACAD_BUILD[lv] : null;
    var pips = "";
    for (var pi = 1; pi <= ACAD_MAX; pi++) pips += "<s class='fo-t2-pip" + (pi <= lv ? " on" : "") + "'></s>";
    var acad = "<a class='fo-t2-acad' href='#/academy'>" +
      "<span class='lv'><i>Academy</i><b>Level " + lv + "</b></span>" +
      "<span class='pips'>" + pips + "</span>" +
      "<span class='rt'><b>" + (rate >= 1 ? "+" : "") + Math.round((rate - 1) * 100) + "%</b><i>on every session</i></span>" +
      "<span class='bill'><b>" + money(ACAD_UPKEEP[lv]) + "</b><i>a round to run</i></span>" +
      (nextC ? "<span class='nx'><b>" + money(nextC) + "</b><i>to reach level " + (lv + 1) + "</i></span>"
             : "<span class='nx'><b>Top</b><i>nowhere further to go</i></span>") +
      "<s class='go'>&rsaquo;</s></a>";

    // ---- THE TRAINING PLAN, man by man --------------------------------------
    var nos = squadNumbers(squad);
    var roster = "<div class='fo-t2-card'><div class='fo-t2-ck'>Training plan</div>" +
      "<div class='fo-t2-head'><span></span><span>Player</span><span>Programme</span><span>Focus</span></div>" +
      squad.map(function (p) {
        var e = entryFor(p);
        var foc = focusOptions(e.p);
        var progSel = "<select data-t2p='" + E(p.name) + "'>" + offered()
          .concat(offered().indexOf(e.p) < 0 && progsOf()[e.p] ? [e.p] : [])
          .map(function (pg) {
            return "<option value='" + E(pg) + "'" + (e.p === pg ? " selected" : "") + ">" + E(pg) +
              (offered().indexOf(pg) < 0 ? " &middot; retired" : "") + "</option>";
          }).join("") + "</select>";
        var focSel = foc.length
          ? "<select data-t2f='" + E(p.name) + "'><option value=''" + (e.f ? "" : " selected") + ">Auto</option>" +
            foc.map(function (k) {
              return "<option value='" + E(k) + "'" + (e.f === k ? " selected" : "") + ">" + E(SKILL_NM[k] || k) + "</option>";
            }).join("") + "</select>"
          : "<span class='fo-t2-nofoc'>&mdash;</span>";
        return "<div class='fo-t2-row" + (e.f ? " foc" : "") + "'>" +
          "<span class='fo-t2-shirt'><svg viewBox='0 0 40 40'><path d='M13 4 L5 9 L8 16 L11 14 L11 36 L29 36 L29 14 L32 16 L35 9 L27 4 Q20 9 13 4 Z' fill='#14243A' stroke='#C9571F' stroke-width='1.4'/></svg><b>" + nos[p.name] + "</b></span>" +
          "<span class='fo-t2-who'><a href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + "</a>" +
          "<i>" + (p.age | 0) + " &middot; " + (p.hand === "L" ? "LH" : "RH") + " Bat &middot; " + E(abbrevOf(p)) + "</i></span>" +
          progSel + focSel +
          "</div>";
      }).join("") + "</div>";

    // TODAY AT THE NETS - the umpire's own report from the last settle
    var report = "";
    try {
      var rp = window.__foNetsReport;
      if (rp && rp.lines && rp.lines.length) {
        report = "<div class='fo-t2-card fo-t2-report'><div class='fo-t2-ck'>Today at the nets</div>" +
          rp.lines.map(function (ln) { return "<div class='fo-t2-rl'>" + E(ln) + "</div>"; }).join("") +
          "<div class='fo-t2-note'>The umpire's report from the last world update.</div></div>";
      }
    } catch (eRp) {}

    // ---- THE CHART BAY ------------------------------------------------------
    var cur = CHARTS.filter(function (c) { return c.id === chart; })[0] || CHARTS[0];
    var bay = "<div class='fo-t2-card fo-t2-bay'>" +
      "<div class='fo-t2-bh'><div><div class='fo-t2-ck'>" + cur.nm + "</div>" +
        "<p class='fo-t2-bsub'>" + cur.sub + "</p></div>" +
        "<select id='fo-t2-chart'>" + CHARTS.map(function (c) {
          return "<option value='" + c.id + "'" + (c.id === cur.id ? " selected" : "") + ">" + c.nm + "</option>";
        }).join("") + "</select></div>" +
      "<div class='fo-t2-cbody'>" + drawChart(chart, who, bk, squad) + "</div></div>";

    var html = "<div class='fo-t2'><div class='fo-t2-in'>" +
      hero + acad + roster + report +
      "<button type='button' class='fo-t2-save" + (st.dirty ? " dirty" : "") + "' id='fo-t2-save'><svg viewBox='0 0 24 24' class='pl'><path d='M2 21 L23 12 L2 3 L2 10 L17 12 L2 14 Z' fill='currentColor'/></svg>Save training plan" + (st.dirty ? " &middot; unsaved" : "") + "</button>" +
      bay +
      "<p class='fo-t2-fine'>A focus doubles that skill's share of the session and the rest of the programme gives up ground to pay for it &mdash; a session is always a session. " +
      "On a match day the eleven who play bank the full session and the men left out train at half pace; on rest days the whole squad trains in full. " +
      "Captaincy and experience are never trained: they come from playing, and from wearing the armband.</p>" +
      "</div></div>";
    page.innerHTML = html;

    // ---- the hands ---------------------------------------------------------
    var rep = function () { window.foRenderNetsPage(); };
    page.querySelectorAll("select[data-t2p]").forEach(function (s) {
      s.addEventListener("change", function () {
        var nm = s.getAttribute("data-t2p");
        // a new programme trains different skills, so a focus aimed at the old
        // one is not carried across - it would be a setting with no effect
        st.plan[nm] = { p: s.value, f: null };
        st.dirty = 1; rep();
      });
    });
    page.querySelectorAll("select[data-t2f]").forEach(function (s) {
      s.addEventListener("change", function () {
        var nm = s.getAttribute("data-t2f");
        var man = squad.filter(function (p) { return p.name === nm; })[0];
        var e = man ? entryFor(man) : { p: "Batting", f: null };
        st.plan[nm] = { p: e.p, f: s.value || null };
        st.dirty = 1; rep();
      });
    });
    var chartSel = page.querySelector("#fo-t2-chart");
    if (chartSel) chartSel.addEventListener("change", function () {
      try { window.__foNetsChart = chartSel.value; } catch (eS1) {}
      rep();
    });
    var whoSel = page.querySelector("#fo-t2-who");
    if (whoSel) whoSel.addEventListener("change", function () {
      try { window.__foNetsWho = whoSel.value; } catch (eS2) {}
      rep();
    });

    var save = page.querySelector("#fo-t2-save");
    if (save) save.addEventListener("click", function () {
      try {
        var plan = buildPlan(squad);
        if (served()) {
          if (window.__foWorldPushTraining) window.__foWorldPushTraining(plan);
          window.__foWorldPlan = plan;
        } else {
          squad.forEach(function (p) {
            if (!p.training || typeof p.training !== "object") p.training = { progressBySkill: {} };
            var e = readEntry(plan[p.name]) || { p: defaultProg(p), f: null };
            p.training.program = e.p;
            p.training.focus = e.f;
            p.training.intensity = "Normal";
            p.trainFocus = e.p;
          });
          try { if (typeof saveGame === "function") saveGame(false); } catch (eG) {}
        }
        st.dirty = 0; rep();
      } catch (eS) {}
    });
    // the page it drew, handed back. Nothing in the game reads this - it is
    // here so a test can, because the last renderer bug that reached a phone
    // reached it through a page no test had ever drawn.
    return html;
  };

  function foT2Css() {
    if (document.getElementById("fo-t2-css")) return;
    var s = document.createElement("style"); s.id = "fo-t2-css";
    s.textContent = [
      "html body.fo-nets-on #page{background:#F1EEE6}",
      ".fo-t2-in{max-width:900px;margin:0 auto;padding:14px 12px 40px}",
      ".fo-t2-hero{display:flex;align-items:center;justify-content:space-between;gap:14px;background:linear-gradient(135deg,#14243A,#0E2246);border-radius:16px;padding:20px 22px;margin-bottom:12px;border-left:4px solid #C9571F}",
      ".fo-t2-hero i{font:700 10px Oswald,sans-serif;letter-spacing:.22em;color:#E8B96A;font-style:normal}",
      ".fo-t2-hero h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:34px;color:#FFFEFC;margin:4px 0 0}",
      ".fo-t2-hero .cr svg{width:56px;height:74px}",
      // the academy strip: one building, and what it is worth and costs
      "html body #page a.fo-t2-acad{display:flex;align-items:center;gap:14px;background:#FFFEFC;border:1px solid #e3dccb;border-left:4px solid #B8933A;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:11px 14px;margin-bottom:12px;text-decoration:none;color:#14243A !important}",
      "html body #page a.fo-t2-acad:hover{border-color:#B8933A}",
      ".fo-t2-acad>span{min-width:0}",
      ".fo-t2-acad b{display:block;font:700 15px Inter,sans-serif;color:#14243A;white-space:nowrap}",
      ".fo-t2-acad i{display:block;margin-top:1px;font:600 8px Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a8272;font-style:normal;white-space:nowrap}",
      ".fo-t2-acad .lv{flex:0 0 auto}",
      ".fo-t2-acad .pips{display:flex;flex-wrap:wrap;gap:3px;flex:0 0 auto}",
      ".fo-t2-pip{display:block;width:11px;height:11px;border-radius:3px;background:rgba(20,28,40,.1);border:1px solid rgba(20,28,40,.13)}",
      ".fo-t2-pip.on{background:linear-gradient(180deg,#E8B96A,#C08A2E);border-color:rgba(138,106,31,.55)}",
      ".fo-t2-acad .rt b{color:#177A57}",
      ".fo-t2-acad .rt,.fo-t2-acad .bill,.fo-t2-acad .nx{flex:1 1 0}",
      ".fo-t2-acad .go{flex:0 0 auto;text-decoration:none;font:700 22px Inter,sans-serif;color:#B8933A;line-height:1}",
      // the plan
      ".fo-t2-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:14px 16px;margin-bottom:12px}",
      ".fo-t2-ck{font:700 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A;margin-bottom:8px}",
      ".fo-t2-head,.fo-t2-row{display:grid;grid-template-columns:38px minmax(0,1.15fr) minmax(104px,1fr) minmax(104px,1fr);gap:10px;align-items:center}",
      ".fo-t2-head{padding:0 0 6px;border-bottom:1px solid #e3dccb}",
      ".fo-t2-head span{font:700 8.5px Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#8a8272}",
      ".fo-t2-row{padding:9px 0;border-bottom:1px solid #f3eee1}",
      ".fo-t2-row:last-of-type{border-bottom:none}",
      ".fo-t2-row.foc select[data-t2f]{border-color:#C9571F;background:#FDF4EE;color:#A64426}",
      ".fo-t2-shirt{position:relative;width:36px;height:36px}",
      ".fo-t2-shirt svg{width:36px;height:36px;display:block}",
      ".fo-t2-shirt b{position:absolute;inset:6px 0 0 0;text-align:center;font:800 12px Oswald,sans-serif;color:#F6F3EB}",
      ".fo-t2-who{min-width:0}",
      ".fo-t2-who a{display:block;font:700 13px Inter,sans-serif;color:#14243A !important;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-who i{display:block;font:500 10.5px Inter,sans-serif;color:#8a8272;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-row select{width:100%;font:600 11.5px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:7px 6px;min-width:0}",
      ".fo-t2-nofoc{text-align:center;font:600 12px Inter,sans-serif;color:#c3bba8}",
      ".fo-t2-dim{margin:0 0 10px;font:400 12px Inter,sans-serif;color:#6d6455;line-height:1.5}",
      ".fo-t2-note{font:italic 400 11.5px Georgia,serif;color:#6d6455}",
      ".fo-t2-report{border-left:4px solid #177A57}",
      ".fo-t2-rl{padding:6px 0;border-bottom:1px solid #f3eee1;font:500 12.5px Inter,sans-serif;color:#14243A;line-height:1.5}",
      ".fo-t2-rl:last-of-type{border-bottom:none}",
      // the chart bay
      ".fo-t2-bay{padding-bottom:10px}",
      ".fo-t2-bh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}",
      ".fo-t2-bh .fo-t2-ck{margin-bottom:2px}",
      ".fo-t2-bsub{margin:0;font:400 11.5px Inter,sans-serif;color:#8a8272}",
      "html body #page .fo-t2-bay select{flex:0 0 auto;font:600 11.5px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:7px 8px;max-width:46%}",
      ".fo-t2-cbar{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
      ".fo-t2-cbar i{font:600 8.5px Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#8a8272;font-style:normal}",
      "html body #page select.fo-t2-who-pick{max-width:230px}",
      ".fo-t2-cbody{min-height:60px}",
      ".fo-t2-svg{width:100%;height:auto;display:block;overflow:visible}",
      ".fo-t2-svg.flat{height:46px}",
      ".fo-t2-svg .gr{stroke:#ece7da;stroke-width:1}",
      ".fo-t2-svg .web{stroke:#e6e0d0;stroke-width:1;fill:none}",
      ".fo-t2-svg .then{fill:none;stroke:#8a8272;stroke-width:1.6;stroke-dasharray:4 3}",
      ".fo-t2-svg .ax{font:600 9px Oswald,sans-serif;letter-spacing:.08em;fill:#a89f8d}",
      ".fo-t2-svg .ax.r{text-anchor:end}",
      ".fo-t2-svg .ax.e{text-anchor:end}",
      ".fo-t2-svg .rl{font:600 9px Inter,sans-serif;fill:#6d6455}",
      ".fo-t2-svg .rl .up{fill:#177A57;font-weight:800}",
      ".fo-t2-radar{max-width:420px;margin:0 auto}",
      ".fo-t2-key{display:flex;flex-wrap:wrap;gap:5px 14px;margin-top:9px}",
      ".fo-t2-key span{display:inline-flex;align-items:center;gap:5px;font:500 11px Inter,sans-serif;color:#6d6455}",
      ".fo-t2-key b{color:#14243A;font-weight:700}",
      ".fo-t2-key s{width:9px;height:9px;border-radius:2px;text-decoration:none;display:block}",
      ".fo-t2-key s.hollow{background:none;border:1.5px dashed #8a8272}",
      ".fo-t2-bars{display:flex;flex-direction:column;gap:5px}",
      ".fo-t2-bar{display:grid;grid-template-columns:minmax(0,150px) 1fr 42px;gap:9px;align-items:center}",
      ".fo-t2-bar span{font:600 11.5px Inter,sans-serif;color:#14243A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-bar span i{font:600 9px Oswald,sans-serif;color:#a89f8d;font-style:normal;margin-left:6px}",
      ".fo-t2-bar u{display:block;height:13px;border-radius:4px;background:#f1ece0;overflow:hidden;text-decoration:none}",
      ".fo-t2-bar u b{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#E8B96A,#C9571F)}",
      ".fo-t2-bar em{font:700 11px Oswald,sans-serif;letter-spacing:.05em;color:#177A57;font-style:normal;text-align:right}",
      ".fo-t2-cnote{margin:10px 0 0;font:italic 400 11.5px Georgia,serif;color:#8a8272;line-height:1.6}",
      ".fo-t2-empty{padding:22px 4px;text-align:center;font:italic 400 12.5px Georgia,serif;color:#8a8272;line-height:1.7}",
      ".fo-t2-save .pl{width:14px;height:14px;vertical-align:-2px;margin-right:8px}",
      "html body #page button.fo-t2-save{width:100%;font:700 13px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;background:#C9571F;color:#fff;border:none;border-radius:11px;padding:14px;cursor:pointer;margin:2px 0 12px}",
      "html body #page button.fo-t2-save:hover{background:#A64426}",
      "html body #page button.fo-t2-save.dirty{box-shadow:0 0 0 3px rgba(201,87,31,.25)}",
      "html body.ftpskin button.fo-t2-save{background:#C9571F !important;color:#fff !important;border:none !important}",
      ".fo-t2-fine{margin:9px 0 0;text-align:center;font:italic 400 11.5px Georgia,serif;color:#8a8272;line-height:1.6}",
      "@media(max-width:640px){.fo-t2-acad{flex-wrap:wrap;gap:8px 12px}.fo-t2-acad .rt,.fo-t2-acad .bill,.fo-t2-acad .nx{flex:0 0 auto}.fo-t2-acad .go{display:none}}",
      "@media(max-width:560px){.fo-t2-hero h1{font-size:27px}.fo-t2-hero .cr svg{width:42px;height:55px}",
      ".fo-t2-head,.fo-t2-row{grid-template-columns:28px minmax(0,1fr) minmax(78px,1fr) minmax(78px,1fr);gap:6px}",
      ".fo-t2-shirt,.fo-t2-shirt svg{width:30px;height:30px}.fo-t2-shirt b{inset:5px 0 0 0;font-size:10px}",
      ".fo-t2-who a{font-size:11.5px}.fo-t2-who i{font-size:9px}",
      ".fo-t2-row select{font-size:10px;padding:6px 4px}",
      ".fo-t2-bar{grid-template-columns:minmax(0,104px) 1fr 36px;gap:6px}.fo-t2-bar span{font-size:10.5px}",
      "}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();

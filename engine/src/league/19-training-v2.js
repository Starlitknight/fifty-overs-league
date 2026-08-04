/* ============================================================================
   THE TRAINING GROUND, v2 (#/training) — three strategic questions, not
   fifteen dropdowns: what does the squad need before the next match, who are
   we investing in long term, and how hard are we willing to push them.

   Phase 1 (this module): the plan model and the room. A club focus, five
   UNIT plans (batters / seamers / spinners / all-rounders / keepers) each
   with a focus and an intensity, and THREE individual development projects.
   One Save files the whole plan with the World Service.

   HONESTY RULES. Every number on this page is real:
     - training capacity is the engine's own fatigue factor (the same fresh()
       multiplier the umpire applies to tonight's session), read off the
       served squad's fatigue word;
     - project progress is the man's banked trainProgress against the
       engine's own threshold for the skill his programme works hardest;
     - "coach recommends" is the engine's genuine default programme for the
       man plus his workload state - the same programme the umpire would run.
   Intensity is filed with the plan (the umpire's resolver learns to read it
   in phase 2) - the page says what is filed, and claims nothing else.

   BACKWARD COMPATIBLE BY CONSTRUCTION. The stored plan stays the shape the
   umpire's trainRound already reads - { "<player>": "<programme>" } - with
   the v2 model riding alongside under "__v2", a key no player is named.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foTrainV2) return; window.__foTrainV2 = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof userTeam === "function" && userTeam(); }

  // ---- the engine's own arithmetic, quoted not re-invented -----------------
  var LADDER = ["rested", "revived", "energetic", "passable", "satisfactory", "moderate", "weary", "listless", "exhausted", "shattered", "clinically dead"];
  var FATF = [0.35, 0.45, 0.55, 0.68, 0.78, 0.86, 0.93, 0.97, 1.00, 1.02, 1.04];
  function capacityOf(p) {
    var w = String((p.fatWord || p.fatigue || "rested")).toLowerCase();
    var ix = LADDER.indexOf(w); if (ix < 0) ix = 0;
    return Math.round(Math.min(1, FATF[Math.max(0, Math.min(10, 10 - ix))]) * 100);
  }
  function recOf(cap) { return cap <= 55 ? "Recovery" : cap <= 80 ? "Light session" : "Full session"; }
  var PACE_T = { seamFast: 1, seamFastMedium: 1, seamMedium: 1, partTimeSeam: 1 };
  function defaultProg(p) {
    if (p.keeper || p.role === "wicketkeeper") return "Keeping";
    if (p.role === "allRounder") return "All-rounder";
    var bt = p.bowlTypeFull || p.bowlType || "";
    if (PACE_T[bt] || /seam/i.test(bt)) return "New-ball seam";
    if (/spin|wrist|finger/i.test(bt)) return "Spin bowling";
    return p.role === "middleOrderBat" ? "Finishing" : "Batting";
  }
  function unitOf(p) {
    if (p.keeper || p.role === "wicketkeeper") return "wk";
    if (p.role === "allRounder") return "ar";
    var bt = p.bowlTypeFull || p.bowlType || "";
    if (/spin|wrist|finger/i.test(bt)) return "spin";
    if (bt && !/none/i.test(String(bt))) return "seam";
    return "bat";
  }
  function progsOf() { try { return window.FO_TRAIN_PROGS || {}; } catch (e) { return {}; } }
  // a project's headline skill: the one its programme works hardest
  function topSkill(prog) {
    var w = progsOf()[prog] || {}, best = null, bv = -1;
    for (var k in w) if (w[k] > bv) { bv = w[k]; best = k; }
    return best;
  }
  var SKILL_NM = { vsPace: "playing pace", vsSpin: "playing spin", rotation: "strike rotation", temperament: "temperament",
    power: "power", stamina: "stamina", wicket: "wicket threat", economy: "economy", discipline: "discipline",
    moveTurn: "movement and turn", variation: "variation", keeping: "keeping", catching: "catching",
    stumping: "stumping", fielding: "fielding" };
  function projProgress(p, prog) {
    var sk = topSkill(prog); if (!sk || !p) return null;
    var have = (p.trainProgress && p.trainProgress[sk]) || 0;
    var th = 80 + (((p.skills && p.skills[sk]) || 0) * 1.5);
    return { sk: sk, pct: Math.max(0, Math.min(99, Math.round(100 * have / th))), banked: Math.round(have) };
  }

  // ---- the plan model -------------------------------------------------------
  var UNITS = [["bat", "Batters"], ["seam", "Seam bowlers"], ["spin", "Spin bowlers"], ["ar", "All-rounders"], ["wk", "Wicketkeepers"]];
  var UNIT_PROGS = {
    bat: ["Batting", "New-ball batting", "Spin batting", "Power hitting", "Finishing", "Fielding", "Fitness", "Rest"],
    seam: ["New-ball seam", "Bowling", "Death bowling", "Control bowling", "Fielding", "Fitness", "Rest"],
    spin: ["Spin bowling", "Bowling", "Control bowling", "Death bowling", "Fielding", "Fitness", "Rest"],
    ar: ["All-rounder", "Batting", "Bowling", "Fielding", "Fitness", "Rest"],
    wk: ["Keeping", "Batting", "Fielding", "Fitness", "Rest"]
  };
  var FOCI = [["balanced", "Balanced"], ["batting", "Batting"], ["bowling", "Bowling"], ["fitness", "Fitness"], ["fielding", "Fielding"], ["recovery", "Recovery"]];
  // ---- the shirt number: the umpire's own algorithm, quoted ----------------
  // The server banks p.no once per man (hash of his name, probed over the
  // squad in name order). Until a squad has been through a settle, the same
  // arithmetic here answers identically - one number, every device.
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
  // the scorebook's abbreviations: a bowler wears his arm and craft
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
  // one full normal session banks ~24 points; a step needs thresh(skill)
  function sessionsOf(p, prog) {
    var pp = projProgress(p, prog);
    if (!pp) return null;
    var sk = pp.sk;
    var th = 80 + (((p.skills && p.skills[sk]) || 0) * 1.5);
    return { done: Math.min(Math.floor(pp.banked / 24), Math.ceil(th / 24)), of: Math.ceil(th / 24), pct: pp.pct };
  }
  // which shelf of the balance chart a programme sits on
  var PROG_BUCKET = { "Batting": "bat", "New-ball batting": "bat", "Spin batting": "bat", "Power hitting": "bat", "Finishing": "bat",
    "Bowling": "bowl", "New-ball seam": "bowl", "Spin bowling": "bowl", "Death bowling": "bowl", "Control bowling": "bowl",
    "Keeping": "field", "Fielding": "field", "Fitness": "fit", "All-rounder": "bat", "Rest": "rest" };
  var INTEN = [["light", "Light"], ["normal", "Normal"], ["high", "High"], ["intensive", "Intensive"]];
  // what "coach decides" means under each club focus, per unit; null defers
  // to the engine's own per-man default programme
  var FOCUS_DEF = {
    balanced: { bat: null, seam: null, spin: null, ar: null, wk: null },
    batting: { bat: "Batting", seam: null, spin: null, ar: "Batting", wk: "Batting" },
    bowling: { bat: null, seam: "New-ball seam", spin: "Spin bowling", ar: "Bowling", wk: null },
    fielding: { bat: "Fielding", seam: "Fielding", spin: "Fielding", ar: "Fielding", wk: "Keeping" },
    fitness: { bat: "Fitness", seam: "Fitness", spin: "Fitness", ar: "Fitness", wk: "Fitness" },
    recovery: { bat: "Rest", seam: "Rest", spin: "Rest", ar: "Rest", wk: "Rest" }
  };
  var sv = null;
  function blankState() {
    var u = {}; UNITS.forEach(function (x) { u[x[0]] = { f: "coach", i: "normal" }; });
    return { focus: "balanced", units: u, projects: [null, null, null], overrides: {}, dirty: 0 };
  }
  function loadState() {
    if (sv) return sv;
    sv = blankState();
    try {
      var v2 = window.__foWorldPlan && window.__foWorldPlan.__v2;
      if (v2) {
        if (v2.focus) sv.focus = v2.focus;
        UNITS.forEach(function (x) { if (v2.units && v2.units[x[0]]) sv.units[x[0]] = { f: v2.units[x[0]].f || "coach", i: v2.units[x[0]].i || "normal" }; });
        (v2.projects || []).slice(0, 3).forEach(function (pr, i) { if (pr && pr.n) sv.projects[i] = { n: pr.n, f: pr.f }; });
        if (v2.overrides) sv.overrides = v2.overrides;
      }
    } catch (e) {}
    return sv;
  }
  function resolveUnit(u) {
    var st = loadState(), pick = st.units[u];
    if (pick.f && pick.f !== "coach") return pick.f;
    return FOCUS_DEF[st.focus] ? FOCUS_DEF[st.focus][u] : null;
  }
  function progFor(p) {
    var st = loadState();
    for (var i = 0; i < 3; i++) if (st.projects[i] && st.projects[i].n === p.name) return { prog: st.projects[i].f, why: "project" };
    if (st.overrides && st.overrides[p.name]) return { prog: st.overrides[p.name], why: "pinned" };
    var up = resolveUnit(unitOf(p));
    if (up) return { prog: up, why: "unit" };
    return { prog: defaultProg(p), why: "coach" };
  }
  function buildPlan(squad) {
    var st = loadState(), plan = {};
    squad.forEach(function (p) {
      var d = progFor(p);
      if (d.why !== "coach") plan[p.name] = d.prog;   // the coach's own default is left to the engine
    });
    var prj = []; st.projects.forEach(function (x) { if (x && x.n && x.f) prj.push({ n: x.n, f: x.f }); });
    var ovr = {};
    squad.forEach(function (p) { if (st.overrides && st.overrides[p.name]) ovr[p.name] = st.overrides[p.name]; });
    plan.__v2 = { focus: st.focus, units: st.units, projects: prj, overrides: ovr };
    return plan;
  }

  // ---- the room -------------------------------------------------------------
  var prevNets = window.foRenderNetsPage || null;
  window.foRenderNetsPage = function () {
    var page = document.getElementById("page"); if (!page || !ready()) return;
    var world = null;
    try { world = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eW) {}
    // an unclaimed save keeps the old room - its nets are local
    if (!world) { if (prevNets) return prevNets(); return; }
    foT2Css();
    try { document.body.classList.add("fo-nets-on"); } catch (eB) {}
    var st = loadState(), me = userTeam();
    var squad = (me.players || []).concat(me.youth || []);
    var byUnit = {}; UNITS.forEach(function (x) { byUnit[x[0]] = []; });
    squad.forEach(function (p) { byUnit[unitOf(p)].push(p); });
    var caps = squad.map(capacityOf);
    var avgCap = caps.length ? Math.round(caps.reduce(function (a, b) { return a + b; }, 0) / caps.length) : 0;
    var nProj = st.projects.filter(Boolean).length;
    var focusLbl = (FOCI.filter(function (f) { return f[0] === st.focus; })[0] || FOCI[0])[1];

    var crest = ""; try { crest = window.foClubCrest ? foClubCrest(me.name, 56) : ""; } catch (eCr) {}
    var hero = "<div class='fo-t2-hero'><div>" +
      "<i>" + E(String(me.name || "").toUpperCase()) + " &middot; THE TRAINING GROUND</i>" +
      "<h1>The Nets</h1><p>Purposeful work. Better players. Stronger team.</p></div>" +
      "<span class='cr'>" + crest + "</span></div>";

    // work banked: every point in every man's ledger, told in sessions
    var bankedPts = 0;
    squad.forEach(function (p) { var tp = p.trainProgress || {}; for (var k in tp) bankedPts += (+tp[k] || 0); });
    var bankedSes = Math.round(bankedPts / 24);
    var IC = {
      men: "<svg viewBox='0 0 24 24'><circle cx='8' cy='8' r='3'/><circle cx='16' cy='8' r='3'/><path d='M2 20 Q8 13 12 18 Q16 13 22 20'/></svg>",
      tgt: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='5'/><circle cx='12' cy='12' r='1.5' fill='currentColor'/></svg>",
      db: "<svg viewBox='0 0 24 24'><rect x='2' y='9' width='3' height='6' rx='1'/><rect x='19' y='9' width='3' height='6' rx='1'/><rect x='5' y='7' width='3' height='10' rx='1'/><rect x='16' y='7' width='3' height='10' rx='1'/><line x1='8' y1='12' x2='16' y2='12'/></svg>",
      tm: "<svg viewBox='0 0 24 24'><circle cx='12' cy='13' r='8'/><line x1='12' y1='13' x2='12' y2='8'/><line x1='10' y1='2' x2='14' y2='2'/><line x1='12' y1='2' x2='12' y2='5'/></svg>"
    };
    var band = "<div class='fo-t2-band'>" +
      "<div><s>" + IC.men + "</s><span><b>" + squad.length + "</b><i>Squad in training</i></span></div>" +
      "<div><s>" + IC.tgt + "</s><span><b>" + E(focusLbl) + "</b><i>Club focus</i></span></div>" +
      "<div><s>" + IC.db + "</s><span><b>" + bankedSes + "</b><i>Work banked &middot; sessions</i></span></div>" +
      "<div><s>" + IC.tm + "</s><span><b>" + avgCap + "%</b><i>Avg capacity</i></span></div></div>";

    var focusCard = "<div class='fo-t2-card'><div class='fo-t2-ck'>Club focus</div>" +
      "<p class='fo-t2-dim'>The overall emphasis for the training cycle. It steers what the coach decides; it never overrides a unit you have set yourself.</p>" +
      "<div class='fo-t2-chips'>" + FOCI.map(function (f) {
        return "<button type='button' class='fo-t2-chip" + (st.focus === f[0] ? " on" : "") + "' data-t2f='" + f[0] + "'>" + f[1] + "</button>";
      }).join("") + "</div></div>";

    // the team-sheet tiles (user's pick, variant A): each unit under its own
    // navy header with a gold capacity bar, a segmented intensity control,
    // and the coach's line as an italic footer
    var SEG = [["light", "Lgt"], ["normal", "Nrm"], ["high", "Hi"], ["intensive", "Max"]];
    var unitCards = "<div class='fo-t2-card'><div class='fo-t2-ck'>Unit plans</div><div class='fo-t2-ugrid'>" + UNITS.map(function (x) {
      var u = x[0], men = byUnit[u], pick = st.units[u];
      if (!men.length) return "";
      var uCap = Math.round(men.map(capacityOf).reduce(function (a, b) { return a + b; }, 0) / men.length);
      var resolved = resolveUnit(u);
      var coachLine = pick.f === "coach"
        ? "<div class='fo-t2-urec'>Coach recommends <b>" + E(resolved || defaultProg(men[0])) + "</b>" +
          (uCap <= 55 ? " &mdash; heavy workload in the last round, most of this unit will mainly recover." : ".") + "</div>"
        : "";
      return "<div class='fo-t2-tile'>" +
        "<div class='fo-t2-th'><b>" + x[1] + "</b><i>" + men.length + (men.length === 1 ? " man" : " men") + "</i>" +
        "<span class='cap' title='Training capacity " + uCap + "%'><b style='width:" + uCap + "%'></b></span></div>" +
        "<div class='fo-t2-tb'>" +
        "<select data-t2u='" + u + "'>" +
        "<option value='coach'" + (pick.f === "coach" ? " selected" : "") + ">Coach decides</option>" +
        UNIT_PROGS[u].map(function (pg) { return "<option value='" + E(pg) + "'" + (pick.f === pg ? " selected" : "") + ">" + E(pg) + "</option>"; }).join("") +
        "</select>" +
        "<span class='fo-t2-seg'>" + SEG.map(function (nn) {
          return "<button type='button' class='" + (pick.i === nn[0] ? "on" : "") + "' data-t2i='" + u + "|" + nn[0] + "' title='" + nn[0] + "'>" + nn[1] + "</button>";
        }).join("") + "</span></div>" + coachLine + "</div>";
    }).join("") + "</div></div>";

    var projCard = "<div class='fo-t2-card'><div class='fo-t2-ck'>Individual development projects <em>" + nProj + "/3</em></div>" +
      "<p class='fo-t2-dim'>Three men receive personal coaching. A project outranks his unit's plan.</p>" +
      [0, 1, 2].map(function (i) {
        var pr = st.projects[i];
        var man = pr ? squad.filter(function (p) { return p.name === pr.n; })[0] : null;
        var progSel = "";
        if (man) {
          var opts = UNIT_PROGS[unitOf(man)];
          progSel = "<select data-t2pf='" + i + "'>" + opts.map(function (pg) {
            return "<option value='" + E(pg) + "'" + (pr.f === pg ? " selected" : "") + ">" + E(pg) + "</option>";
          }).join("") + "</select>";
        }
        var bar = "";
        if (man && pr.f) {
          var pp = projProgress(man, pr.f);
          if (pp) {
            bar = "<div class='fo-t2-pb'><span>" + E(SKILL_NM[pp.sk] || pp.sk) + "</span><u><b style='width:" + pp.pct + "%'></b></u><em>" + pp.pct + "%</em></div>" +
              "<div class='fo-t2-note'>" + (pp.banked ? pp.banked + " points banked toward the next step." : "The first session goes in at tonight's update.") + "</div>";
          }
        }
        return "<div class='fo-t2-proj'>" +
          "<select data-t2pn='" + i + "'><option value=''>" + (man ? "&mdash; clear slot &mdash;" : "Open slot &middot; choose a player") + "</option>" +
          squad.map(function (p) {
            var taken = st.projects.some(function (x, j) { return x && j !== i && x.n === p.name; });
            if (taken) return "";
            return "<option value='" + E(p.name) + "'" + (pr && pr.n === p.name ? " selected" : "") + ">" + E(p.name) + " &middot; " + (p.age | 0) + "</option>";
          }).join("") + "</select>" + progSel + bar + "</div>";
      }).join("") + "</div>";

    var tired = squad.map(function (p) { return { p: p, c: capacityOf(p) }; })
      .filter(function (x) { return x.c <= 80; }).sort(function (a, b) { return a.c - b.c; });
    var attention = tired.length
      ? "<div class='fo-t2-card'><div class='fo-t2-ck'>Needing attention</div>" + tired.map(function (x) {
          return "<div class='fo-t2-att'><a href='#/player?n=" + encodeURIComponent(x.p.name) + "'>" + E(x.p.name) + "</a>" +
            "<i>" + E(x.p.fatWord || x.p.fatigue || "") + "</i><u><b style='width:" + x.c + "%'></b></u><em>" + x.c + "%</em><span>" + recOf(x.c) + "</span></div>";
        }).join("") + "</div>"
      : "";

    // ---- THE TRAINING PLAN, man by man: jersey, meta, work banked, override --
    var nos = squadNumbers(squad);
    var roster = "<div class='fo-t2-card'><div class='fo-t2-ck'>Training plan</div>" +
      "<p class='fo-t2-dim'>Assign individual focus. Work banked reflects completed sessions. A row on Coach decides follows its unit.</p>" +
      squad.map(function (p) {
        var d = progFor(p);
        var ses = sessionsOf(p, d.prog);
        var why = d.why === "project" ? " &middot; project" : "";
        var opts = UNIT_PROGS[unitOf(p)];
        var pinned = st.overrides && st.overrides[p.name];
        var sel = d.why === "project"
          ? "<span class='fo-t2-projtag'>" + E(d.prog) + " &middot; project</span>"
          : "<select data-t2ov='" + E(p.name) + "'>" +
            "<option value=''>Coach decides" + (d.why !== "pinned" ? " &middot; " + E(d.prog) : "") + "</option>" +
            opts.map(function (pg) { return "<option value='" + E(pg) + "'" + (pinned === pg ? " selected" : "") + ">" + E(pg) + "</option>"; }).join("") +
            "</select>";
        return "<div class='fo-t2-row'>" +
          "<span class='fo-t2-shirt'><svg viewBox='0 0 40 40'><path d='M13 4 L5 9 L8 16 L11 14 L11 36 L29 36 L29 14 L32 16 L35 9 L27 4 Q20 9 13 4 Z' fill='#14243A' stroke='#C9571F' stroke-width='1.4'/></svg><b>" + nos[p.name] + "</b></span>" +
          "<span class='fo-t2-who'><a href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + "</a>" +
          "<i>" + (p.age | 0) + " &middot; " + (p.hand === "L" ? "LH" : "RH") + " Bat &middot; " + E(abbrevOf(p)) + why + "</i></span>" +
          "<span class='fo-t2-work'>" + (ses
            ? "<i>" + ses.done + " / " + ses.of + " sessions</i><u><b style='width:" + ses.pct + "%'></b></u>"
            : "<i>resting</i><u><b style='width:0'></b></u>") + "</span>" +
          sel +
          "</div>";
      }).join("") + "</div>";

    // ---- TRAINING BALANCE + SESSION NOTES, side by side ---------------------
    var buckets = { bat: 0, bowl: 0, field: 0, fit: 0, rest: 0 };
    squad.forEach(function (p) { var b = PROG_BUCKET[progFor(p).prog]; if (b != null) buckets[b]++; });
    var nTot = Math.max(1, squad.length);
    var BAL = [["Batting", buckets.bat, "#C9571F"], ["Bowling", buckets.bowl, "#14243A"],
      ["Fielding", buckets.field, "#177A57"], ["Fitness", buckets.fit, "#D9A21B"], ["Recovery", buckets.rest, "#B23230"]];
    var balCard = "<div class='fo-t2-card'><div class='fo-t2-ck'>Training balance</div>" +
      BAL.filter(function (b) { return b[1] > 0; }).map(function (b) {
        var pc = Math.round(100 * b[1] / nTot);
        return "<div class='fo-t2-bal'><span>" + b[0] + "</span><u><b style='width:" + pc + "%;background:" + b[2] + "'></b></u><em>" + pc + "%</em></div>";
      }).join("") + "</div>";
    var notes = [];
    notes.push(focusLbl + " emphasis this cycle" + (st.focus === "balanced" ? " - the coach reads each man his own programme." : "."));
    UNITS.forEach(function (x) {
      var u = st.units[x[0]], men = byUnit[x[0]];
      if (!men.length) return;
      if (u.f !== "coach") notes.push(x[1] + " working " + u.f + (u.i !== "normal" ? " at " + u.i + " intensity" : "") + ".");
      else if (u.i !== "normal") notes.push(x[1] + " at " + u.i + " intensity.");
    });
    if (nProj) notes.push(nProj + " personal project" + (nProj === 1 ? "" : "s") + " running alongside the units.");
    var notesCard = "<div class='fo-t2-card'><div class='fo-t2-ck'>Session notes</div>" +
      "<ul class='fo-t2-notes'>" + notes.slice(0, 4).map(function (n) { return "<li>" + E(n) + "</li>"; }).join("") + "</ul></div>";
    var twin = "<div class='fo-t2-twin'>" + balCard + notesCard + "</div>";

    // TODAY AT THE NETS - the umpire's own report from the last settle,
    // written server-side from real skill steps and real load. Nothing here
    // is generated on the phone.
    var report = "";
    try {
      var rp = window.__foNetsReport;
      if (rp && rp.lines && rp.lines.length) {
        report = "<div class='fo-t2-card fo-t2-report'><div class='fo-t2-ck'>Today at the nets</div>" +
          rp.lines.map(function (ln) { return "<div class='fo-t2-rl'>" + E(ln) + "</div>"; }).join("") +
          "<div class='fo-t2-note'>The umpire's report from the last world update.</div></div>";
      }
    } catch (eRp) {}

    page.innerHTML = "<div class='fo-t2'><div class='fo-t2-in'>" +
      hero + band + focusCard + unitCards + projCard + roster + twin + report + attention +
      "<button type='button' class='fo-t2-save" + (st.dirty ? " dirty" : "") + "' id='fo-t2-save'><svg viewBox='0 0 24 24' class='pl'><path d='M2 21 L23 12 L2 3 L2 10 L17 12 L2 14 Z' fill='currentColor'/></svg>Save training plan" + (st.dirty ? " &middot; unsaved" : "") + "</button>" +
      "<p class='fo-t2-fine'>You can review and send to the world when ready. The plan is a standing order: the umpire works it at every update until you change it.</p>" +
      "</div></div>";

    // ---- the hands ---------------------------------------------------------
    var rep = function () { window.foRenderNetsPage(); };
    page.querySelectorAll("[data-t2f]").forEach(function (b) {
      b.addEventListener("click", function () { st.focus = b.getAttribute("data-t2f"); st.dirty = 1; rep(); });
    });
    page.querySelectorAll("select[data-t2u]").forEach(function (s) {
      s.addEventListener("change", function () { st.units[s.getAttribute("data-t2u")].f = s.value; st.dirty = 1; rep(); });
    });
    page.querySelectorAll("[data-t2i]").forEach(function (b) {
      b.addEventListener("click", function () {
        var kv = b.getAttribute("data-t2i").split("|");
        st.units[kv[0]].i = kv[1]; st.dirty = 1; rep();
      });
    });
    page.querySelectorAll("select[data-t2pn]").forEach(function (s) {
      s.addEventListener("change", function () {
        var i = +s.getAttribute("data-t2pn"), nm = s.value;
        if (!nm) { st.projects[i] = null; }
        else {
          var man = squad.filter(function (p) { return p.name === nm; })[0];
          st.projects[i] = { n: nm, f: (st.projects[i] && st.projects[i].n === nm && st.projects[i].f) || defaultProg(man || {}) };
        }
        st.dirty = 1; rep();
      });
    });
    page.querySelectorAll("select[data-t2ov]").forEach(function (s) {
      s.addEventListener("change", function () {
        var nm = s.getAttribute("data-t2ov");
        if (s.value) st.overrides[nm] = s.value; else delete st.overrides[nm];
        st.dirty = 1; rep();
      });
    });
    page.querySelectorAll("select[data-t2pf]").forEach(function (s) {
      s.addEventListener("change", function () {
        var i = +s.getAttribute("data-t2pf");
        if (st.projects[i]) { st.projects[i].f = s.value; st.dirty = 1; rep(); }
      });
    });
    var save = page.querySelector("#fo-t2-save");
    if (save) save.addEventListener("click", function () {
      try {
        var plan = buildPlan(squad);
        if (window.__foWorldPushTraining) window.__foWorldPushTraining(plan);
        window.__foWorldPlan = plan;
        st.dirty = 0; rep();
      } catch (eS) {}
    });
  };

  function foT2Css() {
    if (document.getElementById("fo-t2-css")) return;
    var s = document.createElement("style"); s.id = "fo-t2-css";
    s.textContent = [
      "html body.fo-nets-on #page{background:#F1EEE6}",
      ".fo-t2-in{max-width:900px;margin:0 auto;padding:14px 12px 40px}",
      ".fo-t2-hero{display:flex;align-items:center;justify-content:space-between;gap:14px;background:linear-gradient(135deg,#14243A,#0E2246);border-radius:16px;padding:20px 22px;margin-bottom:12px;border-left:4px solid #C9571F}",
      ".fo-t2-hero i{font:700 10px Oswald,sans-serif;letter-spacing:.22em;color:#E8B96A;font-style:normal}",
      ".fo-t2-hero h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:34px;color:#FFFEFC;margin:4px 0 5px}",
      ".fo-t2-hero p{margin:0;font:400 13px Inter,sans-serif;color:rgba(246,243,235,.82)}",
      ".fo-t2-hero .cr svg{width:56px;height:74px}",
      ".fo-t2-band{display:flex;background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);margin-bottom:12px;overflow:hidden}",
      ".fo-t2-band>div{flex:1;display:flex;align-items:center;gap:8px;padding:11px 10px;border-right:1px solid #eee7d9;min-width:0}",
      ".fo-t2-band>div:last-child{border-right:none}",
      ".fo-t2-band s{flex:0 0 auto;width:22px;height:22px;text-decoration:none;color:#C9571F}",
      ".fo-t2-band s svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
      ".fo-t2-band span{min-width:0}",
      ".fo-t2-band b{display:block;font:700 15px Inter,sans-serif;color:#14243A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-band i{display:block;margin-top:2px;font:600 8px Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a8272;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      // the training plan, man by man: jersey / who / work banked / override
      ".fo-t2-row{display:grid;grid-template-columns:38px minmax(0,1.2fr) minmax(90px,1fr) minmax(120px,150px);gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #f3eee1}",
      ".fo-t2-row:last-of-type{border-bottom:none}",
      ".fo-t2-shirt{position:relative;width:36px;height:36px}",
      ".fo-t2-shirt svg{width:36px;height:36px;display:block}",
      ".fo-t2-shirt b{position:absolute;inset:6px 0 0 0;text-align:center;font:800 12px Oswald,sans-serif;color:#F6F3EB}",
      ".fo-t2-who{min-width:0}",
      ".fo-t2-who a{display:block;font:700 13px Inter,sans-serif;color:#14243A !important;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-who i{display:block;font:500 10.5px Inter,sans-serif;color:#8a8272;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-work i{display:block;font:600 10.5px Inter,sans-serif;color:#4c4437;font-style:normal;margin-bottom:3px;white-space:nowrap}",
      ".fo-t2-work u{display:block;height:6px;border-radius:3px;background:#ece7da;overflow:hidden;text-decoration:none}",
      ".fo-t2-work u b{display:block;height:100%;border-radius:3px;background:#177A57}",
      ".fo-t2-row select{width:100%;font:600 11.5px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:7px 6px;min-width:0}",
      ".fo-t2-projtag{font:700 9px Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a6a1f;background:#F8ECD4;border:1px solid #e8d5a8;border-radius:8px;padding:6px 8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      // balance + notes, shoulder to shoulder on a desk
      ".fo-t2-twin{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      ".fo-t2-twin .fo-t2-card{margin-bottom:12px}",
      ".fo-t2-bal{display:flex;align-items:center;gap:10px;padding:6px 0;font:600 12px Inter,sans-serif;color:#4c4437}",
      ".fo-t2-bal span{flex:0 0 64px}",
      ".fo-t2-bal u{flex:1;height:7px;border-radius:4px;background:#ece7da;overflow:hidden;text-decoration:none;display:block}",
      ".fo-t2-bal u b{display:block;height:100%;border-radius:4px}",
      ".fo-t2-bal em{font-style:normal;font-variant-numeric:tabular-nums;color:#14243A;font-weight:700;flex:0 0 34px;text-align:right}",
      ".fo-t2-notes{margin:0;padding-left:17px;font:400 12.5px Inter,sans-serif;color:#4c4437;line-height:1.65}",
      ".fo-t2-notes li{margin-bottom:5px}",
      ".fo-t2-save .pl{width:14px;height:14px;vertical-align:-2px;margin-right:8px}",
      ".fo-t2-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:14px 16px;margin-bottom:12px}",
      ".fo-t2-ck{font:700 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A;margin-bottom:8px}",
      ".fo-t2-ck em{font-style:normal;color:#177A57;margin-left:6px}",
      ".fo-t2-dim{margin:0 0 10px;font:400 12px Inter,sans-serif;color:#6d6455;line-height:1.5}",
      ".fo-t2-chips{display:flex;flex-wrap:wrap;gap:7px}",
      "html body #page button.fo-t2-chip{font:700 11.5px Inter,sans-serif;border:1px solid #d9d0bc;background:#FFFEFC;color:#4c4437;border-radius:999px;padding:8px 15px;cursor:pointer}",
      "html body #page button.fo-t2-chip.on{background:#C9571F;border-color:#C9571F;color:#fff}",
      "html body.ftpskin button.fo-t2-chip{background:#FFFEFC !important;color:#4c4437 !important;border-color:#d9d0bc !important}",
      "html body.ftpskin button.fo-t2-chip.on{background:#C9571F !important;color:#fff !important;border-color:#C9571F !important}",
      "html body.ftpskin .fo-t2-seg button{background:#FFFEFC !important;color:#8a8272 !important;border-color:#eee7d9 !important}",
      "html body.ftpskin .fo-t2-seg button.on{background:#C9571F !important;color:#fff !important}",
      "html body.ftpskin button.fo-t2-save{background:#C9571F !important;color:#fff !important;border:none !important}",
      ".fo-t2-ugrid{display:grid;grid-template-columns:1fr;gap:9px}",
      "@media(min-width:760px){.fo-t2-ugrid{grid-template-columns:1fr 1fr}}",
      ".fo-t2-tile{border:1px solid #eee7d9;border-radius:12px;overflow:hidden}",
      ".fo-t2-th{display:flex;align-items:center;gap:9px;background:linear-gradient(135deg,#14243A,#0E2246);padding:9px 12px}",
      ".fo-t2-th b{font:700 12px Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#F6F3EB;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-th i{font:600 10px Inter,sans-serif;color:#E8B96A;font-style:normal;white-space:nowrap}",
      ".fo-t2-th .cap{flex:0 0 34px;width:34px;height:5px;border-radius:3px;background:rgba(246,243,235,.25);overflow:hidden}",
      ".fo-t2-th .cap b{display:block;height:100%;background:#E8B96A;border-radius:3px;flex:none}",
      ".fo-t2-tb{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#FDFCF8}",
      ".fo-t2-tb select,.fo-t2-proj select{font:600 12.5px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:8px 10px;max-width:100%}",
      ".fo-t2-tb select{flex:1;min-width:0}",
      ".fo-t2-seg{display:flex;flex:0 0 auto;border:1px solid #d9d0bc;border-radius:9px;overflow:hidden}",
      "html body #page .fo-t2-seg button{font:700 8.5px Oswald,sans-serif;font-family:Oswald,sans-serif !important;letter-spacing:.08em;text-transform:uppercase;padding:8px;color:#8a8272;background:#FFFEFC;border:none;border-right:1px solid #eee7d9;border-radius:0;cursor:pointer;min-height:0}",
      "html body #page .fo-t2-seg button:last-child{border-right:none}",
      "html body #page .fo-t2-seg button.on{background:#C9571F;color:#fff}",
      ".fo-t2-urec{padding:7px 12px;background:#FBF6EA;border-top:1px dashed #e8d5a8;font:italic 400 11.5px Georgia,serif;color:#8a6a1f;line-height:1.5}",
      ".fo-t2-urec b{font-style:normal;font-family:Inter,sans-serif;font-size:11.5px;color:#14243A}",
      ".fo-t2-proj{border-top:1px dashed #e8d5a8;padding:11px 0;display:flex;flex-direction:column;gap:8px}",
      ".fo-t2-proj:first-of-type{border-top:none}",
      ".fo-t2-pb{display:flex;align-items:center;gap:9px;font:600 11.5px Inter,sans-serif;color:#4c4437}",
      ".fo-t2-pb span{flex:0 0 auto;text-transform:capitalize}",
      ".fo-t2-pb u{flex:1;height:8px;border-radius:4px;background:#ece7da;overflow:hidden;text-decoration:none;display:block}",
      ".fo-t2-pb u b{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#C9571F,#E8B96A)}",
      ".fo-t2-pb em{font-style:normal;font-variant-numeric:tabular-nums;color:#14243A;font-weight:700}",
      ".fo-t2-note{font:italic 400 11.5px Georgia,serif;color:#6d6455}",
      ".fo-t2-report{border-left:4px solid #177A57}",
      ".fo-t2-rl{padding:6px 0;border-bottom:1px solid #f3eee1;font:500 12.5px Inter,sans-serif;color:#14243A;line-height:1.5}",
      ".fo-t2-rl:last-of-type{border-bottom:none}",
      ".fo-t2-att{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f3eee1;font:600 12.5px Inter,sans-serif}",
      ".fo-t2-att:last-child{border-bottom:none}",
      ".fo-t2-att a{color:#14243A !important;text-decoration:none;flex:0 0 auto}",
      ".fo-t2-att i{font:500 11px Inter,sans-serif;color:#8a8272;font-style:normal;flex:0 0 auto}",
      ".fo-t2-att u{flex:1;height:6px;border-radius:3px;background:#ece7da;overflow:hidden;text-decoration:none;display:block;min-width:40px}",
      ".fo-t2-att u b{display:block;height:100%;background:#C0392E;border-radius:3px}",
      ".fo-t2-att em{font-style:normal;font-variant-numeric:tabular-nums;color:#14243A;font-weight:700}",
      ".fo-t2-att span{font:700 9px Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a6a1f;background:#F8ECD4;border:1px solid #e8d5a8;border-radius:6px;padding:3px 7px;white-space:nowrap}",
      ".fo-t2-roster summary{font:700 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A;cursor:pointer}",
      ".fo-t2-man{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f3eee1;font:600 12.5px Inter,sans-serif}",
      ".fo-t2-man:last-child{border-bottom:none}",
      ".fo-t2-man a{color:#14243A !important;text-decoration:none;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-man i{font:500 11px Inter,sans-serif;color:#8a8272;font-style:normal}",
      ".fo-t2-man em{font-style:normal;font-variant-numeric:tabular-nums;color:#177A57;font-weight:700}",
      "html body #page button.fo-t2-save{width:100%;font:700 13px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;background:#C9571F;color:#fff;border:none;border-radius:11px;padding:14px;cursor:pointer;margin-top:2px}",
      "html body #page button.fo-t2-save:hover{background:#A64426}",
      "html body #page button.fo-t2-save.dirty{box-shadow:0 0 0 3px rgba(201,87,31,.25)}",
      ".fo-t2-fine{margin:9px 0 0;text-align:center;font:italic 400 11.5px Georgia,serif;color:#8a8272}",
      "@media(max-width:560px){.fo-t2-hero h1{font-size:27px}.fo-t2-hero .cr svg{width:42px;height:55px}",
      ".fo-t2-band b{font-size:12.5px}.fo-t2-band i{font-size:7px}.fo-t2-band s,.fo-t2-band s svg{width:17px;height:17px}.fo-t2-band>div{gap:5px;padding:9px 6px}",
      ".fo-t2-row{grid-template-columns:28px minmax(0,1.3fr) minmax(62px,.7fr) minmax(86px,98px);gap:6px}",
      ".fo-t2-shirt,.fo-t2-shirt svg{width:30px;height:30px}.fo-t2-shirt b{inset:5px 0 0 0;font-size:10px}",
      ".fo-t2-who a{font-size:11.5px}.fo-t2-who i{font-size:9px}",
      ".fo-t2-work i{font-size:9px}.fo-t2-row select{font-size:10px;padding:6px 4px}",
      ".fo-t2-twin{grid-template-columns:1fr}",
      ".fo-t2-tb{flex-wrap:wrap}.fo-t2-tb select{flex:1 1 100%}.fo-t2-seg{flex:1;display:flex}html body #page .fo-t2-seg button{flex:1;padding:8px 6px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();

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
  var FOCI = [["balanced", "Balanced"], ["batting", "Batting"], ["bowling", "Bowling"], ["fielding", "Fielding"], ["fitness", "Fitness"], ["recovery", "Recovery"]];
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
    return { focus: "balanced", units: u, projects: [null, null, null], dirty: 0 };
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
    plan.__v2 = { focus: st.focus, units: st.units, projects: prj };
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

    var band = "<div class='fo-t2-band'>" +
      "<div><b>" + squad.length + "</b><i>Squad in training</i></div>" +
      "<div><b>" + E(focusLbl) + "</b><i>Club focus</i></div>" +
      "<div><b>" + nProj + " / 3</b><i>Projects</i></div>" +
      "<div><b>" + avgCap + "%</b><i>Avg capacity</i></div></div>";

    var focusCard = "<div class='fo-t2-card'><div class='fo-t2-ck'>Club focus</div>" +
      "<p class='fo-t2-dim'>The overall emphasis for the training cycle. It steers what the coach decides; it never overrides a unit you have set yourself.</p>" +
      "<div class='fo-t2-chips'>" + FOCI.map(function (f) {
        return "<button type='button' class='fo-t2-chip" + (st.focus === f[0] ? " on" : "") + "' data-t2f='" + f[0] + "'>" + f[1] + "</button>";
      }).join("") + "</div></div>";

    var unitCards = "<div class='fo-t2-card'><div class='fo-t2-ck'>Unit plans</div>" + UNITS.map(function (x) {
      var u = x[0], men = byUnit[u], pick = st.units[u];
      if (!men.length) return "";
      var uCap = Math.round(men.map(capacityOf).reduce(function (a, b) { return a + b; }, 0) / men.length);
      var resolved = resolveUnit(u);
      var coachLine = pick.f === "coach"
        ? "<div class='fo-t2-rec'>COACH RECOMMENDS <b>" + E(resolved || defaultProg(men[0])) + "</b>" +
          (uCap <= 55 ? "<span>Heavy workload in the last round - most of this unit will mainly recover.</span>" : "") + "</div>"
        : "";
      return "<div class='fo-t2-unit'>" +
        "<div class='fo-t2-uh'><b>" + x[1] + "</b><i>" + men.length + (men.length === 1 ? " man" : " men") + " &middot; capacity " + uCap + "%</i></div>" +
        "<div class='fo-t2-ur'>" +
        "<select data-t2u='" + u + "'>" +
        "<option value='coach'" + (pick.f === "coach" ? " selected" : "") + ">Coach decides</option>" +
        UNIT_PROGS[u].map(function (pg) { return "<option value='" + E(pg) + "'" + (pick.f === pg ? " selected" : "") + ">" + E(pg) + "</option>"; }).join("") +
        "</select>" +
        "<span class='fo-t2-ints'>" + INTEN.map(function (nn) {
          return "<button type='button' class='fo-t2-int" + (pick.i === nn[0] ? " on" : "") + "' data-t2i='" + u + "|" + nn[0] + "'>" + nn[1] + "</button>";
        }).join("") + "</span></div>" + coachLine + "</div>";
    }).join("") + "</div>";

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

    var roster = "<details class='fo-t2-card fo-t2-roster'><summary>What the plan is doing, man by man</summary>" +
      squad.map(function (p) {
        var d = progFor(p), c = capacityOf(p);
        var why = d.why === "project" ? "personal project" : d.why === "unit" ? "unit plan" : "coach's call";
        return "<div class='fo-t2-man'><a href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + "</a>" +
          "<i>" + E(d.prog) + " &middot; " + why + "</i><em>" + c + "%</em></div>";
      }).join("") + "</details>";

    page.innerHTML = "<div class='fo-t2'><div class='fo-t2-in'>" +
      hero + band + focusCard + unitCards + projCard + attention + roster +
      "<button type='button' class='fo-t2-save" + (st.dirty ? " dirty" : "") + "' id='fo-t2-save'>Save training plan" + (st.dirty ? " &middot; unsaved" : "") + "</button>" +
      "<p class='fo-t2-fine'>The plan is a standing order: the umpire works it at every world update until you change it. Intensity is filed with the plan.</p>" +
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
      ".fo-t2-band>div{flex:1;padding:11px 8px;text-align:center;border-right:1px solid #eee7d9;min-width:0}",
      ".fo-t2-band>div:last-child{border-right:none}",
      ".fo-t2-band b{display:block;font:700 16px Inter,sans-serif;color:#14243A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-band i{display:block;margin-top:3px;font:600 8.5px Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8a8272;font-style:normal}",
      ".fo-t2-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:14px 16px;margin-bottom:12px}",
      ".fo-t2-ck{font:700 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A;margin-bottom:8px}",
      ".fo-t2-ck em{font-style:normal;color:#177A57;margin-left:6px}",
      ".fo-t2-dim{margin:0 0 10px;font:400 12px Inter,sans-serif;color:#6d6455;line-height:1.5}",
      ".fo-t2-chips{display:flex;flex-wrap:wrap;gap:7px}",
      "html body #page button.fo-t2-chip{font:700 11.5px Inter,sans-serif;border:1px solid #d9d0bc;background:#FFFEFC;color:#4c4437;border-radius:999px;padding:8px 15px;cursor:pointer}",
      "html body #page button.fo-t2-chip.on{background:#C9571F;border-color:#C9571F;color:#fff}",
      "html body.ftpskin button.fo-t2-chip{background:#FFFEFC !important;color:#4c4437 !important;border-color:#d9d0bc !important}",
      "html body.ftpskin button.fo-t2-chip.on{background:#C9571F !important;color:#fff !important;border-color:#C9571F !important}",
      "html body.ftpskin button.fo-t2-int{background:#FFFEFC !important;color:#8a8272 !important;border-color:#d9d0bc !important}",
      "html body.ftpskin button.fo-t2-int.on{background:#14243A !important;color:#E8B96A !important;border-color:#14243A !important}",
      "html body.ftpskin button.fo-t2-save{background:#C9571F !important;color:#fff !important;border:none !important}",
      ".fo-t2-unit{border-top:1px solid #f3eee1;padding:11px 0}",
      ".fo-t2-unit:first-of-type{border-top:none}",
      ".fo-t2-uh{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:7px}",
      ".fo-t2-uh b{font:700 13.5px Inter,sans-serif;color:#14243A}",
      ".fo-t2-uh i{font:500 11px Inter,sans-serif;color:#8a8272;font-style:normal;white-space:nowrap}",
      ".fo-t2-ur{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
      ".fo-t2-ur select,.fo-t2-proj select{font:600 12.5px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:8px 10px;max-width:100%}",
      ".fo-t2-ints{display:flex;gap:4px}",
      "html body #page button.fo-t2-int{font:700 9px Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;border:1px solid #d9d0bc;background:#FFFEFC;color:#8a8272;border-radius:7px;padding:6px 9px;cursor:pointer}",
      "html body #page button.fo-t2-int.on{background:#14243A;border-color:#14243A;color:#E8B96A}",
      ".fo-t2-rec{margin-top:8px;font:700 9.5px Oswald,sans-serif;letter-spacing:.14em;color:#8a6a1f;background:#F8ECD4;border:1px solid #e8d5a8;border-radius:8px;padding:7px 10px}",
      ".fo-t2-rec b{color:#14243A;margin-left:5px;letter-spacing:.06em}",
      ".fo-t2-rec span{display:block;margin-top:3px;font:400 11px Inter,sans-serif;letter-spacing:0;text-transform:none;color:#6d6455}",
      ".fo-t2-proj{border-top:1px dashed #e8d5a8;padding:11px 0;display:flex;flex-direction:column;gap:8px}",
      ".fo-t2-proj:first-of-type{border-top:none}",
      ".fo-t2-pb{display:flex;align-items:center;gap:9px;font:600 11.5px Inter,sans-serif;color:#4c4437}",
      ".fo-t2-pb span{flex:0 0 auto;text-transform:capitalize}",
      ".fo-t2-pb u{flex:1;height:8px;border-radius:4px;background:#ece7da;overflow:hidden;text-decoration:none;display:block}",
      ".fo-t2-pb u b{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#C9571F,#E8B96A)}",
      ".fo-t2-pb em{font-style:normal;font-variant-numeric:tabular-nums;color:#14243A;font-weight:700}",
      ".fo-t2-note{font:italic 400 11.5px Georgia,serif;color:#6d6455}",
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
      ".fo-t2-band b{font-size:13.5px}.fo-t2-band i{font-size:7.5px}",
      ".fo-t2-ur{align-items:stretch;flex-direction:column}.fo-t2-ints{justify-content:space-between}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();

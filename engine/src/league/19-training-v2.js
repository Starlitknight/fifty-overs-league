/* ============================================================================
   THE NETS (#/training) — ONE TRAINING PLAN, THE WAY FROM THE PAVILION
   RUNS IT: every man in the squad carries his own programme, and that is the
   whole system. No club focus, no unit plans, no intensity, no development
   projects, no coach - those were four layers stacked on top of a decision
   that is only ever made one player at a time.

   HOW FTP DOES IT, and what this page copies:
     - each player is assigned ONE training programme; the squad is a list of
       men and their programmes, nothing above it;
     - a programme trains several skills, hardest first - so Batting improves
       playing pace and spin most, then rotation and temperament, then a
       little stamina. FO_TRAIN_PROGS in the engine already has exactly this
       shape, so the programmes here ARE the engine's programmes;
     - REST is a programme like any other: a man on Rest works on nothing and
       recovers faster, which is how you get a tired side fresh for a big day;
     - the younger the man, the more a session is worth to him;
     - the academy sets the rate for the whole squad - it is the only
       building that touches the nets;
     - captaincy and experience are NOT trainable. They come from playing and
       from wearing the armband.

   HONESTY RULES. Every number on this page is real: training capacity is the
   engine's own fatigue multiplier, read off the served squad's fatigue word,
   and work banked is the man's real trainProgress against the engine's own
   threshold for the skill his programme works hardest.

   THE STORED SHAPE is the one the umpire's trainRound has always read -
   { "<player>": "<programme>" }. It used to carry a "__v2" key holding the
   focus/units/projects model; that key is no longer written, and any that
   survives in a stored plan is ignored on the way in.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foTrainV2) return; window.__foTrainV2 = 1;
  // this page owns #/training now (the flag the older renderers stand aside
  // for; league/18, which used to set it, is retired). With league/18 gone the
  // local resolver's session-and-coach wrappers go with it, and a local save
  // trains off p.training.program - the same one-programme-a-man model the
  // served world uses.
  try { window.__foNets = 1; } catch (eN) {}

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
  var PACE_T = { seamFast: 1, seamFastMedium: 1, seamMedium: 1, partTimeSeam: 1 };
  // the programme the engine itself would give a man - the plan opens on this
  function defaultProg(p) {
    if (p.keeper || p.role === "wicketkeeper") return "Keeping";
    if (p.role === "allRounder") return "All-rounder";
    var bt = p.bowlTypeFull || p.bowlType || "";
    if (PACE_T[bt] || /seam/i.test(bt)) return "New-ball seam";
    if (/spin|wrist|finger/i.test(bt)) return "Spin bowling";
    return p.role === "middleOrderBat" ? "Finishing" : "Batting";
  }
  function progsOf() { try { return window.FO_TRAIN_PROGS || {}; } catch (e) { return {}; } }
  // a programme's headline skill: the one it works hardest
  function topSkill(prog) {
    var w = progsOf()[prog] || {}, best = null, bv = -1;
    for (var k in w) if (w[k] > bv) { bv = w[k]; best = k; }
    return best;
  }
  var SKILL_NM = { vsPace: "playing pace", vsSpin: "playing spin", rotation: "strike rotation", temperament: "temperament",
    power: "power", stamina: "stamina", wicket: "wicket threat", economy: "economy", discipline: "discipline",
    moveTurn: "movement and turn", variation: "variation", keeping: "keeping", catching: "catching",
    stumping: "stumping", fielding: "fielding" };
  // one full normal session banks ~24 points; a step needs thresh(skill)
  function sessionsOf(p, prog) {
    var sk = topSkill(prog); if (!sk || !p) return null;
    var have = (p.trainProgress && p.trainProgress[sk]) || 0;
    var th = 80 + (((p.skills && p.skills[sk]) || 0) * 1.5);
    var of = Math.ceil(th / 24);
    return { sk: sk, of: of, done: Math.min(Math.floor(have / 24), of),
      pct: Math.max(0, Math.min(99, Math.round(100 * have / th))) };
  }

  // ---- THE PROGRAMMES, grouped only so a long list can be read ------------
  // Every programme is offered to every man, exactly as FTP does it: a seamer
  // may be sent to work on his batting, a batter may be put in the gloves. It
  // is the manager's call and the engine prices it honestly either way.
  var PROG_GROUPS = [
    ["Batting", ["Batting", "New-ball batting", "Spin batting", "Power hitting", "Finishing"]],
    ["Bowling", ["Bowling", "New-ball seam", "Spin bowling", "Death bowling", "Control bowling"]],
    ["All round", ["All-rounder"]],
    ["Behind the stumps", ["Keeping"]],
    ["In the field", ["Fielding"]],
    ["Conditioning", ["Fitness"]],
    ["Recovery", ["Rest"]]
  ];

  // ---- the plan: a name, a programme, and nothing else ---------------------
  // ONE PAGE, TWO HOMES. A club held in the served world files its plan with
  // the World Service and the umpire works it; a local save keeps the same
  // decision on the man himself, where the local resolver reads it. Same
  // model, same page - only where it is written down differs.
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
          if (typeof stored[k] === "string" && progsOf()[stored[k]]) sv.plan[k] = stored[k];
        }
      } else {
        var me = userTeam(), all = (me.players || []).concat(me.youth || []);
        all.forEach(function (p) {
          var pg = p.training && p.training.program;
          if (pg && progsOf()[pg]) sv.plan[p.name] = pg;
        });
      }
    } catch (e) {}
    return sv;
  }
  function progFor(p) {
    var st = loadState();
    return st.plan[p.name] || defaultProg(p);
  }
  // the filed plan is EXPLICIT for every man - what the page shows is what
  // the umpire works, with nothing left to a default the manager cannot see
  function buildPlan(squad) {
    var plan = {};
    squad.forEach(function (p) { plan[p.name] = progFor(p); });
    return plan;
  }

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

  // ---- the room -------------------------------------------------------------
  window.foRenderNetsPage = function () {
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foT2Css();
    try { document.body.classList.add("fo-nets-on"); } catch (eB) {}
    var st = loadState(), me = userTeam();
    var squad = (me.players || []).concat(me.youth || []);
    var caps = squad.map(capacityOf);
    var avgCap = caps.length ? Math.round(caps.reduce(function (a, b) { return a + b; }, 0) / caps.length) : 0;
    var resting = squad.filter(function (p) { return progFor(p) === "Rest"; }).length;

    var crest = ""; try { crest = window.foClubCrest ? foClubCrest(me.name, 56) : ""; } catch (eCr) {}
    var hero = "<div class='fo-t2-hero'><div>" +
      "<i>" + E(String(me.name || "").toUpperCase()) + " &middot; THE TRAINING GROUND</i>" +
      "<h1>The Nets</h1><p>One programme a man. That is the whole plan.</p></div>" +
      "<span class='cr'>" + crest + "</span></div>";

    // work banked: every point in every man's ledger, told in sessions
    var bankedPts = 0;
    squad.forEach(function (p) { var tp = p.trainProgress || {}; for (var k in tp) bankedPts += (+tp[k] || 0); });
    var bankedSes = Math.round(bankedPts / 24);
    var IC = {
      men: "<svg viewBox='0 0 24 24'><circle cx='8' cy='8' r='3'/><circle cx='16' cy='8' r='3'/><path d='M2 20 Q8 13 12 18 Q16 13 22 20'/></svg>",
      db: "<svg viewBox='0 0 24 24'><rect x='2' y='9' width='3' height='6' rx='1'/><rect x='19' y='9' width='3' height='6' rx='1'/><rect x='5' y='7' width='3' height='10' rx='1'/><rect x='16' y='7' width='3' height='10' rx='1'/><line x1='8' y1='12' x2='16' y2='12'/></svg>",
      bed: "<svg viewBox='0 0 24 24'><path d='M2 18 L2 8 M2 13 L22 13 L22 18'/><circle cx='7' cy='10' r='2'/></svg>",
      tm: "<svg viewBox='0 0 24 24'><circle cx='12' cy='13' r='8'/><line x1='12' y1='13' x2='12' y2='8'/><line x1='10' y1='2' x2='14' y2='2'/><line x1='12' y1='2' x2='12' y2='5'/></svg>"
    };
    var band = "<div class='fo-t2-band'>" +
      "<div><s>" + IC.men + "</s><span><b>" + squad.length + "</b><i>Squad in training</i></span></div>" +
      "<div><s>" + IC.bed + "</s><span><b>" + resting + "</b><i>On rest</i></span></div>" +
      "<div><s>" + IC.db + "</s><span><b>" + bankedSes + "</b><i>Work banked &middot; sessions</i></span></div>" +
      "<div><s>" + IC.tm + "</s><span><b>" + avgCap + "%</b><i>Avg capacity</i></span></div></div>";

    // ---- THE TRAINING PLAN, man by man --------------------------------------
    var nos = squadNumbers(squad);
    var roster = "<div class='fo-t2-card'><div class='fo-t2-ck'>Training plan</div>" +
      "<p class='fo-t2-dim'>Every man works the programme you set him, at every update, until you change it. " +
      "The younger he is the more each session is worth, and Rest is a programme: he trains at nothing and gets his legs back faster.</p>" +
      squad.map(function (p) {
        var prog = progFor(p);
        var ses = prog === "Rest" ? null : sessionsOf(p, prog);
        var cap = capacityOf(p);
        return "<div class='fo-t2-row'>" +
          "<span class='fo-t2-shirt'><svg viewBox='0 0 40 40'><path d='M13 4 L5 9 L8 16 L11 14 L11 36 L29 36 L29 14 L32 16 L35 9 L27 4 Q20 9 13 4 Z' fill='#14243A' stroke='#C9571F' stroke-width='1.4'/></svg><b>" + nos[p.name] + "</b></span>" +
          "<span class='fo-t2-who'><a href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + "</a>" +
          "<i>" + (p.age | 0) + " &middot; " + (p.hand === "L" ? "LH" : "RH") + " Bat &middot; " + E(abbrevOf(p)) +
          (cap <= 80 ? " &middot; " + E(p.fatWord || p.fatigue || "") : "") + "</i></span>" +
          "<span class='fo-t2-work'>" + (ses
            ? "<i>" + ses.done + " / " + ses.of + " &middot; " + E(SKILL_NM[ses.sk] || ses.sk) + "</i><u><b style='width:" + ses.pct + "%'></b></u>"
            : "<i>resting</i><u><b style='width:0'></b></u>") + "</span>" +
          "<select data-t2p='" + E(p.name) + "'>" + PROG_GROUPS.map(function (g) {
            var opts = g[1].filter(function (pg) { return progsOf()[pg] || pg === "Rest"; });
            if (!opts.length) return "";
            return "<optgroup label='" + E(g[0]) + "'>" + opts.map(function (pg) {
              return "<option value='" + E(pg) + "'" + (prog === pg ? " selected" : "") + ">" + E(pg) + "</option>";
            }).join("") + "</optgroup>";
          }).join("") + "</select>" +
          "</div>";
      }).join("") + "</div>";

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
      hero + band + roster + report +
      "<button type='button' class='fo-t2-save" + (st.dirty ? " dirty" : "") + "' id='fo-t2-save'><svg viewBox='0 0 24 24' class='pl'><path d='M2 21 L23 12 L2 3 L2 10 L17 12 L2 14 Z' fill='currentColor'/></svg>Save training plan" + (st.dirty ? " &middot; unsaved" : "") + "</button>" +
      "<p class='fo-t2-fine'>The academy sets the rate for the whole squad &mdash; it is the only building that reaches the nets. " +
      "On a match day the eleven who play bank the full session and the men left out train at half pace; on rest days the whole squad trains in full. " +
      "Captaincy and experience are never trained: they come from playing, and from wearing the armband.</p>" +
      "</div></div>";

    // ---- the hands ---------------------------------------------------------
    var rep = function () { window.foRenderNetsPage(); };
    page.querySelectorAll("select[data-t2p]").forEach(function (s) {
      s.addEventListener("change", function () {
        st.plan[s.getAttribute("data-t2p")] = s.value;
        st.dirty = 1; rep();
      });
    });
    var save = page.querySelector("#fo-t2-save");
    if (save) save.addEventListener("click", function () {
      try {
        var plan = buildPlan(squad);
        if (served()) {
          if (window.__foWorldPushTraining) window.__foWorldPushTraining(plan);
          window.__foWorldPlan = plan;
        } else {
          // the local resolver reads the programme off the man himself, and
          // intensity is no longer a lever anywhere: everyone works normally
          // and Rest is the programme you pick when you want legs back.
          squad.forEach(function (p) {
            if (!p.training || typeof p.training !== "object") p.training = { progressBySkill: {} };
            p.training.program = plan[p.name];
            p.training.intensity = "Normal";
            p.trainFocus = plan[p.name];
          });
          try { if (typeof saveGame === "function") saveGame(false); } catch (eG) {}
        }
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
      // the training plan, man by man: jersey / who / work banked / programme
      ".fo-t2-row{display:grid;grid-template-columns:38px minmax(0,1.2fr) minmax(90px,1fr) minmax(120px,150px);gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #f3eee1}",
      ".fo-t2-row:last-of-type{border-bottom:none}",
      ".fo-t2-shirt{position:relative;width:36px;height:36px}",
      ".fo-t2-shirt svg{width:36px;height:36px;display:block}",
      ".fo-t2-shirt b{position:absolute;inset:6px 0 0 0;text-align:center;font:800 12px Oswald,sans-serif;color:#F6F3EB}",
      ".fo-t2-who{min-width:0}",
      ".fo-t2-who a{display:block;font:700 13px Inter,sans-serif;color:#14243A !important;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-who i{display:block;font:500 10.5px Inter,sans-serif;color:#8a8272;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-work i{display:block;font:600 10.5px Inter,sans-serif;color:#4c4437;font-style:normal;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-t2-work u{display:block;height:6px;border-radius:3px;background:#ece7da;overflow:hidden;text-decoration:none}",
      ".fo-t2-work u b{display:block;height:100%;border-radius:3px;background:#177A57}",
      ".fo-t2-row select{width:100%;font:600 11.5px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:7px 6px;min-width:0}",
      ".fo-t2-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);padding:14px 16px;margin-bottom:12px}",
      ".fo-t2-ck{font:700 11px Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A;margin-bottom:8px}",
      ".fo-t2-dim{margin:0 0 10px;font:400 12px Inter,sans-serif;color:#6d6455;line-height:1.5}",
      ".fo-t2-note{font:italic 400 11.5px Georgia,serif;color:#6d6455}",
      ".fo-t2-report{border-left:4px solid #177A57}",
      ".fo-t2-rl{padding:6px 0;border-bottom:1px solid #f3eee1;font:500 12.5px Inter,sans-serif;color:#14243A;line-height:1.5}",
      ".fo-t2-rl:last-of-type{border-bottom:none}",
      ".fo-t2-save .pl{width:14px;height:14px;vertical-align:-2px;margin-right:8px}",
      "html body #page button.fo-t2-save{width:100%;font:700 13px Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;background:#C9571F;color:#fff;border:none;border-radius:11px;padding:14px;cursor:pointer;margin-top:2px}",
      "html body #page button.fo-t2-save:hover{background:#A64426}",
      "html body #page button.fo-t2-save.dirty{box-shadow:0 0 0 3px rgba(201,87,31,.25)}",
      "html body.ftpskin button.fo-t2-save{background:#C9571F !important;color:#fff !important;border:none !important}",
      ".fo-t2-fine{margin:9px 0 0;text-align:center;font:italic 400 11.5px Georgia,serif;color:#8a8272;line-height:1.6}",
      "@media(max-width:560px){.fo-t2-hero h1{font-size:27px}.fo-t2-hero .cr svg{width:42px;height:55px}",
      ".fo-t2-band b{font-size:12.5px}.fo-t2-band i{font-size:7px}.fo-t2-band s,.fo-t2-band s svg{width:17px;height:17px}.fo-t2-band>div{gap:5px;padding:9px 6px}",
      ".fo-t2-row{grid-template-columns:28px minmax(0,1.3fr) minmax(62px,.7fr) minmax(86px,98px);gap:6px}",
      ".fo-t2-shirt,.fo-t2-shirt svg{width:30px;height:30px}.fo-t2-shirt b{inset:5px 0 0 0;font-size:10px}",
      ".fo-t2-who a{font-size:11.5px}.fo-t2-who i{font-size:9px}",
      ".fo-t2-work i{font-size:9px}.fo-t2-row select{font-size:10px;padding:6px 4px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();

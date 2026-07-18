/* features/lineup — the Lineup Room (#/lineup).
 *
 * Four questions, in order: who is in the XI, what order they bat, who
 * carries the gloves and the armband, and is the card legal. Everything is
 * tap-first (no drag required), works as three panes on desktop and four
 * steps on a phone, and holds a DRAFT — nothing touches the engine until
 * Confirm, which routes through the legacy adapter (the only mutation path)
 * and emits LineupConfirmed. Validation is neutral and factual: the room
 * reports counts and gaps, never "too weak".
 */
FOC.lineup = (function () {
  var U = FOC.util, A = FOC.adapter;
  var draft = null, undoStack = [], sel = null, cmp = [], step = 1, noteTimer = null;
  var allCands = false, filterQ = "", filterRole = "ALL";

  function esc(s) { return U.esc(s); }
  function roster() { return A.players().filter(Boolean); }
  function byName(nm) {
    var hit = null; roster().forEach(function (p) { if (p.name === nm) hit = p; });
    return hit;
  }
  function roleOf(p) {
    if (p.keeper) return { k: "WK", c: "#B08D2E" };
    if (p.bowlType && !A.isPartTimer(p)) return { k: /spin/i.test(p.bowlType) ? "SPIN" : "PACE", c: "#4E7A4E" };
    if (p.bowlType) return { k: "AR", c: "#7A5C9E" };
    return { k: "BAT", c: "#C8674A" };
  }

  function freshDraft() {
    try {
      if (App.orders && App.orders.saved && App.orders.batOrder && App.orders.batOrder.length === 11) {
        return { xi: App.orders.batOrder.slice(), captain: App.orders.captain, keeper: App.orders.keeper };
      }
    } catch (e) {}
    return suggested();
  }
  function suggested() {
    try {
      var xi = pickXI(userTeam()).map(function (p) { return p.name; });
      var kp = null, cp = null;
      xi.forEach(function (nm) { var p = byName(nm); if (p && p.keeper && !kp) kp = nm; });
      cp = FOC.game.save().castNames.captain || xi[0];
      if (xi.indexOf(cp) < 0) cp = xi[0];
      return { xi: xi, captain: cp, keeper: kp || xi[0] };
    } catch (e) { return { xi: [], captain: null, keeper: null }; }
  }
  function snap() { undoStack.push(U.deep(draft)); if (undoStack.length > 40) undoStack.shift(); }
  function undo() { if (undoStack.length) { draft = undoStack.pop(); render(true); } }

  function toggle(nm) {
    snap();
    var i = draft.xi.indexOf(nm);
    if (i >= 0) {
      draft.xi.splice(i, 1);
      if (draft.captain === nm) draft.captain = null;
      if (draft.keeper === nm) draft.keeper = null;
    } else {
      if (draft.xi.length >= 11) { undoStack.pop(); flash("The card holds eleven — remove someone first."); return; }
      draft.xi.push(nm);
      var p = byName(nm);
      if (p && p.keeper && !draft.keeper) draft.keeper = nm;
    }
    render(true);
  }
  function move(i, d) {
    var j = i + d; if (j < 0 || j >= draft.xi.length) return;
    snap();
    var t = draft.xi[i]; draft.xi[i] = draft.xi[j]; draft.xi[j] = t;
    render(true);
  }

  var flashMsg = null, flashT = null;
  function flash(m) {
    flashMsg = m; render(true);
    clearTimeout(flashT); flashT = setTimeout(function () { flashMsg = null; render(true); }, 3200);
  }

  function careerV2() {
    try { return FOC.career && FOC.career.active() ? FOC.career.career() : null; } catch (e) { return null; }
  }
  function memories(nm) {
    var out = [];
    var v2 = careerV2();
    if (v2) {
      (v2.flags.userFactsHist || []).forEach(function (f) {
        (f.batLines || []).forEach(function (b) { if (b.nm === nm) out.push(b.r + (b.out ? "" : "*") + " (" + b.b + ")"); });
        (f.bowlLines || []).forEach(function (b) { if (b.nm === nm) out.push(b.w + "-" + b.r); });
      });
    } else {
      var s = FOC.game.save();
      s.matches.forEach(function (m) {
        (m.facts.batLines || []).forEach(function (b) { if (b.nm === nm) out.push(b.r + (b.out ? "" : "*") + " (" + b.b + ") vs " + m.opp); });
        (m.facts.bowlLines || []).forEach(function (b) { if (b.nm === nm) out.push(b.w + "-" + b.r + " vs " + m.opp); });
      });
    }
    return out.slice(-5);
  }
  function seasonLine(nm) {
    var v2 = careerV2(); if (!v2) return null;
    var r = 0, inns = 0, w = 0;
    (v2.flags.userFactsHist || []).forEach(function (f) {
      (f.batLines || []).forEach(function (b) { if (b.nm === nm) { r += b.r; inns++; } });
      (f.bowlLines || []).forEach(function (b) { if (b.nm === nm) w += b.w; });
    });
    if (!inns && !w) return null;
    return "Season: " + (inns ? r + " runs in " + inns + " inns" : "") + (inns && w ? " · " : "") + (w ? w + " wickets" : "");
  }

  function bar(lbl, v) {
    var w = U.clamp(Math.round(v), 0, 100);
    return "<div class='lr-bar'><span class='l'>" + lbl + "</span><span class='t' aria-hidden='true'><i style='width:" + w + "%'></i></span><span class='n'>" + w + "</span></div>";
  }
  function evidence(p) {
    // evidence, not verdicts: raw aggregates + real scorecard memories
    var h = "<div class='lr-ev'>";
    h += "<div class='lr-ev-h'>" + esc(p.name) + " <span class='sub'>" + esc(roleOf(p).k) + " · " + p.age + " · " + esc(p.hand || "") + "</span></div>";
    h += bar("Batting", p.bat || 0);
    if (p.bowlType) h += bar("Bowling", ((p.threat || 0) + (p.control || 0)) / 2);
    if (p.keeper) h += bar("Keeping", p.keep || 0);
    h += bar("Fielding", p.field || 0);
    var sl = seasonLine(p.name);
    if (sl) h += "<div class='lr-mem'><b>" + esc(sl) + "</b></div>";
    var mem = memories(p.name);
    if (mem.length) h += "<div class='lr-mem'><b>Recent:</b> " + mem.map(esc).join(" · ") + "</div>";
    else h += "<div class='lr-mem sub'>No scorecards yet — evidence arrives one match at a time.</div>";
    var v2p = careerV2();
    if (v2p) {
      (v2p.story.promises || []).forEach(function (pr) {
        if (pr.nm === p.name && pr.status === "active") h += "<div class='lr-mem' style='color:#B08D2E'><b>Promise:</b> " + esc(pr.txt) + " (" + pr.left + " left)</div>";
      });
    }
    return h + "</div>";
  }

  function noteBox(p) {
    var s = FOC.game.save();
    var pid = FOC.ids.playerId(s, p);
    var v = s.notes[pid] || "";
    return "<label class='lr-notel' for='lr-note'>Private manager note</label>" +
      "<textarea id='lr-note' class='lr-note' data-pid='" + esc(pid) + "' rows='2' placeholder='Only you see this.'>" + esc(v) + "</textarea>";
  }

  function html() {
    // career mode validates against the CANONICAL career promises and events
    var v2h = careerV2();
    var v = A.validate(draft, v2h ? { promises: v2h.story.promises, events: v2h.history.events } : FOC.game.save());
    var isCamp = false, oppLine = "";
    try {
      if (App.pending && (App.pending.__camp || App.pending.__career)) {
        isCamp = true;
        oppLine = "vs " + App.pending.away + " · " + App.pending.ground + " · " + (App.pending.pitch || "") + " pitch, " + (App.pending.weather || "");
      } else if (App.pending && App.pending.__friendly) oppLine = "Friendly vs " + App.pending.away;
      else oppLine = "League plan";
    } catch (e) {}
    var narrow = false;
    try { narrow = document.documentElement.clientWidth <= 880; } catch (e2) {}

    var h = "<div class='fo-lr' data-step='" + step + "'>";
    h += "<div class='lr-head'><div class='lr-kicker'>The Lineup Room</div><h2 class='lr-h1'>" + esc(oppLine) + "</h2>";
    h += "<div class='lr-count' role='status'>" + draft.xi.length + " of 11 picked" +
      (draft.captain ? " · captain " + esc(draft.captain.split(" ").slice(-1)[0]) : " · no captain") +
      (draft.keeper ? " · gloves " + esc(draft.keeper.split(" ").slice(-1)[0]) : " · no keeper") + "</div></div>";
    if (flashMsg) h += "<div class='lr-flash' role='alert'>" + esc(flashMsg) + "</div>";

    if (narrow) {
      h += "<div class='lr-steps' role='tablist'>" +
        [1, 2, 3, 4].map(function (n) {
          var lbl = ["Pick", "Order", "Roles", "Confirm"][n - 1];
          return "<button role='tab' aria-selected='" + (step === n) + "' class='lr-step" + (step === n ? " on" : "") + "' data-step='" + n + "'>" + n + " · " + lbl + "</button>";
        }).join("") + "</div>";
    }

    h += "<div class='lr-panes'>";
    // ---- pane 1: the squad ----
    h += "<section class='lr-pane lr-squad' aria-label='Squad'" + (narrow && step !== 1 ? " hidden" : "") + ">";
    h += "<div class='lr-pt'>Squad — tap to pick</div>";
    h += "<div class='lr-filters'><input id='lr-q' type='search' placeholder='Search name…' value='" + esc(filterQ) + "' aria-label='Search squad'>" +
      ["ALL", "BAT", "WK", "AR", "PACE", "SPIN"].map(function (rk) {
        return "<button class='lr-frole" + (filterRole === rk ? " on" : "") + "' data-role='" + rk + "'>" + rk + "</button>";
      }).join("") + "</div>";
    roster().slice().sort(function (a, b) { return (draft.xi.indexOf(b.name) >= 0 ? 1 : 0) - (draft.xi.indexOf(a.name) >= 0 ? 1 : 0) || (b.bat || 0) - (a.bat || 0); })
      .forEach(function (p) {
        var inXI = draft.xi.indexOf(p.name) >= 0, r = roleOf(p);
        h += "<div class='lr-row" + (inXI ? " in" : "") + "' data-nm='" + esc(p.name.toLowerCase()) + "' data-role='" + r.k + "'>" +
          "<button class='lr-pick' data-nm='" + esc(p.name) + "' aria-pressed='" + inXI + "' aria-label='" + (inXI ? "Remove " : "Pick ") + esc(p.name) + "'>" +
          "<span class='chip' style='--rc:" + r.c + "'>" + r.k + "</span><span class='nm'>" + esc(p.name) + "</span><span class='ag'>" + p.age + "</span>" +
          "<span class='st'>" + (inXI ? "IN" : "—") + "</span></button>" +
          "<button class='lr-info' data-nm='" + esc(p.name) + "' aria-label='Details for " + esc(p.name) + "'>i</button>" +
          "<label class='lr-cmp'><input type='checkbox' data-cmp='" + esc(p.name) + "'" + (cmp.indexOf(p.name) >= 0 ? " checked" : "") + "><span>vs</span></label>" +
          "</div>";
      });
    h += "</section>";

    // ---- pane 2: the XI in order + roles ----
    h += "<section class='lr-pane lr-xi' aria-label='Your XI'" + (narrow && step !== 2 && step !== 3 ? " hidden" : "") + ">";
    h += "<div class='lr-pt'>Batting order</div>";
    if (!draft.xi.length) h += "<div class='sub' style='padding:8px 2px'>Nobody picked yet.</div>";
    draft.xi.forEach(function (nm, i) {
      var p = byName(nm), r = p ? roleOf(p) : { k: "?", c: "#888" };
      h += "<div class='lr-xirow" + (sel === nm ? " sel" : "") + "'>" +
        "<select class='lr-pos' data-i='" + i + "' aria-label='Batting position for " + esc(nm) + "'>" +
        draft.xi.map(function (_, j) { return "<option value='" + j + "'" + (j === i ? " selected" : "") + ">" + (j + 1) + "</option>"; }).join("") + "</select>" +
        "<button class='lr-xisel' data-nm='" + esc(nm) + "'><span class='chip' style='--rc:" + r.c + "'>" + r.k + "</span><span class='nm'>" + esc(nm) + "</span>" +
        (draft.captain === nm ? "<span class='bdg c'>C</span>" : "") + (draft.keeper === nm ? "<span class='bdg wk'>WK</span>" : "") + "</button>" +
        "<span class='mv'><button class='lr-up' data-i='" + i + "' aria-label='Move " + esc(nm) + " up'" + (i === 0 ? " disabled" : "") + ">▲</button>" +
        "<button class='lr-dn' data-i='" + i + "' aria-label='Move " + esc(nm) + " down'" + (i === draft.xi.length - 1 ? " disabled" : "") + ">▼</button></span></div>";
    });
    if (narrow ? step === 3 : true) {
      h += "<div class='lr-pt' style='margin-top:12px'>Responsibilities</div>";
      h += "<div class='lr-roles'>";
      var capCands = draft.xi.slice().sort(function (a, b) { return ((byName(b) || {}).capt || 0) - ((byName(a) || {}).capt || 0); });
      if (!allCands) capCands = capCands.slice(0, 5).concat(draft.captain && capCands.slice(0, 5).indexOf(draft.captain) < 0 ? [draft.captain] : []);
      h += "<div class='lr-rl'><span>Captain <span class='sub'>(top leadership marks" + (allCands ? "" : " — <a href='#' id='lr-allc'>show all</a>") + ")</span></span><div class='opts'>" + capCands.map(function (nm) {
        return "<button class='lr-setc" + (draft.captain === nm ? " on" : "") + "' data-nm='" + esc(nm) + "' aria-pressed='" + (draft.captain === nm) + "'>" + esc(nm.split(" ").slice(-1)[0]) + "</button>";
      }).join("") + "</div></div>";
      var wkCands = draft.xi.filter(function (nm) { var p = byName(nm); return p && p.keeper; });
      if (allCands || !wkCands.length) wkCands = draft.xi.slice();
      else if (draft.keeper && wkCands.indexOf(draft.keeper) < 0) wkCands.push(draft.keeper);
      h += "<div class='lr-rl'><span>Keeper <span class='sub'>(trained keepers" + (allCands ? "" : " — <a href='#' id='lr-allk'>show all</a>") + ")</span></span><div class='opts'>" + wkCands.map(function (nm) {
        var p = byName(nm);
        return "<button class='lr-setk" + (draft.keeper === nm ? " on" : "") + "' data-nm='" + esc(nm) + "' aria-pressed='" + (draft.keeper === nm) + "'>" + esc(nm.split(" ").slice(-1)[0]) + (p && p.keeper ? " ✚" : "") + "</button>";
      }).join("") + "</div><div class='sub'>✚ marks a trained keeper — the gloves are still your call.</div></div>";
      h += "</div>";
    }
    h += "</section>";

    // ---- pane 3: evidence + validation + confirm ----
    h += "<section class='lr-pane lr-side' aria-label='Evidence and confirmation'" + (narrow && step !== 4 && !sel && cmp.length < 2 ? " hidden" : "") + ">";
    if (cmp.length === 2) {
      var pa = byName(cmp[0]), pb = byName(cmp[1]);
      h += "<div class='lr-pt'>Side by side</div><div class='lr-cmp2'>" +
        (pa ? evidence(pa) : "") + (pb ? evidence(pb) : "") + "</div>" +
        "<button class='lr-cmpx'>Close comparison</button>";
    } else if (sel && byName(sel)) {
      h += "<div class='lr-pt'>The evidence</div>" + evidence(byName(sel)) + noteBox(byName(sel));
    } else {
      h += "<div class='lr-pt'>The card</div><div class='sub'>Tap a name for evidence, or tick two “vs” boxes to compare.</div>";
    }
    h += "<div class='lr-pt' style='margin-top:12px'>Legality</div><div class='lr-val'>";
    if (v.errors.length) v.errors.forEach(function (e2) { h += "<div class='lr-err'>✕ " + esc(e2) + "</div>"; });
    else h += "<div class='lr-ok'>✓ The card is legal.</div>";
    v.facts.forEach(function (f2) { h += "<div class='lr-fact'>• " + esc(f2) + "</div>"; });
    h += "</div>";
    h += "<div class='lr-act'>" +
      "<button id='lr-confirm' class='lr-go'" + (v.ok ? "" : " disabled") + ">" + (isCamp ? "Confirm XI — walk out ▸" : "Confirm XI ▸") + "</button>" +
      "<button id='lr-undo'" + (undoStack.length ? "" : " disabled") + ">Undo</button>" +
      "<button id='lr-auto'>Coach's suggestion</button>" +
      "<button id='lr-cancel'>Discard draft</button></div>";
    h += "</section></div>";

    if (narrow) {
      h += "<div class='lr-mnav'>" +
        (step > 1 ? "<button class='lr-prev'>◂ Back</button>" : "<span></span>") +
        (step < 4 ? "<button class='lr-next'>Next ▸</button>" : "<span></span>") + "</div>";
    }
    h += "</div>";
    return h;
  }

  function wire(page) {
    page.querySelectorAll(".lr-pick").forEach(function (b) { b.addEventListener("click", function () { toggle(b.getAttribute("data-nm")); }); });
    page.querySelectorAll(".lr-info, .lr-xisel").forEach(function (b) {
      b.addEventListener("click", function () { sel = b.getAttribute("data-nm"); render(true); });
    });
    page.querySelectorAll(".lr-pos").forEach(function (selEl) {
      selEl.addEventListener("change", function () {
        var from = +selEl.getAttribute("data-i"), to = +selEl.value;
        if (from === to) return;
        snap();
        var nm = draft.xi.splice(from, 1)[0];
        draft.xi.splice(to, 0, nm);
        render(true);
      });
    });
    function applyFilter() {
      page.querySelectorAll(".lr-row").forEach(function (row) {
        var okQ = !filterQ || (row.getAttribute("data-nm") || "").indexOf(filterQ.toLowerCase()) >= 0;
        var okR = filterRole === "ALL" || row.getAttribute("data-role") === filterRole;
        row.style.display = okQ && okR ? "" : "none";
      });
    }
    var q = page.querySelector("#lr-q");
    if (q) q.addEventListener("input", function () { filterQ = q.value; applyFilter(); });
    page.querySelectorAll(".lr-frole").forEach(function (b) {
      b.addEventListener("click", function () {
        filterRole = b.getAttribute("data-role");
        page.querySelectorAll(".lr-frole").forEach(function (x) { x.classList.toggle("on", x === b); });
        applyFilter();
      });
    });
    applyFilter();
    var ac = page.querySelector("#lr-allc"); if (ac) ac.addEventListener("click", function (e) { e.preventDefault(); allCands = true; render(true); });
    var ak = page.querySelector("#lr-allk"); if (ak) ak.addEventListener("click", function (e) { e.preventDefault(); allCands = true; render(true); });
    page.querySelectorAll(".lr-up").forEach(function (b) { b.addEventListener("click", function () { move(+b.getAttribute("data-i"), -1); }); });
    page.querySelectorAll(".lr-dn").forEach(function (b) { b.addEventListener("click", function () { move(+b.getAttribute("data-i"), 1); }); });
    page.querySelectorAll(".lr-setc").forEach(function (b) { b.addEventListener("click", function () { snap(); draft.captain = b.getAttribute("data-nm"); render(true); }); });
    page.querySelectorAll(".lr-setk").forEach(function (b) { b.addEventListener("click", function () { snap(); draft.keeper = b.getAttribute("data-nm"); render(true); }); });
    page.querySelectorAll("input[data-cmp]").forEach(function (c) {
      c.addEventListener("change", function () {
        var nm = c.getAttribute("data-cmp");
        var i = cmp.indexOf(nm);
        if (i >= 0) cmp.splice(i, 1); else { cmp.push(nm); if (cmp.length > 2) cmp.shift(); }
        render(true);
      });
    });
    var cx = page.querySelector(".lr-cmpx"); if (cx) cx.addEventListener("click", function () { cmp = []; render(true); });
    page.querySelectorAll(".lr-step").forEach(function (b) { b.addEventListener("click", function () { step = +b.getAttribute("data-step"); render(true); }); });
    var pv = page.querySelector(".lr-prev"); if (pv) pv.addEventListener("click", function () { step = Math.max(1, step - 1); render(true); });
    var nx = page.querySelector(".lr-next"); if (nx) nx.addEventListener("click", function () { step = Math.min(4, step + 1); render(true); });
    var note = page.querySelector("#lr-note");
    if (note) note.addEventListener("input", function () {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () {
        var s = FOC.game.save(), pid = note.getAttribute("data-pid");
        var had = !!s.notes[pid];
        s.notes[pid] = note.value.slice(0, 400);
        if (!had) FOC.events.emit(s, "NoteWritten", { pid: pid });
        FOC.save.persist(s);
        var v2n = careerV2();
        if (v2n) { v2n.story.notes[pid] = s.notes[pid]; FOC.career.persist(); }
      }, 500);
    });
    var un = page.querySelector("#lr-undo"); if (un) un.addEventListener("click", undo);
    var au = page.querySelector("#lr-auto"); if (au) au.addEventListener("click", function () { snap(); draft = suggested(); flash("The coach's card — yours to change."); });
    var ca = page.querySelector("#lr-cancel"); if (ca) ca.addEventListener("click", function () {
      draft = null; undoStack = []; sel = null; cmp = [];
      location.hash = FOC.game.save().flags.liveMatch ? "#/summer" : "#/club";
      if (typeof window.route === "function") window.route();
    });
    var go = page.querySelector("#lr-confirm");
    if (go) go.addEventListener("click", function () {
      var s = FOC.game.save();
      var res = A.applyOrders(s, draft);
      if (!res.ok) { flash(res.errors[0] || "The card isn't legal yet."); return; }
      draft = null; undoStack = []; sel = null; cmp = [];
      var camp = false; try { camp = !!(App.pending && (App.pending.__camp || App.pending.__career)); } catch (e) {}
      // campaign: the keeper walks the manager out to the match centre;
      // league/friendly: back to the club with the plan saved
      if (!camp) { location.hash = "#/club"; if (typeof window.route === "function") window.route(); }
    });
  }

  var lastSig = null;
  function render(force) {
    try {
      if (location.hash.indexOf("#/lineup") !== 0) return;
      var page = document.getElementById("page"); if (!page) return;
      if (!draft) { draft = freshDraft(); undoStack = []; }
      var sig = JSON.stringify([draft, sel, cmp, step, flashMsg, undoStack.length]);
      if (!force && page.__lrSig === sig && page.querySelector(".fo-lr")) return;
      page.__lrSig = sig;
      var active = document.activeElement && document.activeElement.id === "lr-note";
      if (active && !force) return;   // don't clobber a note mid-keystroke
      page.innerHTML = html();
      wire(page);
    } catch (e) {}
  }

  function css() {
    if (document.getElementById("fo-lr-css")) return;
    var st = document.createElement("style"); st.id = "fo-lr-css";
    st.textContent =
      ".fo-lr{max-width:1060px;margin:0 auto;padding:4px 2px 40px}" +
      ".lr-kicker{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#C9A24B}" +
      ".lr-h1{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:1.4px;font-size:clamp(19px,4vw,26px);color:#101B2D;margin:2px 0 2px}" +
      ".lr-count{color:#5b6472;font-size:13px}" +
      ".lr-flash{background:#FBEFE8;border:1px solid #C8674A;color:#8a3a24;border-radius:8px;padding:8px 12px;margin:8px 0;font-size:13px}" +
      ".lr-steps{display:flex;gap:6px;margin:10px 0}" +
      "html body #page .lr-step{flex:1;background:#F6F1E3;border:1px solid #d8d0b8;border-radius:8px;padding:8px 4px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5b6472}" +
      "html body #page .lr-step.on{background:#14213D;color:#F1EADA;border-color:#14213D}" +
      ".lr-panes{display:grid;grid-template-columns:1.1fr 1fr 1.1fr;gap:14px;margin-top:10px}" +
      "@media(max-width:880px){.lr-panes{grid-template-columns:1fr}}" +
      ".lr-pane{background:#FDFBF4;border:1px solid #e3dcc6;border-radius:12px;padding:10px}" +
      ".lr-pt{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a90a0;margin-bottom:6px}" +
      ".lr-filters{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px;align-items:center}" +
      ".lr-filters input{flex:1 1 110px;border:1px solid #d8d0b8;border-radius:8px;padding:6px 8px;font-size:12px;background:#fff;min-width:0}" +
      "html body #page .lr-frole{border:1px solid #d8d0b8;background:#fff;border-radius:99px;padding:4px 8px;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.8px;color:#5b6472}" +
      "html body #page .lr-frole.on{background:#14213D;color:#F1EADA;border-color:#14213D}" +
      "html body #page .lr-pos{border:1px solid #d8d0b8;border-radius:6px;background:#F6F1E3;font-family:Oswald,sans-serif;font-size:12px;color:#C9A24B;padding:3px 1px;min-width:38px;min-height:34px}" +
      ".lr-row{display:flex;align-items:center;gap:6px;margin:3px 0}" +
      "html body #page .lr-pick{flex:1;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e3dcc6;border-radius:8px;padding:7px 9px;text-align:left;color:#101B2D;min-height:40px}" +
      "html body #page .lr-row.in .lr-pick{background:#EFF5EC;border-color:#4E7A4E}" +
      ".lr-pick .chip,.lr-xirow .chip{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:1px;color:#fff;background:var(--rc);border-radius:4px;padding:2px 5px;min-width:32px;text-align:center}" +
      ".lr-pick .nm{flex:1;font-size:13.5px}.lr-pick .ag{color:#8a90a0;font-size:12px}" +
      ".lr-pick .st{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1px;color:#4E7A4E;min-width:22px;text-align:right}" +
      "html body #page .lr-info{width:34px;height:34px;border-radius:50%;border:1px solid #d8d0b8;background:#F6F1E3;color:#5b6472;font-style:italic;font-weight:700}" +
      ".lr-cmp{display:flex;align-items:center;gap:3px;font-size:10px;color:#8a90a0}" +
      ".lr-xirow{display:flex;align-items:center;gap:6px;margin:3px 0}" +
      ".lr-xirow .pos{font-family:Oswald,sans-serif;color:#C9A24B;min-width:18px;text-align:right}" +
      "html body #page .lr-xisel{flex:1;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e3dcc6;border-radius:8px;padding:7px 9px;text-align:left;color:#101B2D;min-height:40px}" +
      ".lr-xirow.sel .lr-xisel{border-color:#14213D;box-shadow:0 0 0 1px #14213D}" +
      ".lr-xisel .nm{flex:1;font-size:13.5px}" +
      ".bdg{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:1px;border-radius:4px;padding:2px 5px}" +
      ".bdg.c{background:#14213D;color:#F1EADA}.bdg.wk{background:#B08D2E;color:#fff}" +
      ".lr-xirow .mv{display:flex;flex-direction:column;gap:2px}" +
      "html body #page .lr-up,html body #page .lr-dn{width:34px;height:19px;line-height:1;border:1px solid #d8d0b8;background:#F6F1E3;border-radius:5px;font-size:9px;color:#5b6472}" +
      "html body #page .lr-up:disabled,html body #page .lr-dn:disabled{opacity:.35}" +
      ".lr-rl{margin:6px 0}.lr-rl>span{font-size:12px;color:#5b6472;display:block;margin-bottom:3px}" +
      ".lr-rl .opts{display:flex;flex-wrap:wrap;gap:4px}" +
      "html body #page .lr-setc,html body #page .lr-setk{border:1px solid #d8d0b8;background:#fff;border-radius:99px;padding:5px 10px;font-size:12px;color:#101B2D;min-height:32px}" +
      "html body #page .lr-setc.on,html body #page .lr-setk.on{background:#14213D;color:#F1EADA;border-color:#14213D}" +
      ".lr-ev{background:#fff;border:1px solid #e3dcc6;border-radius:10px;padding:9px;margin:4px 0}" +
      ".lr-ev-h{font-weight:700;color:#101B2D;font-size:14px;margin-bottom:5px}.lr-ev-h .sub{font-weight:400;color:#8a90a0;font-size:12px}" +
      ".lr-bar{display:flex;align-items:center;gap:7px;margin:3px 0;font-size:11px;color:#5b6472}" +
      ".lr-bar .l{min-width:52px}.lr-bar .t{flex:1;height:7px;background:#EDE6D2;border-radius:5px;overflow:hidden}" +
      ".lr-bar .t i{display:block;height:100%;background:linear-gradient(90deg,#C8674A,#C9A24B);border-radius:5px}" +
      ".lr-bar .n{min-width:22px;text-align:right;font-variant-numeric:tabular-nums}" +
      ".lr-mem{font-size:12px;color:#5b6472;margin-top:5px}.lr-mem b{color:#101B2D}" +
      ".lr-cmp2{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:520px){.lr-cmp2{grid-template-columns:1fr}}" +
      "html body #page .lr-cmpx{border:1px solid #d8d0b8;background:#F6F1E3;border-radius:8px;padding:6px 10px;font-size:12px;color:#5b6472;margin-top:4px}" +
      ".lr-notel{display:block;font-size:11px;color:#8a90a0;margin:8px 0 3px}" +
      ".lr-note{width:100%;box-sizing:border-box;border:1px solid #d8d0b8;border-radius:8px;padding:7px;font:inherit;font-size:13px;background:#fff;color:#101B2D}" +
      ".lr-val{font-size:12.5px}" +
      ".lr-err{color:#9c2f18;margin:3px 0}.lr-ok{color:#2E7A3C;margin:3px 0}.lr-fact{color:#5b6472;margin:3px 0}" +
      ".lr-act{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}" +
      "html body #page .lr-go{background:#C8674A;border:none;color:#fff;border-radius:9px;padding:11px 16px;font-family:Oswald,sans-serif;letter-spacing:1.2px;text-transform:uppercase;font-size:13px;min-height:44px}" +
      "html body #page .lr-go:disabled{background:#c9c2ae;color:#7d7766}" +
      "html body #page .lr-act button:not(.lr-go){border:1px solid #d8d0b8;background:#F6F1E3;border-radius:9px;padding:10px 12px;font-size:12px;color:#5b6472;min-height:44px}" +
      ".lr-mnav{display:flex;justify-content:space-between;margin-top:10px}" +
      "html body #page .lr-mnav button{border:1px solid #14213D;background:#14213D;color:#F1EADA;border-radius:9px;padding:11px 18px;font-family:Oswald,sans-serif;letter-spacing:1px;text-transform:uppercase;font-size:12px;min-height:44px}" +
      ".fo-lr .sub{color:#8a90a0;font-size:12px}" +
      ".fo-lr button:focus-visible{outline:3px solid #C9A24B;outline-offset:1px}" +
      "@media(prefers-reduced-motion:no-preference){.lr-row,.lr-xirow{transition:background .15s}}";
    document.head.appendChild(st);
  }

  function init() {
    if (typeof window === "undefined") return;
    css();
    window.addEventListener("hashchange", function () {
      if (location.hash.indexOf("#/lineup") === 0) { lastSig = null; setTimeout(function () { render(true); }, 30); }
    });
    setInterval(function () { render(false); }, 900);
  }

  return { init: init, render: render, freshDraft: freshDraft,
    _test: { getDraft: function () { return draft; }, setDraft: function (d) { draft = d; }, toggle: toggle, move: move, undo: undo } };
})();

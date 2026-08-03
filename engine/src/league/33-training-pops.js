/* ============================================================================
   TRAINING POPS — the noticeboard moment. In every real club there is a
   morning when the coach pins the week's numbers up and somebody's name has
   an arrow next to it. This module is that morning, three times over:

   - THE NETS (#/training): a celebration strip above the development report.
     Every skill jump from the last two settled rounds gets a green chip that
     pops onto the board one after another.
   - THE SQUAD (#/squad): roster rows carry a small ▲ pop chip while a
     player's gains are fresh, so a scroll down the list shows at a glance
     who the week was kind to.
   - THE PLAYER PAGE (#/player): a Development panel — the man's whole
     training history from the log, newest first, fresh pops lit green.

   Offline-fair by construction: this module WRITES NOTHING. It only reads
   App.ls.tr.log, which The Nets settles inside completeRound with a seeded
   RNG — so every client, present or absent, sees the identical board.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foPops) return;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { return typeof App !== "undefined" && App && App.ls && App.season; }
  // The Nets keeps foSkillLbl private to its own closure, so the ledger of
  // names lives here too - same words the training page uses
  var SKILL_LBL = { vsPace: "vs pace", vsSpin: "vs spin", rotation: "rotation", temperament: "temperament", power: "power",
    wicket: "wicket threat", economy: "economy", discipline: "discipline", variation: "variation", stamina: "stamina",
    fielding: "ground fielding", catching: "catching", keeping: "keeping", stumping: "stumping" };
  function lbl(k) { return SKILL_LBL[k] || k; }

  // fresh = gains from the last two settled rounds of the current season, so
  // a manager who slept through a matchday still walks in on the celebration
  // The Nets owns the one true reading of this club's log - only the men who
  // are actually here, and nothing at all where the umpire does the training.
  // Reading App.ls.tr.log raw is what put another club's cricketers on the
  // noticeboard beside a plan listing this club's.
  function foPopsLog() {
    try { return (typeof window.__foTrainLog === "function") ? (window.__foTrainLog() || []) : []; }
    catch (e) { return []; }
  }
  function foPopsRecent() {
    if (!ready()) return [];
    var s = App.seasonNo || 1, cut = (App.season.round || 0) - 2;
    return foPopsLog().filter(function (l) { return l && l.r >= 0 && l.s === s && l.r >= cut; });
  }
  function foPopsFor(name) {
    if (!ready()) return [];
    return foPopsLog().filter(function (l) { return l && l.n === name; });
  }
  function foPopsCounts() {
    var m = {};
    foPopsRecent().forEach(function (l) {
      if (!m[l.n]) m[l.n] = { n: 0, ks: [] };
      m[l.n].n++; if (m[l.n].ks.indexOf(l.k) < 0) m[l.n].ks.push(l.k);
    });
    return m;
  }
  window.__foPops = { recent: foPopsRecent, forPlayer: foPopsFor, counts: foPopsCounts };

  // ---------------------------------------------------------------------------
  // The Nets: the noticeboard strip
  // ---------------------------------------------------------------------------
  function foPopsNetsStrip() {
    var pane = document.querySelector(".fo-ns-grid"); if (!pane) return;
    if (document.querySelector(".fo-pop-board")) return;
    var fresh = foPopsRecent().filter(function (l) { return l.r >= 0; });
    if (!fresh.length) return;
    var chips = fresh.slice(0, 12).map(function (l, i) {
      return "<span class='fo-pop-chip' style='animation-delay:" + (i * 90) + "ms'><i>&#9650;</i><b>" + E(l.n) + "</b> +1 " + E(lbl(l.k)) + "</span>";
    }).join("");
    var more = fresh.length > 12 ? "<span class='fo-pop-more'>+" + (fresh.length - 12) + " more on the report</span>" : "";
    var board = document.createElement("div");
    board.className = "fo-pop-board";
    board.innerHTML = "<div class='fo-pop-hd'><b>The board went up</b><span>" + fresh.length +
      (fresh.length === 1 ? " gain" : " gains") + " this week</span></div><div class='fo-pop-row'>" + chips + more + "</div>";
    pane.parentNode.insertBefore(board, pane);
  }
  if (typeof window.foRenderNetsPage === "function" && !window.foRenderNetsPage.__foPops) {
    var _nets = window.foRenderNetsPage;
    window.foRenderNetsPage = function () {
      var out = _nets.apply(this, arguments);
      try { foPopsCss(); foPopsNetsStrip(); } catch (e) {}
      return out;
    };
    window.foRenderNetsPage.__foPops = 1;
  }

  // ---------------------------------------------------------------------------
  // The squad roster: ▲ chips on fresh names
  // ---------------------------------------------------------------------------
  function foPopsDecorateSquad() {
    var counts = foPopsCounts();
    if (!Object.keys(counts).length) return;
    document.querySelectorAll(".fo-ros-row").forEach(function (row) {
      var href = row.getAttribute("href") || "", m = href.match(/[?&]n=([^&]+)/);
      if (!m) return;
      var name; try { name = decodeURIComponent(m[1]); } catch (e) { return; }
      var c = counts[name]; if (!c) return;
      var b = row.querySelector(".fo-ros-id b");
      if (!b || b.querySelector(".fo-pop-up")) return;
      var tip = c.ks.map(lbl).join(", ");
      b.insertAdjacentHTML("beforeend",
        " <i class='fo-pop-up' title='Trained up this week: " + E(tip) + "'>&#9650;" + (c.n > 1 ? c.n : "") + "</i>");
    });
  }
  if (typeof window.pgSquad === "function" && !window.pgSquad.__foPops) {
    var _sq = window.pgSquad;
    window.pgSquad = function () {
      var out = _sq.apply(this, arguments);
      try { foPopsCss(); foPopsDecorateSquad(); } catch (e) {}
      return out;
    };
    window.pgSquad.__foPops = 1;
  }

  // ---------------------------------------------------------------------------
  // The player page: the Development panel
  // ---------------------------------------------------------------------------
  function foPopsPlayerPanel(q) {
    var name = q && q.n; if (!name) return;
    var hist = foPopsFor(name); if (!hist.length) return;
    var page = document.getElementById("page"); if (!page) return;
    if (page.querySelector(".fo-pop-dev")) return;
    var s = App.seasonNo || 1, cut = (App.season.round || 0) - 2;
    var rows = hist.slice(0, 14).map(function (l, i) {
      var fresh = l.r >= 0 && l.s === s && l.r >= cut;
      var what = l.r >= 0 ? "+1 " + E(lbl(l.k)) : E(l.why);
      var when = l.r >= 0 ? E(l.why) + " &middot; R" + (l.r + 1) + ", season " + l.s : "season " + l.s;
      return "<div class='fo-pop-devln" + (fresh ? " fresh' style='animation-delay:" + (i * 70) + "ms" : "") + "'>" +
        "<i>&#9650;</i><b>" + what + "</b><span>" + when + "</span></div>";
    }).join("");
    var panel = document.createElement("div");
    panel.className = "panel fo-pop-dev";
    panel.innerHTML = "<h4>Development</h4><div class='pad'>" + rows + "</div>";
    var anchor = page.querySelector(".fo-skills-panel");
    if (anchor && anchor.nextSibling) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else page.appendChild(panel);
  }
  if (typeof window.pgPlayer === "function" && !window.pgPlayer.__foPops) {
    var _pl = window.pgPlayer;
    window.pgPlayer = function (q) {
      var out = _pl.apply(this, arguments);
      try { foPopsCss(); foPopsPlayerPanel(q); } catch (e) {}
      return out;
    };
    window.pgPlayer.__foPops = 1;
  }

  // ---------------------------------------------------------------------------
  function foPopsCss() {
    if (document.getElementById("fo-pop-css")) return;
    var st = document.createElement("style"); st.id = "fo-pop-css";
    st.textContent = [
      "@keyframes foPopIn{0%{opacity:0;transform:scale(.55) translateY(6px)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}",
      // the nets noticeboard
      ".fo-pop-board{background:rgba(240,250,240,.93);border:1px solid rgba(31,158,114,.35);border-radius:16px;padding:14px 17px;margin:0 0 16px;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 14px 34px rgba(20,60,35,.16)}",
      ".fo-pop-hd{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 10px}",
      ".fo-pop-hd b{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#157A57}",
      ".fo-pop-hd span{font-size:10px;color:#4B8A6E;letter-spacing:.1em;text-transform:uppercase}",
      ".fo-pop-row{display:flex;flex-wrap:wrap;gap:7px;align-items:center}",
      ".fo-pop-chip{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid rgba(31,158,114,.45);border-radius:999px;padding:5px 11px 5px 8px;font-size:12px;color:#1F5C43;box-shadow:0 3px 10px rgba(20,60,35,.12);animation:foPopIn .38s cubic-bezier(.34,1.56,.64,1) both}",
      ".fo-pop-chip i{font-style:normal;font-size:10px;color:#1F9E72}",
      ".fo-pop-chip b{font-weight:600;color:#173D2D}",
      ".fo-pop-more{font-size:11px;color:#4B8A6E;font-family:Georgia,serif;font-style:italic}",
      // the roster chip
      ".fo-pop-up{display:inline-block;font-style:normal;font-size:10px;font-weight:700;color:#1F9E72;background:rgba(31,158,114,.12);border:1px solid rgba(31,158,114,.35);border-radius:6px;padding:0 4px;margin-left:4px;vertical-align:1px;line-height:1.5;animation:foPopIn .38s cubic-bezier(.34,1.56,.64,1) both}",
      // the player-page development panel: the dossier below the hero is a
      // dark surface, so the ink here is chalk on a blackboard
      ".fo-pop-devln{display:flex;align-items:baseline;gap:7px;margin:0 0 6px;font-size:12.5px;color:rgba(232,228,216,.75)}",
      ".fo-pop-devln i{font-style:normal;font-size:10px;color:rgba(232,228,216,.35)}",
      ".fo-pop-devln b{font-weight:600;color:rgba(240,237,228,.92)}",
      ".fo-pop-devln span{color:rgba(232,228,216,.5);font-size:11px;margin-left:auto;text-align:right}",
      ".fo-pop-devln.fresh{animation:foPopIn .38s cubic-bezier(.34,1.56,.64,1) both}",
      ".fo-pop-devln.fresh i,.fo-pop-devln.fresh b{color:#3ED6A0}",
      "@media(prefers-reduced-motion:reduce){.fo-pop-chip,.fo-pop-up,.fo-pop-devln.fresh{animation:none}}"
    ].join("\n");
    document.head.appendChild(st);
  }
  window.__foPops.ready = 1;
})();

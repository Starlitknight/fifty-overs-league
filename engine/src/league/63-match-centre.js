/* ============================================================================
   MATCH CENTRE (#/matchday) — the captain's sheet, and then the match.

   Before the ball is bowled this is a sheet you fill in: the eleven, the
   order they bat, the bowling plan, captain and keeper, the fielding posture,
   the toss call. Everything the manager owes the umpire, on one page, in the
   order a captain would think about it - and submitted without leaving.

   Once it is under way the same page becomes the broadcast: a compact score
   that stays put while the tabs change beneath it - commentary, scorecard,
   worm, details. Commentary is monospace over-and-ball, ink body copy, and a
   burnt-orange rule down the left of anything that mattered. No audio.

   The ground is a plate at the top: full brightness, natural ratio, no text
   over it. The conditions are stated underneath in words, where words belong.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foMC) return; window.__foMC = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function on() { return (location.hash || "").split("?")[0] === "#/matchday"; }
  function A() { return window.AL || null; }
  function ord() { try { return App.orders || {}; } catch (e) { return {}; } }
  function me() { try { return userTeam() || null; } catch (e) { return null; } }
  function live() { try { return (typeof M !== "undefined" && M && !M.done) ? M : null; } catch (e) { return null; } }
  function fixture() { try { return (typeof window.foNextFixture === "function") ? window.foNextFixture() : null; } catch (e) { return null; } }
  function save() { try { if (typeof saveGame === "function") saveGame(false); } catch (e) {} }

  function groundArt() {
    try {
      var vf = window.foHgVariant; if (!vf) return null;
      var v = vf(); if (!v) return null;
      var base = (typeof FO_ART !== "undefined") ? FO_ART
        : (location.pathname.indexOf("/client/") !== -1 ? "art/" : "client/art/");
      var cap = ""; try { cap = (window.FO_HG_WX && window.FO_HG_WX[v]) || ""; } catch (e2) {}
      return { src: base + "home/" + v + ".webp", mood: cap || "The ground" };
    } catch (e) { return null; }
  }

  function planState() {
    var o = ord(), xi = (o.batOrder || []).filter(Boolean);
    var overs = 0;
    try { ["north", "south"].forEach(function (end) { (o.spells[end] || []).forEach(function (sp) { if (sp && sp.bowler) overs++; }); }); } catch (e) {}
    var missing = [];
    if (xi.length < 11) missing.push("the XI is " + xi.length + " of 11");
    if (!o.captain) missing.push("no captain");
    if (!o.keeper) missing.push("no wicketkeeper");
    return { xi: xi, overs: overs, missing: missing, saved: !!o.saved, o: o };
  }

  // ---- the sheet, before the match ---------------------------------------
  function sheet(al) {
    var p = planState(), fx = fixture(), t = me(), art = groundArt();
    var opp = (fx && fx.opp && fx.opp.name) || "";
    var body = al.mast("Round " + (((App.season && App.season.round) | 0) + 1) + " · the captain's sheet",
      opp ? (t && t.name ? t.name + " v " + opp : "Match centre") : "Match centre",
      "Everything the umpire needs from you, before nine o'clock.");

    var ready = !p.missing.length;
    body += al.decide({
      kind: p.saved && ready ? "done" : "act",
      title: p.saved && ready ? "Match plan filed" : (ready ? "Plan complete · not yet filed" : "Match plan incomplete"),
      note: p.missing.length ? p.missing.join(" · ") : p.overs + " of 20 spells assigned · orders close 9:00 AM New York",
    });

    if (art) body += al.plate(art.src, art.mood);

    // 1. conditions, in words, under the plate
    var cond = [
      ["Opponent", opp || "—"],
      [fx && fx.home ? "Ground (home)" : "Ground (away)", (fx && (fx.ground || "")) || (t && t.ground) || "—"],
      ["Round", String((((App.season && App.season.round) | 0) + 1))],
      ["Resolves", "9:00 AM ET"],
    ];
    if (fx && fx.pitch) cond.push(["Pitch", String(fx.pitch)]);
    if (fx && fx.weather) cond.push(["Weather", String(fx.weather)]);
    cond.push(["Toss", p.o.tossCall ? (p.o.tossCall === "H" ? "Heads" : "Tails") + ", " + (p.o.tossDecision || "bat") + " if won" : "the captain will call"]);
    body += al.sec("The match", al.ledger(cond));

    // 2. the eleven, in the order they bat
    var xiHtml = p.xi.length
      ? '<div class="al-players">' + p.xi.map(function (n, i) {
          var pl = null; try { pl = ((t && t.players) || []).filter(function (q) { return q && q.name === n; })[0]; } catch (e) {}
          var tags = [];
          if (n === p.o.captain) tags.push("C");
          if (n === p.o.keeper) tags.push("WK");
          return '<div class="al-prow al-prow--picked"><span class="al-prow__no">' + ("0" + (i + 1)).slice(-2) + "</span>" +
            '<span class="al-prow__who"><b>' + E(n) + (tags.length ? " <em class='al-you__tag'>" + tags.join(" · ") + "</em>" : "") + "</b>" +
            "<i>" + E((pl && (pl.roleFull || pl.role)) || "Player") + "</i></span>" +
            '<span class="al-prow__rate">' + ((pl && pl.rating | 0) || "&mdash;") + "</span></div>";
        }).join("") + "</div>"
      : al.empty("No eleven chosen", "Pick the side first; the rest of the sheet follows from it.");
    body += al.sec("1 · The eleven", xiHtml, { href: "#/team", label: "Change the side" });

    // 3. batting intent by phase
    var ph = (p.o.phaseIntent || {});
    var word = function (v) { return { "-1": "Defensive", "0": "Normal", "1": "Aggressive", "2": "Launch" }[String(v | 0)] || "Normal"; };
    body += al.sec("2 · Batting intent", al.ledger([
      ["Powerplay · overs 1–10", word(ph.pp)],
      ["Middle · overs 11–40", word(ph.mid)],
      ["Death · overs 41–50", word(ph.death)],
    ]));

    // 4. the bowling plan
    body += al.sec("3 · The bowling plan", al.ledger([
      ["Spells assigned", p.overs + " of 20"],
      ["Cover", p.overs >= 20 ? "complete" : "the captain covers the rest", p.overs >= 20 ? "pos" : "warn"],
    ]) + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
      '<button class="al-btn" data-al-mc="suggest">Suggest a plan</button>' +
      '<button class="al-btn" data-al-mc="previous">Load last plan</button></div>');

    // 5. captain, keeper, posture
    body += al.sec("4 · The armband", al.ledger([
      ["Captain", p.o.captain || "not named"],
      ["Wicketkeeper", p.o.keeper || "not named"],
      ["Field", String(p.o.field || "balanced")],
    ]), { href: "#/team", label: "Name them" });

    var acting = !(p.saved && ready);
    return {
      body: body, acting: acting,
      sticky: acting ? al.sticky(
        ready ? "The plan is complete but not filed" : p.missing.join(" · "),
        ready ? "Submit match plan" : "Finish in Team", ready ? "file" : "toTeam") : "",
    };
  }

  // ---- the broadcast, during the match ------------------------------------
  var TAB = "commentary";
  function broadcast(al, m) {
    var t = me(), art = groundArt();
    var inn = (m.innings || []).filter(Boolean), cur = inn[inn.length - 1] || null;
    var score = cur ? (cur.runs | 0) + "-" + (cur.wkts | 0) : "—";
    var ovs = cur ? Math.floor((cur.legal | 0) / 6) + "." + ((cur.legal | 0) % 6) : "0.0";
    var body = al.mast("Live · round " + (((App.season && App.season.round) | 0) + 1),
      (m.meta && m.meta.home ? m.meta.home + " v " + m.meta.away : "Match centre"), "");

    // the compact score header stays put while the tabs change beneath it
    body += '<div class="al-decide al-decide--act"><div class="al-decide__txt">' +
      "<b>" + E(score) + "  <span class='al-read'>(" + E(ovs) + " ov)</span></b>" +
      "<i>" + E((cur && cur.batTeam) || "") + " batting</i></div></div>";
    if (art) body += al.plate(art.src, art.mood);

    var tabs = ["commentary", "scorecard", "worm", "details"];
    body += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px">' +
      tabs.map(function (k) {
        return '<button class="al-btn" data-al-tab="' + k + '"' +
          (k === TAB ? ' style="border-color:var(--al-accent);color:var(--al-accent)"' : "") + ">" +
          E(k.charAt(0).toUpperCase() + k.slice(1)) + "</button>";
      }).join("") + "</div>";

    if (TAB === "commentary") {
      var log = (m.log || []).slice(-40).reverse();
      body += log.length
        ? '<div class="al-ledger">' + log.map(function (l) {
            var txt = typeof l === "string" ? l : (l && (l.text || l.t)) || "";
            var big = /OUT|SIX|FOUR|WICKET|maiden|caught|bowled|lbw|stumped/i.test(txt);
            return '<div style="' + (big ? "box-shadow:inset 3px 0 0 var(--al-accent);padding-left:12px" : "") + '">' +
              '<span class="k" style="font-family:var(--al-mono);flex:0 0 52px">' +
              E((typeof l === "object" && l && l.ov != null) ? l.ov : "") + "</span>" +
              '<span class="k" style="font-weight:400;color:var(--al-ink)">' + E(txt) + "</span></div>";
          }).join("") + "</div>"
        : al.empty("No commentary yet", "The over-by-over appears here as the match is played.");
    } else if (TAB === "scorecard") {
      body += al.ledger((cur && cur.bat ? cur.bat : []).filter(function (b) { return b && (b.b > 0 || b.out); })
        .map(function (b) { return [(b.p && b.p.name) || "—", (b.r | 0) + " (" + (b.b | 0) + ")"]; }));
    } else if (TAB === "worm") {
      body += al.sec("Run worm", al.empty("Worm", "The run worm is drawn from the over-by-over once the innings is under way."));
    } else {
      body += al.ledger([
        ["Ground", (m.meta && m.meta.ground) || "—"],
        ["Pitch", String(m.pitch || "—")],
        ["Weather", (m.meta && m.meta.weather) || "—"],
        ["Toss", String(m.toss || "—")],
      ]);
    }
    return { body: body, acting: false, sticky: "" };
  }

  window.foRenderMatchCentre = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}
    var m = live();
    var parts = m ? broadcast(al, m) : sheet(al);
    page.innerHTML = al.page(parts);
    wire();
  };

  function wire() {
    var host = document.getElementById("page");
    if (host && !host.__mcW) {
      host.__mcW = 1;
      host.addEventListener("click", function (ev) {
        var t = ev.target.closest ? ev.target.closest("[data-al-tab]") : null;
        if (t) { TAB = t.getAttribute("data-al-tab"); window.foRenderMatchCentre(); return; }
        var a = ev.target.closest ? ev.target.closest("[data-al-mc]") : null;
        if (a) act(a.getAttribute("data-al-mc"));
      });
    }
    if (!document.__mcSticky) {
      document.__mcSticky = 1;
      document.addEventListener("click", function (ev) {
        var a = ev.target.closest ? ev.target.closest(".al-sticky [data-al-act]") : null;
        if (a && on()) act(a.getAttribute("data-al-act"));
      });
    }
  }
  function act(what) {
    if (what === "toTeam") { location.hash = "#/team"; if (typeof window.route === "function") window.route(); return; }
    if (what === "suggest") { try { if (typeof suggestOrders === "function") suggestOrders(); } catch (e) {} ord().saved = false; save(); window.foRenderMatchCentre(); return; }
    if (what === "previous") { try { if (App.defaults) App.orders = JSON.parse(JSON.stringify(App.defaults)); } catch (e) {} save(); window.foRenderMatchCentre(); return; }
    if (what === "file") {
      // the same commit the old orders page made: mark filed, remember as the
      // default for next round, persist. Nothing new, nowhere else.
      try { App.orders.saved = true; App.defaults = JSON.parse(JSON.stringify(App.orders)); } catch (e) {}
      save(); window.foRenderMatchCentre(); return;
    }
  }

  // NOTHING TO SWEEP HERE. The sticky bar lives inside #page, which every
  // route replaces wholesale; a hashchange handler that removed it also ran
  // AFTER a sibling screen had painted its own, and deleted that one.
})();

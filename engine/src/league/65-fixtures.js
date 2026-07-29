/* ============================================================================
   FIXTURES (#/fixtures) — the season as a ledger.

   The old card was two lists side by side: everything played, then everything
   still to come. That reads as two separate documents and hides the one thing
   a manager opens this page for - which match is next, and what are its
   conditions. A season is one continuous record, so this is one column, in
   round order, from the first match of the summer to the last.

   ONLY THE NEXT FIXTURE IS EXPANDED. Every other round is one line: round,
   home or away, the opponent, the outcome. The next one opens in place, with
   the ground, the square, the sky, the hour it resolves and the way into the
   Match Centre. Nothing else on the page competes with it.

   TWO SOURCES, ONE CARD. Where the club is held in the served world the card
   is built from the umpire's own record - its results and its schedule - so a
   manager is never shown a fixture that will not be played. A device that has
   never claimed a club falls back to the local season it holds. The shape
   below is the same either way; only where the rows come from differs.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foAlFix) return; window.__foAlFix = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function on() { return (location.hash || "").split("?")[0] === "#/fixtures"; }
  function A() { return window.AL || null; }
  var PITCH = { balanced: "true", flat: "flat", green: "green", dry: "dry", slow: "slow", cracked: "cracked", twoPaced: "two-paced" };

  function worldClaim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); }
    catch (e) { return null; }
  }
  function repaint() { try { if (on()) window.foRenderFixturesPage(); } catch (e) {} }

  // older saves recorded results before seasonNo existed on the record; a
  // stampless result belongs to this season exactly when the season's own
  // played-map points at its index
  function thisSeasonHas(r, ix) {
    var cur = (App.seasonNo || 1);
    if (r.seasonNo != null) return r.seasonNo === cur;
    try {
      var P = (App.season && App.season.played) || {};
      for (var k in P) if (P[k] === (r.ix != null ? r.ix : ix)) return true;
    } catch (e) {}
    return false;
  }

  // ---- the served card: the umpire's own record ---------------------------
  function servedCard(claim) {
    var snap = null, names = null, mgr = null;
    try {
      if (window.__foWorldLg) { window.__foWorldLg.want(claim.country, repaint); snap = window.__foWorldLg.get(claim.country); }
      if (window.__foWorldNames) { window.__foWorldNames.want(claim.country, repaint); names = window.__foWorldNames.get(claim.country); mgr = window.__foWorldNames.mgr(claim.country); }
    } catch (e) {}
    if (!snap || !snap.table || !snap.table.length) return null;

    var bySlot = {}, slotOf = {};
    snap.table.forEach(function (r) {
      var nm = (names && names[r.slot]) || r.name;
      bySlot[r.slot] = nm; slotOf[nm] = r.slot;
    });
    var my = bySlot[claim.slot] || claim.club;
    var groundOf = function (slot) { return (mgr && mgr["g" + slot]) || ((bySlot[slot] || "the ground") + "'s ground"); };

    var rows = {};
    (snap.results || []).forEach(function (r) {
      if (r.home !== my && r.away !== my) return;
      var isHome = r.home === my, opp = isHome ? r.away : r.home;
      var won = r.winner === my, tie = r.winner === null;
      var sc = isHome ? r.hs : r.as, oc = isHome ? r.as : r.hs;
      rows[(r.round | 0) - 1] = {
        kind: "done", round: r.round | 0, isHome: isHome, opp: opp,
        ground: groundOf(isHome ? claim.slot : slotOf[opp]),
        mark: tie ? "T" : won ? "W" : "L",
        line: sc && oc ? (sc.r + "/" + sc.w + " v " + oc.r + "/" + oc.w) : (r.text || ""),
        text: (r.text || "").replace(/\s*\(.*\)$/, ""),
        href: "#/league?t=results&r=" + (r.round | 0),
      };
    });

    var rounds = snap.rounds || 18;
    try {
      var wt = window.__foWT, pl = window.__foPlanet;
      if (wt && wt.schedMirror) {
        var sched = wt.schedMirror(claim.country, snap.seasonNo || 1) || [];
        var hour = pl ? pl.natHour(claim.country) : null;
        for (var i = 0; i < sched.length; i++) {
          if (rows[i]) continue;
          /* jshint loopfunc:true */
          (function (ri) {
            (sched[ri] || []).forEach(function (f) {
              if (f[0] !== claim.slot && f[1] !== claim.slot) return;
              var isHome = f[0] === claim.slot;
              rows[ri] = {
                kind: "todo", round: ri + 1, isHome: isHome,
                opp: bySlot[isHome ? f[1] : f[0]] || "a club",
                ground: groundOf(f[0]),
                when: hour != null ? ((hour < 10 ? "0" : "") + hour + ":00 UTC") : "",
                href: "#/matchday",
              };
            });
          })(i);
        }
        if (sched.length > rounds) rounds = sched.length;
      }
    } catch (eU) {}
    return { season: snap.seasonNo || 1, club: my, rounds: rounds, rows: rows, served: true };
  }

  // ---- the local card: the season this device holds ------------------------
  function localCard() {
    try { if (typeof seasonInit === "function") seasonInit(); } catch (e) {}
    var me = null; try { me = userTeam(); } catch (e2) {}
    if (!me) return null;
    var my = me.name, S = App.season, rows = {};

    (App.results || []).forEach(function (r, i) {
      if (!r || r.comp !== "league" || !r.result) return;
      if (r.home !== my && r.away !== my) return;
      if (!thisSeasonHas(r, i)) return;
      var isHome = r.home === my, opp = isHome ? r.away : r.home;
      var live = /LIVE/.test(r.result.text || "") || r.result.winner === undefined;
      var won = r.result.winner === my, tie = r.result.winner === null;
      rows[r.round | 0] = {
        kind: "done", round: (r.round | 0) + 1, isHome: isHome, opp: opp,
        ground: r.ground || "", live: live,
        mark: live ? "&#9679;" : tie ? "T" : won ? "W" : "L",
        text: (r.result.text || "").replace(/\s*\(.*\)$/, ""),
        href: "#/report?i=" + (r.ix != null ? r.ix : i),
      };
    });

    if (S && S.schedule) {
      for (var k = 0; k < S.schedule.length; k++) {
        if (rows[k]) continue;
        /* jshint loopfunc:true */
        (function (ri) {
          (S.schedule[ri] || []).forEach(function (f) {
            if (f[0] !== App.teamIx && f[1] !== App.teamIx) return;
            try { if (S.played && S.played[fixtureKey(ri, f)] !== undefined) return; } catch (eK) {}
            var isHome = f[0] === App.teamIx, home = GD.teams[f[0]], away = GD.teams[f[1]];
            var when = "";
            try { if (typeof window.foRoundTimeTxt === "function") when = window.foRoundTimeTxt(ri) || ""; } catch (eW) {}
            rows[ri] = {
              kind: "todo", round: ri + 1, isHome: isHome, opp: (isHome ? away : home).name,
              ground: home.ground,
              pitch: (typeof groundPitch === "function") ? groundPitch(home.ground) : "",
              wx: (typeof WXLIST !== "undefined") ? WXLIST[(ri * 7 + f[0] * 3) % WXLIST.length] : "",
              when: when, href: "#/matchday?r=" + ri,
            };
          });
        })(k);
      }
    }
    return {
      season: App.seasonNo || 1, club: my, rows: rows,
      rounds: (S && S.schedule) ? S.schedule.length : 18, served: false,
    };
  }

  // ---- rows ----------------------------------------------------------------
  function line(f, next) {
    var cls = "al-fix" + (next ? " al-fix--next" : "");
    var mark = f.kind === "done" ? f.mark : (f.isHome ? "H" : "A");
    var kind = f.kind === "done" ? (f.live ? "lv" : f.mark === "W" ? "w" : f.mark === "L" ? "l" : "t") : "n";
    var under = f.kind === "done"
      ? (f.text || f.line || "")
      : [f.ground, f.when].filter(Boolean).join(" · ");
    return "<a class='" + cls + "' href='" + E(f.href) + "'>" +
      "<span class='al-fix__r'>R" + (f.round | 0) + "</span>" +
      "<span class='al-fix__w " + kind + "'>" + mark + "</span>" +
      "<span class='al-fix__t'><b>" + (A() ? A().crest(f.opp) : "") + (f.isHome ? "v " : "at ") +
        E(f.opp) + "</b><i>" + E(under) + "</i></span>" +
      "<span class='al-fix__o'>" + (f.kind === "done" ? "&rsaquo;" : next ? "NEXT" : "&rsaquo;") + "</span>" +
      "</a>";
  }

  /** The next fixture, opened in place: conditions, hour, and the way in. */
  function opened(al, f) {
    var rows = [["Opponent", f.opp], [f.isHome ? "Ground (home)" : "Ground (away)", f.ground || "—"]];
    if (f.pitch) rows.push(["Pitch", (PITCH[f.pitch] || f.pitch) + " square"]);
    if (f.wx) rows.push(["Forecast", String(f.wx)]);
    rows.push(["Resolves", f.when || "9:00 AM ET"]);
    try { rows.push(["Countdown", al.clock().top]); } catch (e) {}
    return "<div class='al-fix__open'>" + al.ledger(rows) +
      "<div class='al-fix__go'><a class='al-btn al-btn--primary' href='#/matchday'>Match centre</a>" +
      "<a class='al-btn' href='#/team'>The eleven</a></div></div>";
  }

  window.foRenderFixturesPage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var cl = worldClaim(), card = null;
    if (cl && cl.country && cl.slot != null) card = servedCard(cl);
    if (!card) card = localCard();

    var body = al.head("The League · season " + ((card && card.season) || 1), "Fixtures",
      "Every match of the summer in one column. The next one is open; the rest are a line each.");
    body += al.subnav("fixtures");

    if (!card) {
      page.innerHTML = al.page({ body: body + al.empty("The card is not out",
        "Your fixture list appears the moment the season is drawn.") });
      return;
    }

    // in round order, with the first unplayed match marked as next
    var keys = Object.keys(card.rows).map(Number).sort(function (a, b) { return a - b; });
    var nextKey = -1;
    for (var i = 0; i < keys.length; i++) if (card.rows[keys[i]].kind === "todo") { nextKey = keys[i]; break; }

    var w = 0, l = 0, t = 0, played = 0;
    keys.forEach(function (k) {
      var f = card.rows[k];
      if (f.kind !== "done" || f.live) return;
      played++; if (f.mark === "W") w++; else if (f.mark === "L") l++; else t++;
    });

    if (nextKey >= 0) {
      var nf = card.rows[nextKey];
      body += al.decide({
        kind: "act",
        title: "Round " + (nf.round | 0) + " · " + (nf.isHome ? "v " : "at ") + nf.opp,
        note: (nf.ground ? nf.ground + " · " : "") + "resolves " + (nf.when || "9:00 AM ET"),
        action: { href: "#/matchday", label: "Match centre" }, primary: true,
      });
    } else {
      body += al.decide({ kind: "done", title: "The season is played out",
        note: "Every fixture on the card has been resolved.", action: { href: "#/table", label: "The table" } });
    }

    var list = keys.map(function (k) {
      var f = card.rows[k];
      return line(f, k === nextKey) + (k === nextKey ? opened(al, f) : "");
    }).join("");

    body += al.sec("The season · " + w + "W " + l + "L" + (t ? " " + t + "T" : "") +
      " · " + played + " of " + (card.rounds | 0) + " played",
      list ? "<div class='al-fixlist'>" + list + "</div>"
           : al.empty("No fixtures yet", "The card is drawn when the season starts."),
      { href: "#/table", label: "The table" });

    body += "<p class='al-read'>" + (card.served
      ? "&#9679; served &middot; the umpire's own card for " + E(card.club)
      : "&#9679; local &middot; this device's copy of the season") + "</p>";

    page.innerHTML = al.page({ body: body });
  };
})();

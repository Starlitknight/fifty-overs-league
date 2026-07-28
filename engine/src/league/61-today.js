/* ============================================================================
   TODAY (#/today) — the morning edition.

   The first screen of the day. It answers, in this order and within the first
   phone viewport: which club is this, what is the next match, and what does
   the manager have to do before nine o'clock.

   Three states, because a daily game has three: BEFORE the round resolves
   (readiness and deadline), DURING (score and match state), AFTER (what
   happened and its consequences). The state is read from the game, never
   guessed - a round with a played result behind it and a fixture ahead of it
   is "after" until the next deadline approaches.

   Not a dashboard. No metric tiles. The artwork is a plate above the fold at
   full brightness with nothing laid over it, and the required action sits in
   the first screenful, not below a hero.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foToday) return; window.__foToday = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function on() { return (location.hash || "").split("?")[0] === "#/today"; }
  function A() { return window.AL || null; }

  function art() {
    // The club-home paintings the game already ships. foHgVariant() picks the
    // one that suits the hour, the weather and the screen and returns its KEY;
    // the file and its caption are looked up here. Shown at natural ratio,
    // full brightness, nothing over it - it is a plate, not a background.
    try {
      var vf = window.foHgVariant || (typeof foHgVariant === "function" ? foHgVariant : null);
      if (!vf) return null;
      var v = vf(); if (!v) return null;
      var base = (typeof FO_ART !== "undefined") ? FO_ART
        : (location.pathname.indexOf("/client/") !== -1 ? "art/" : "client/art/");
      var cap = "";
      try { cap = (window.FO_HG_WX && window.FO_HG_WX[v]) || ""; } catch (eC) {}
      if (!cap) { try { cap = String(window.__foHgWx || ""); } catch (eC2) {} }
      return { src: base + "home/" + v + ".webp", mood: cap || "The home ground" };
    } catch (e) { return null; }
  }
  function nextFixture() {
    try { return (typeof window.foNextFixture === "function") ? window.foNextFixture() : null; } catch (e) { return null; }
  }
  function myTeam() { try { return userTeam() || null; } catch (e) { return null; } }
  function lastResult() {
    try {
      var r = App.results || [];
      for (var i = r.length - 1; i >= 0; i--) {
        var x = r[i];
        if (!x || x.comp === "friendly") continue;
        var me = (myTeam() || {}).name;
        if (x.home === me || x.away === me) return { r: x, ix: i };
      }
    } catch (e) {}
    return null;
  }
  function tablePos() {
    try {
      var rows = (typeof leagueRows === "function") ? leagueRows() : [];
      var me = (myTeam() || {}).name;
      var i = rows.findIndex(function (x) { return x.nm === me; });
      return i >= 0 ? { pos: i + 1, row: rows[i], of: rows.length } : null;
    } catch (e) { return null; }
  }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function xiState() {
    // how many of the eleven are chosen, and whether the plan is saved
    try {
      var o = App.orders || {}, bo = (o.batOrder || []).filter(Boolean);
      return { picked: Math.min(11, bo.length), saved: !!o.saved, captain: o.captain || "", keeper: o.keeper || "" };
    } catch (e) { return { picked: 0, saved: false, captain: "", keeper: "" }; }
  }
  function liveMatch() {
    try { return (typeof M !== "undefined" && M && !M.done) ? M : null; } catch (e) { return null; }
  }

  function stateNow() {
    if (liveMatch()) return "live";
    var xi = xiState();
    if (!xi.saved || xi.picked < 11) return "before";
    return "after";
  }

  window.foRenderTodayPage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var t = myTeam(), club = (t && t.name) || "Your club", ground = (t && t.ground) || "";
    var clock = al.clock(), st = stateNow();
    var fx = nextFixture(), pos = tablePos(), xi = xiState(), last = lastResult();
    var v = art();
    var when = (function () {
      try {
        return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      } catch (e) { return ""; }
    })();

    // ---- masthead: the date and the round, not a wall of copy ---------------
    var body = al.mast(when + " · " + clock.sub.toLowerCase(), club, ground ? "Home ground: " + ground : "");

    // ---- the decision, stated ---------------------------------------------
    // THE BRIEF'S TWO ARTWORK RULES PULL AGAINST EACH OTHER ON A PHONE. It
    // asks for the plate second AND for the required action inside the first
    // viewport - but the phone paintings are portrait, and at 390px wide an
    // uncropped one is over 500px tall, which puts the action below the fold.
    // Cropping it to fit is forbidden and would be the wrong trade anyway. So
    // the hard rule wins ("do not push the main task below a large hero") and
    // the plate follows the decision: identity, then what you must do, then
    // the painting - still full width, full brightness, uncropped.
    var opp = fx && fx.opp ? (fx.opp.name || "") : "";
    if (st === "before") {
      var need = 11 - xi.picked;
      body += al.decide({
        kind: "act",
        title: need > 0 ? "Playing XI incomplete · " + xi.picked + " of 11 selected"
                        : "Match plan not yet submitted",
        note: "Orders close at 9:00 AM New York · " + clock.top + " left",
        action: { href: "#/team", label: need > 0 ? "Pick the XI" : "Review plan" },
        primary: true,
      });
    } else if (st === "live") {
      body += al.decide({ kind: "act", title: "Your match is under way",
        note: opp ? "against " + opp : "", action: { href: "#/matchday", label: "Match centre" }, primary: true });
    } else {
      body += al.decide({ kind: "done", title: "Nothing needs your decision",
        note: "The plan is filed. The round resolves at 9:00 AM New York.",
        action: { href: "#/matchday", label: "Match centre" } });
    }

    // ---- the plate, directly under the decision it must not displace -------
    if (v && v.src) body += al.plate(v.src, v.mood || "The home ground");

    // ---- the next match ----------------------------------------------------
    if (fx) {
      var rows = [
        ["Opponent", opp || "—"],
        [fx.home ? "Ground (home)" : "Ground (away)", (fx.ground || (fx.home ? ground : "away")) || "—"],
        ["Resolves", "9:00 AM ET"],
        ["Countdown", clock.top],
      ];
      if (fx.pitch) rows.push(["Pitch", String(fx.pitch)]);
      if (fx.weather) rows.push(["Weather", String(fx.weather)]);
      body += al.sec("The next match", al.ledger(rows), { href: "#/matchday", label: "Match centre" });
    } else {
      body += al.sec("The next match", al.empty("No fixture scheduled",
        "When the next round is drawn it will appear here with its ground, conditions and deadline."));
    }

    // ---- where the club stands --------------------------------------------
    if (pos) {
      var r = pos.row;
      body += al.sec("Where you stand", al.ledger([
        ["Position", ordinal(pos.pos) + " of " + pos.of],
        ["Played", String(r.p | 0)],
        ["Points", String(r.pts | 0), r.pts > 0 ? "pos" : ""],
        ["Net run rate", (r.nrr >= 0 ? "+" : "") + Number(r.nrr || 0).toFixed(3)],
      ]), { href: "#/table", label: "The table" });
    }

    // ---- yesterday's consequences -----------------------------------------
    if (last && last.r && last.r.result) {
      var lr = last.r, txt = (lr.result && lr.result.text) || "";
      body += al.sec("What happened last round",
        '<p class="al-lede">' + E(txt) + "</p>" +
        '<p class="al-read">' + E(lr.home) + " v " + E(lr.away) + (lr.ground ? " · " + E(lr.ground) : "") + "</p>" +
        '<a class="al-btn" href="#/scorecard?i=' + last.ix + '">Full scorecard</a>');
    }

    body += '<p class="al-read" style="margin-top:32px">' + E("build " + ((window.FO_BUILD || "").slice(0, 20))) + "</p>";

    var acting = st === "before";
    page.innerHTML = al.page({
      body: body,
      acting: acting,
      sticky: acting ? al.sticky("Orders close 9:00 AM ET · " + clock.top + " left",
        xi.picked < 11 ? "Pick the XI" : "Review plan", "toTeam") : "",
    });

    var b = page.parentNode ? page.parentNode.querySelector('[data-al-act="toTeam"]') : null;
    if (!b) b = document.querySelector('[data-al-act="toTeam"]');
    if (b && !b.__w) {
      b.__w = 1;
      b.addEventListener("click", function () { location.hash = "#/team"; if (typeof window.route === "function") window.route(); });
    }
  };

  // the sticky bar is appended outside #page, so it must be cleaned up when
  // the manager leaves - otherwise it would hang over another screen
  window.addEventListener("hashchange", function () {
    if (on()) return;
    var s = document.querySelector(".al-sticky"); if (s && s.parentNode) s.parentNode.removeChild(s);
  });
})();

/* ============================================================================
   THE SCHEDULE (#/schedule) — what happens, and when, for a whole season.

   A manager who does not know the shape of the season cannot plan inside it.
   The calendar was knowable - it is in the clock, and the clock is on every
   device - but only ever shown a day at a time: the next fixture, the round
   after this one. Nowhere said "the boys have week four to themselves" or
   "the league stops for it", so nobody could see a Colts Cup coming or know
   that the turning of the year lands on day 38 and takes a year off every
   cricketer in the world.

   THIS PAGE IS A DERIVATION, NOT A TABLE. Every row is read out of
   __foPlanet.phaseOf - the same function the umpire settles by and the fixture
   list reads - so it cannot describe a season the world does not play. If the
   calendar changes, this page changes with it and nobody has to remember to
   come here. A hand-written copy of the schedule would be wrong the first time
   anybody moved a day, and wrong silently.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foSched) return; window.__foSched = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function planet() { try { return window.__foPlanet || null; } catch (e) { return null; } }
  var WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // WHAT EACH KIND OF DAY IS, IN WORDS. phaseOf returns a kind and a stage;
  // this is the only place that turns those into English, so the vocabulary
  // cannot drift between the fixture list and here.
  function tell(p) {
    var k = p.kind, st = p.stage;
    if (k === "league") return { t: "League &middot; round " + p.round, c: "lg",
      d: "Both divisions play. Your orders lock at the first ball." };
    if (k === "playoff") return { t: st === "semi" ? "League play-off semi-finals" : "THE LEAGUE FINALS", c: "po",
      d: st === "semi" ? "First plays fourth, second plays third, in both divisions."
                       : "Champions crowned in both divisions." };
    if (k === "facup") return { t: "National Cup &middot; " + ({ r16: "round of 16", qf: "quarter-finals", sf: "semi-finals", final: "THE FINAL" }[st] || st), c: "fa",
      d: st === "final" ? "One club left standing in the country." : "Knockout. Lose and your cup is over." };
    if (k === "colts") return { t: "Colts Cup &middot; " + ({ r16: "round of 16", qf: "quarter-finals", sf: "semi-finals", final: "THE FINAL" }[st] || st), c: "co",
      d: "The academies play and the league stands down." };
    if (k === "cup") return { t: "Champions Cup &middot; " + ({ g1: "group round 1", g2: "group round 2", g3: "group round 3", qf: "quarter-finals", sf: "semi-finals", final: "THE FINAL" }[st] || st), c: "ch",
      d: "The clubs' crown, across the whole world." };
    if (k === "transition") return { t: "THE TURNING OF THE YEAR", c: "tr",
      d: "Every cricketer ages a year, the oldest retire, boys come through, and clubs go up and down." };
    return { t: "Rest day", c: "re", d: "No cricket. Training, the nets and the market carry on." };
  }

  // the weeks a reader thinks in, named for what they are
  function weekName(w) {
    return ["The opening week", "The second week", "The third week",
            "COLTS WEEK", "Finals week", "Champions Cup week"][w] || ("Week " + (w + 1));
  }

  function css() {
    if (document.getElementById("fo-sch-css")) return;
    var s = document.createElement("style"); s.id = "fo-sch-css";
    s.textContent = [
      "html body #page .fo-sch{max-width:1000px;margin:22px auto 44px;padding:0 18px;color:#141C28}",
      "html body #page .fo-sch-hero{background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F);border-radius:20px;padding:24px 26px 22px;box-shadow:0 20px 46px rgba(11,29,51,.34)}",
      "html body #page .fo-sch-hero .k{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:#EBC271}",
      "html body #page .fo-sch-hero h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:7px 0 10px;color:#FFFEFC;line-height:1.03}",
      "html body #page .fo-sch-hero p{margin:0;font:400 13.5px/1.55 Inter,sans-serif;color:rgba(244,239,228,.76);max-width:64ch}",
      "html body #page .fo-sch-now{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}",
      "html body #page .fo-sch-now span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:11px;padding:8px 13px 7px;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,239,228,.62)}",
      "html body #page .fo-sch-now span b{display:block;margin-bottom:4px;font:700 16px/1 Inter,sans-serif;letter-spacing:0;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      // ---- the week blocks --------------------------------------------------
      "html body #page .fo-sch-wk{margin-top:24px}",
      "html body #page .fo-sch-wkh{display:flex;align-items:center;gap:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#0E2246;margin:0 2px 9px}",
      "html body #page .fo-sch-wkh:after{content:'';flex:1;border-top:1px solid rgba(20,28,40,.14)}",
      "html body #page .fo-sch-list{background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(30,38,52,.055)}",
      "html body #page .fo-sch-row{display:grid;grid-template-columns:58px 96px minmax(0,1fr) 74px;gap:14px;align-items:center;padding:11px 18px;border-top:1px solid rgba(20,28,40,.08)}",
      "html body #page .fo-sch-list>.fo-sch-row:first-child{border-top:0}",
      "html body #page .fo-sch-row .dy{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-sch-row .wd{font:600 12.5px/1 Inter,sans-serif;color:rgba(20,28,40,.72)}",
      "html body #page .fo-sch-row .ev b{display:block;font:600 13.5px/1.25 Inter,sans-serif;color:#141C28}",
      "html body #page .fo-sch-row .ev span{display:block;margin-top:2px;font:400 11.5px/1.4 Inter,sans-serif;color:rgba(20,28,40,.5)}",
      "html body #page .fo-sch-row .hr{font:600 11.5px/1 Inter,sans-serif;color:rgba(20,28,40,.55);text-align:right;font-variant-numeric:tabular-nums}",
      // a rest day is quiet; the days that matter carry their own colour
      "html body #page .fo-sch-row.re{background:rgba(20,28,40,.018)}",
      "html body #page .fo-sch-row.re .ev b{color:rgba(20,28,40,.5);font-weight:500}",
      "html body #page .fo-sch-row.tr,html body #page .fo-sch-row.po,html body #page .fo-sch-row.co{background:rgba(201,85,50,.05)}",
      "html body #page .fo-sch-row.tr .ev b{color:#B44A22}",
      "html body #page .fo-sch-row.po .ev b,html body #page .fo-sch-row.co .ev b{color:#B44A22}",
      "html body #page .fo-sch-row.ch .ev b{color:#8A6A1F}",
      "html body #page .fo-sch-row.fa .ev b{color:#2F5FC8}",
      // TODAY. The one row a reader is actually standing on.
      "html body #page .fo-sch-row.today{position:relative;background:linear-gradient(90deg,rgba(23,122,87,.10),rgba(23,122,87,.02))}",
      "html body #page .fo-sch-row.today:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#177A57}",
      "html body #page .fo-sch-row.today .dy{color:#177A57}",
      "html body #page .fo-sch-row.today .ev b:after{content:'TODAY';margin-left:9px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;color:#177A57;vertical-align:1px}",
      // ---- the rhythm note --------------------------------------------------
      "html body #page .fo-sch-note{margin-top:22px;background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-left:3px solid #C95532;border-radius:12px;padding:16px 18px}",
      "html body #page .fo-sch-note h3{margin:0 0 8px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#0E2246}",
      "html body #page .fo-sch-note ul{margin:0;padding-left:18px}",
      "html body #page .fo-sch-note li{font:400 12.5px/1.6 Inter,sans-serif;color:rgba(20,28,40,.72);margin-bottom:5px}",
      "html body #page .fo-sch-note li b{color:#141C28}",
      "@media(max-width:620px){",
      "html body #page .fo-sch{padding:0 12px}",
      "html body #page .fo-sch-hero{padding:19px 17px 17px;border-radius:16px}",
      "html body #page .fo-sch-hero h1{font-size:30px}",
      "html body #page .fo-sch-row{grid-template-columns:38px minmax(0,1fr) 58px;gap:9px;padding:10px 12px}",
      "html body #page .fo-sch-row .wd{display:none}",
      "html body #page .fo-sch-row .ev b{font-size:12.5px}",
      "html body #page .fo-sch-row .ev span{font-size:10.5px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  window.foRenderSchedulePage = function () {
    var page = document.getElementById("page"); if (!page) return;
    if ((location.hash || "").split("?")[0] !== "#/schedule") return;
    css();
    var pl = planet();
    if (!pl || !pl.phaseOf) {
      page.innerHTML = "<div class='fo-sch'><div class='fo-sch-hero'><div class='k'>The season</div>" +
        "<h1>Schedule</h1><p>The world calendar has not loaded yet &mdash; try again in a moment.</p></div></div>";
      return;
    }

    // WHERE THE WORLD IS NOW, read from the same clock the umpire settles by
    var now = Date.now(), here = null;
    try { here = pl.phaseOf(now); } catch (eP) {}
    var season = (here && here.season) || 1, today = here ? here.di : -1;

    // THE CLUB'S OWN HOUR. Every nation plays at its own time of day, and a
    // manager wants HIS rather than a table of nineteen. natHour is the
    // planet's own - the same function the fixture list and the umpire use -
    // so the time on this page is the time the match actually starts.
    var myHour = null, myNat = "";
    try {
      var cl = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (cl && cl.country) { myNat = String(cl.country).toUpperCase(); myHour = pl.natHour(cl.country); }
    } catch (eC) {}
    var hourTxt = (myHour == null || !(myHour >= 0))
      ? "&mdash;"
      : (("0" + (myHour | 0)).slice(-2) + ":00");

    var chips =
      "<span><b>" + season + "</b>Season</span>" +
      (today >= 0 ? "<span><b>" + (today + 1) + " / 42</b>Day of the season</span>" : "") +
      (here && here.round ? "<span><b>" + here.round + "</b>League round</span>" : "") +
      "<span><b>14</b>League rounds</span>" +
      "<span><b>6</b>Weeks a season</span>";

    var hero =
      "<div class='fo-sch-hero'><div class='k'>The season &middot; six weeks, forty-two days</div>" +
      "<h1>Schedule</h1>" +
      "<p>A season is six exact weeks and one year of a cricketer&rsquo;s life. The league plays Monday, " +
      "Tuesday, Thursday and Friday; the cups take the Sundays; the fourth week belongs to the boys, and " +
      "the league stands down while they have it. Everything below is read off the world&rsquo;s own clock.</p>" +
      "<div class='fo-sch-now'>" + chips +
      (myHour != null && myHour >= 0
        ? "<span><b>" + (("0" + (myHour | 0)).slice(-2) + ":00") + "</b>" + E(myNat || "Your") + " play at (UTC)</span>"
        : "") + "</div></div>";

    // ---- the forty-two days, a week at a time -----------------------------
    var body = "";
    for (var w = 0; w < 6; w++) {
      var rows = "";
      for (var d = 0; d < 7; d++) {
        var di = w * 7 + d;
        var p = dayPhase(pl, season, di);
        var t = tell(p);
        var isToday = (di === today);
        rows += "<div class='fo-sch-row " + t.c + (isToday ? " today" : "") + "'>" +
          "<span class='dy'>Day " + (di + 1) + "</span>" +
          "<span class='wd'>" + WD[di % 7] + "</span>" +
          "<span class='ev'><b>" + t.t + "</b><span>" + t.d + "</span></span>" +
          "<span class='hr'>" + (p.kind === "rest" || p.kind === "transition" ? "&mdash;" : hourTxt) + "</span>" +
          "</div>";
      }
      body += "<div class='fo-sch-wk'><div class='fo-sch-wkh'>" + E(weekName(w)) + "</div>" +
        "<div class='fo-sch-list'>" + rows + "</div></div>";
    }

    var note =
      "<div class='fo-sch-note'><h3>The rhythm of a week</h3><ul>" +
      "<li><b>Matches</b> start at your nation&rsquo;s own hour and run about three hours. England plays at 14:00 UTC; every other country has its own slot, shown on each fixture.</li>" +
      "<li><b>Orders lock at the first ball.</b> Anything you change after that applies to the next match, not this one.</li>" +
      "<li><b>The nets run on rest days.</b> Training, scouting trips and the academy all take the days with no cricket on them.</li>" +
      "<li><b>The transfer window is three days per listing</b> &mdash; a man goes on the board and the bidding closes three world days later.</li>" +
      "<li><b>The books settle every round.</b> Wages, the gate, the sponsor and upkeep all move when a round is played.</li>" +
      "<li><b>Day 38 is the turning of the year.</b> Everyone ages, the oldest retire, the boys come through, and clubs are promoted and relegated.</li>" +
      "</ul></div>";

    page.innerHTML = "<div class='fo-sch'>" + hero + body + note + "</div>";
  };

  // THE ONE PLACE A DAY BECOMES A PHASE.
  //
  // phaseOf takes a MOMENT, not a day, so a day of this season is turned into
  // one here rather than at seven call sites. EPOCH, DAY and seasonStart are
  // the planet's own, so this asks the world's clock what it plays on a given
  // day and never decides for itself. Noon is used so no rounding at a
  // boundary can land the answer on the day before.
  function dayPhase(pl, season, di) {
    try {
      var start = pl.seasonStart(season);                 // world day this season began
      var p = pl.phaseOf(pl.EPOCH + (start + di) * pl.DAY + 12 * 3600000);
      if (p && p.di === di) return p;
    } catch (e) {}
    return fallbackPhase(di);
  }
  // the calendar as the clock states it, used when a timestamp cannot be built
  function fallbackPhase(di) {
    var FA = { 6: "r16", 13: "qf", 20: "sf", 34: "final" };
    var CO = { 21: "r16", 22: "qf", 24: "sf", 25: "final" };
    var CH = { 35: "g1", 36: "g2", 37: "g3", 39: "qf", 40: "sf", 41: "final" };
    if (FA[di]) return { kind: "facup", stage: FA[di], di: di };
    if (CO[di]) return { kind: "colts", stage: CO[di], di: di };
    if (CH[di]) return { kind: "cup", stage: CH[di], di: di };
    if (di === 38) return { kind: "transition", di: di };
    if (di === 31) return { kind: "playoff", stage: "semi", di: di };
    if (di === 32) return { kind: "playoff", stage: "final", di: di };
    if (di === 28) return { kind: "league", round: 13, di: di };
    if (di === 29) return { kind: "league", round: 14, di: di };
    if (di < 21) {
      var pos = { 0: 1, 1: 2, 3: 3, 4: 4 }[di % 7];
      if (pos) return { kind: "league", round: Math.floor(di / 7) * 4 + pos, di: di };
    }
    return { kind: "rest", di: di };
  }
})();

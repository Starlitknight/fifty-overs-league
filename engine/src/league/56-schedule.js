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

   THE SPINE, and why the first draft of this page was wrong. It printed
   forty-two rows of equal weight, each carrying the same sentence - "Both
   divisions play. Your orders lock at the first ball." - so a rest day took
   exactly as much room as the Champions Cup final, and the two words that
   made a day different were buried under thirty that did not. A season has a
   shape and that page had none.

   Now a day with cricket on it gets a card in its competition's colour and a
   rest day gets a hairline. The colour says WHICH competition, so no card
   spends its words repeating it - a Colts Cup semi-final reads "Semi-finals"
   in orange, not "Colts Cup · semi-finals · The academies play and the league
   stands down". And every rule that used to be printed forty-two times is
   printed once, at the foot, in fine print.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foSched) return; window.__foSched = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function planet() { try { return window.__foPlanet || null; } catch (e) { return null; } }

  // ---- what a day IS, in as few words as carry the meaning -----------------
  // The colour rail on the card has already said which competition this is, so
  // none of these repeat it. `label` is what a card shows; `longOf` is the one
  // full name on the page, and it goes to the "next up" line.
  var STAGE = { r16: "Round of 16", qf: "Quarter-finals", sf: "Semi-finals", final: "Final",
                g1: "Group 1", g2: "Group 2", g3: "Group 3" };
  var COMP = { league: "League", facup: "National Cup", colts: "Colts Cup",
               cup: "Champions Cup", playoff: "League play-offs", transition: "The turning of the year" };
  var CLS = { league: "lg", facup: "fa", colts: "co", cup: "ch", playoff: "po", transition: "tr", rest: "re" };
  // the colours, one per competition, defined once so a competition can never
  // wear two different ones on the same page
  var COL = { lg: "#0E2246", fa: "#17636B", co: "#C9571F", po: "#8C2B2B",
              ch: "#6B3E8F", tr: "#4A5567", re: "rgba(20,28,40,.14)" };

  function label(p) {
    if (p.kind === "league") return "Round " + p.round;
    if (p.kind === "playoff") return p.stage === "final" ? "Final" : "Semi-finals";
    if (p.kind === "transition") return "New year";
    if (p.kind === "rest") return "";
    return STAGE[p.stage] || p.stage || "";
  }
  function longOf(p) {
    if (p.kind === "league") return "League &middot; round " + p.round;
    if (p.kind === "transition") return COMP.transition;
    if (p.kind === "rest") return "Rest day";
    return (COMP[p.kind] || "") + " &middot; " + label(p).toLowerCase();
  }

  // the weeks a reader thinks in, named for what they are
  var WK = ["Opening", "Second", "Third", "Colts", "Finals", "Champions Cup"];

  function css() {
    if (document.getElementById("fo-sch-css")) return;
    var s = document.createElement("style"); s.id = "fo-sch-css";
    s.textContent = [
      "html body #page .fo-sch{max-width:760px;margin:20px auto 46px;padding:0 18px;color:#141C28}",
      // ---- the head: the title, what is next, how far in --------------------
      "html body #page .fo-sch-hd{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;padding:0 2px 15px;border-bottom:1px solid rgba(20,28,40,.1)}",
      "html body #page .fo-sch-hd h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:33px;letter-spacing:-.02em;line-height:1;margin:0;flex:0 0 auto;color:#0E2246}",
      "html body #page .fo-sch-nx{flex:1 1 200px;min-width:0}",
      "html body #page .fo-sch-nx i{display:block;font-style:normal;font:600 8px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#B44A22}",
      "html body #page .fo-sch-nx b{display:block;font:600 15px/1.2 Inter,sans-serif;margin-top:6px;color:#141C28}",
      "html body #page .fo-sch-cd{flex:0 0 auto;white-space:nowrap;font:600 15px/1 Inter,sans-serif;font-variant-numeric:tabular-nums;color:rgba(20,28,40,.55)}",
      "html body #page .fo-sch-cd em{font-style:normal;font-size:11px;color:rgba(20,28,40,.34)}",
      "html body #page .fo-sch-tr{display:flex;align-items:center;gap:10px;padding:11px 2px 0}",
      "html body #page .fo-sch-tr u{flex:1;height:3px;border-radius:2px;background:rgba(20,28,40,.1);overflow:hidden;text-decoration:none}",
      "html body #page .fo-sch-tr u b{display:block;height:100%;background:#C9571F}",
      "html body #page .fo-sch-tr span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.34)}",
      // ---- the legend: a colour and a word ---------------------------------
      "html body #page .fo-sch-lg{display:flex;flex-wrap:wrap;gap:5px 14px;padding:12px 2px 0}",
      "html body #page .fo-sch-lg span{display:inline-flex;align-items:center;gap:6px;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.34)}",
      "html body #page .fo-sch-lg i{width:7px;height:7px;border-radius:2px;display:block}",
      // ---- the spine --------------------------------------------------------
      "html body #page .fo-sch-sp{margin-top:14px}",
      "html body #page .fo-sch-wk{display:flex;align-items:center;gap:10px;margin:16px 0 6px}",
      "html body #page .fo-sch-wk b{font:600 8px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.34)}",
      "html body #page .fo-sch-wk u{flex:1;border-top:1px solid rgba(20,28,40,.1);text-decoration:none}",
      "html body #page .fo-sch-row{display:flex;align-items:center;gap:12px;background:#FFFEFC;border-left:3px solid var(--c);border-radius:0 9px 9px 0;padding:11px 13px;margin-bottom:4px;box-shadow:0 4px 14px rgba(30,38,52,.05)}",
      "html body #page .fo-sch-row .dn{flex:0 0 26px;font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.34);font-variant-numeric:tabular-nums}",
      "html body #page .fo-sch-row .ev{flex:1;min-width:0;font:600 13.5px/1.25 Inter,sans-serif;color:#141C28}",
      "html body #page .fo-sch-row .hr{font:500 11.5px/1 Inter,sans-serif;color:rgba(20,28,40,.34);font-variant-numeric:tabular-nums}",
      // a final is the one day of a competition worth colouring the words for
      "html body #page .fo-sch-row.fin .ev{color:var(--c)}",
      "html body #page .fo-sch-row.today{box-shadow:0 0 0 2px #C9571F}",
      "html body #page .fo-sch-row.today .dn{color:#B44A22}",
      "html body #page .fo-sch-rest{display:flex;align-items:center;gap:12px;padding:5px 13px 5px 16px;margin-bottom:4px}",
      "html body #page .fo-sch-rest .dn{flex:0 0 26px;font:500 11px/1 Inter,sans-serif;color:rgba(20,28,40,.34);font-variant-numeric:tabular-nums}",
      "html body #page .fo-sch-rest u{flex:1;border-top:1px dashed rgba(20,28,40,.1);text-decoration:none}",
      "html body #page .fo-sch-rest.today .dn{color:#B44A22;font-weight:700}",
      // the rules, once, at the foot, in fine print
      "html body #page .fo-sch-fine{margin:16px 2px 0;font:400 11px/1.6 Inter,sans-serif;color:rgba(20,28,40,.34)}",
      "@media(max-width:640px){",
      "html body #page .fo-sch{padding:0 12px;margin-top:16px}",
      "html body #page .fo-sch-hd{gap:12px}",
      "html body #page .fo-sch-hd h1{flex:1 1 100%;font-size:28px}",
      "html body #page .fo-sch-row{padding:10px 11px;gap:10px}",
      "html body #page .fo-sch-row .ev{font-size:13px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function hh(h) { return (h == null || !(h >= 0)) ? "" : ("0" + (h | 0)).slice(-2) + ":00"; }
  // a countdown read at a glance: days out while it is days out, then the
  // clock face once it is close enough to matter in hours
  function cdText(ms) {
    if (!(ms > 0)) return "now";
    var m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
    if (d > 0) return d + "d " + h + "h";
    return h + ":" + ("0" + mi).slice(-2);
  }

  // ONE PLACE TURNS A DAY OF THIS SEASON INTO A MOMENT. The countdown and the
  // first ball of a row both ask here, so the page cannot disagree with itself
  // about when a day starts.
  function ballAt(pl, season, di, hour) {
    try {
      var start = pl.seasonStart(season);
      return pl.EPOCH + (start + di) * pl.DAY + (hour | 0) * 3600000;
    } catch (e) { return 0; }
  }

  var TICK = null;
  function stopTick() { if (TICK) { clearInterval(TICK); TICK = null; } }

  window.foRenderSchedulePage = function () {
    var page = document.getElementById("page"); if (!page) return;
    if ((location.hash || "").split("?")[0] !== "#/schedule") { stopTick(); return; }
    css();
    var pl = planet();
    if (!pl || !pl.phaseOf) {
      page.innerHTML = "<div class='fo-sch'><div class='fo-sch-hd'><h1>Schedule</h1></div>" +
        "<p class='fo-sch-fine'>The world calendar has not loaded yet &mdash; try again in a moment.</p></div>";
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
    if (myHour == null || !(myHour >= 0)) { try { myHour = pl.natHour("eng"); } catch (eH) { myHour = 14; } }
    var hourTxt = hh(myHour);

    // the forty-two days, each one asked of the clock
    var days = [];
    for (var di = 0; di < 42; di++) {
      var p = dayPhase(pl, season, di);
      days.push({ di: di, p: p, cls: CLS[p.kind] || "re",
        rest: p.kind === "rest", fin: p.stage === "final",
        hr: (p.kind === "rest" || p.kind === "transition") ? "" : hourTxt });
    }
    // the next first ball still ahead of the clock - not merely the next day
    // with cricket on it, because on a match afternoon that day is today and
    // its ball has already been bowled
    var next = null;
    for (var n = 0; n < days.length; n++) {
      if (days[n].rest || days[n].di < today) continue;
      var t = ballAt(pl, season, days[n].di, myHour);
      if (t > now) { next = days[n]; next.__t = t; break; }
    }

    var head =
      "<div class='fo-sch-hd'><h1>Schedule</h1>" +
      (next
        ? "<div class='fo-sch-nx'><i>Next</i><b>" + longOf(next.p) + "</b></div>" +
          "<div class='fo-sch-cd'><span id='fo-sch-cd'>" + E(cdText(next.__t - now)) + "</span> <em>to first ball</em></div>"
        : "<div class='fo-sch-nx'><i>Next</i><b>The season is played out</b></div>") +
      "</div>" +
      "<div class='fo-sch-tr'><span>Day " + (today >= 0 ? today + 1 : "&mdash;") + "</span>" +
      "<u><b style='width:" + Math.max(0, Math.min(100, Math.round(((today + 1) / 42) * 100))) + "%'></b></u>" +
      "<span>42</span></div>";

    var legend = "<div class='fo-sch-lg'>" +
      [["lg", "League"], ["fa", "Cup"], ["co", "Colts"], ["po", "Play-offs"],
       ["ch", "Champions"], ["tr", "New year"]].map(function (k) {
        return "<span><i style='background:" + COL[k[0]] + "'></i>" + k[1] + "</span>";
      }).join("") + "</div>";

    var body = "<div class='fo-sch-sp'>";
    for (var w = 0; w < 6; w++) {
      body += "<div class='fo-sch-wk'><b>" + E(WK[w] || ("Week " + (w + 1))) + "</b><u></u></div>";
      for (var d = 0; d < 7; d++) {
        var x = days[w * 7 + d], isToday = (x.di === today);
        if (x.rest) {
          body += "<div class='fo-sch-rest" + (isToday ? " today" : "") + "'>" +
            "<span class='dn'>" + (x.di + 1) + "</span><u></u></div>";
          continue;
        }
        body += "<div class='fo-sch-row" + (x.fin ? " fin" : "") + (isToday ? " today" : "") +
          "' style='--c:" + COL[x.cls] + "'>" +
          "<span class='dn'>" + (x.di + 1) + "</span>" +
          "<span class='ev'>" + label(x.p) + "</span>" +
          "<span class='hr'>" + (x.hr || "&mdash;") + "</span></div>";
      }
    }
    body += "</div>";

    var fine = "<p class='fo-sch-fine'>All times UTC" +
      (hourTxt ? " &middot; " + E(myNat || "your league") + " plays at " + hourTxt : "") +
      " &middot; orders lock at the first ball &middot; the nets, scouting and the market run on the rest days" +
      " &middot; day 38 turns the year: everyone ages, the oldest retire, and clubs go up and down.</p>";

    page.innerHTML = "<div class='fo-sch'>" + head + legend + body + fine + "</div>";

    // the countdown is the one live thing on the page, so it is the one thing
    // that ticks; the calendar behind it does not move. When it runs out the
    // page repaints once, which advances "next" and re-lights today.
    stopTick();
    if (next) {
      TICK = setInterval(function () {
        var el = document.getElementById("fo-sch-cd");
        if (!el || (location.hash || "").split("?")[0] !== "#/schedule") { stopTick(); return; }
        var left = next.__t - Date.now();
        if (left <= 0) { stopTick(); try { window.foRenderSchedulePage(); } catch (e) {} return; }
        el.textContent = cdText(left);
      }, 1000);
    }
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

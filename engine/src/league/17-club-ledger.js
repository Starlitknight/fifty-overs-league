/* ============================================================================
   THE CLUB LEDGER — the finance layer, made real and made visible.

   The engine always had a bank and a ledger; what it lacked was teeth and a
   face. Teeth: every round now settles the full wage bill, the league's
   broadcast distribution arrives, and the shirt sponsor - a deal YOU signed -
   pays out, with a win bonus if you earned one. Face: #/ledger is the club's
   linen account book, entries in red and black ink with a running balance,
   plus the two decisions a chairman actually makes: which sponsor to sign,
   and what to build.

   Offline-fair like everything else: settlements run inside the same
   completeRound that resolves the matches, guarded by a per-round stamp so
   they apply exactly once no matter which client advances the world, and
   sponsor offers are a pure function of the season - both managers see the
   same two deals on the table.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foClubLedger) return; window.__foClubLedger = 1;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hashS(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function M$(n) { n = Math.round(n || 0); var s = (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(); return s; }
  function myName() { try { return userTeam().name; } catch (e) { return ""; } }

  // ---------------------------------------------------------------------------
  // The numbers
  // ---------------------------------------------------------------------------
  var FO_TV = 24000;   // league broadcast distribution, every club, every round
  function foWages(t) { return ((t && t.players) || []).reduce(function (a, p) { return a + (p.wage || 0); }, 0); }

  // the two deals on the table this season: a pure function of the season and
  // the club, so every client offers the same ink on the same dotted lines
  var FO_SPONSORS = [
    { id: "brew", name: "Harbour & Sons Brewery", blurb: "Steady money, no questions. Their name has been on scoreboards since 1911." },
    { id: "bat", name: "Whitlow Bat Co.", blurb: "Backs winners. Modest retainer, handsome bonus every time you take the points." },
    { id: "rail", name: "The Railway Hotel", blurb: "The team bath sponsor. Reliable, unglamorous, always pays on the day." },
    { id: "wool", name: "Aldgate Woollens", blurb: "Sweaters for the whole league. Flat and fair." },
    { id: "assur", name: "Pennine Assurance", blurb: "Actuaries love a win bonus - they have done the sums on your batting." }
  ];
  function foOffers() {
    if (!ready()) return [];
    var seed = hashS("spon|" + (App.seasonNo || 1) + "|" + myName());
    var a = seed % FO_SPONSORS.length, b2 = (a + 1 + (seed >> 3) % (FO_SPONSORS.length - 1)) % FO_SPONSORS.length;
    var flat = FO_SPONSORS[a], perf = FO_SPONSORS[b2];
    return [
      { id: flat.id, name: flat.name, blurb: flat.blurb, flat: 10000 + (seed % 5) * 500, win: 0 },
      { id: perf.id, name: perf.name, blurb: perf.blurb, flat: 5000 + ((seed >> 5) % 4) * 500, win: 8000 + ((seed >> 8) % 5) * 500 }
    ];
  }
  function foDeal() {
    var d = App.fin && App.fin.sponsor;
    return (d && d.season === (App.seasonNo || 1)) ? d : null;
  }

  // ---------------------------------------------------------------------------
  // Settlement: runs with the round, exactly once
  // ---------------------------------------------------------------------------
  function foSettle() {
    if (!ready() || !App.season || typeof ledger !== "function") return;
    var doneR = (App.season.round || 0) - 1; if (doneR < 0) return;
    var key = "S" + (App.seasonNo || 1) + "R" + doneR;
    App.fin = App.fin || { bank: 500000, ledger: [] };
    if (App.fin.settledR === key) return;
    App.fin.settledR = key;
    var me = userTeam();
    ledger("Player wages (" + (me.players || []).length + " men)", -foWages(me));
    ledger("League broadcast distribution", FO_TV);
    var deal = foDeal();
    if (deal) {
      var won = false;
      (App.results || []).forEach(function (r) {
        if (r.comp === "league" && (r.seasonNo || App.seasonNo) === (App.seasonNo || 1) && r.round === doneR &&
          r.result && r.result.winner === me.name) won = true;
      });
      ledger(deal.name + (won && deal.win ? " (incl. win bonus)" : ""), deal.flat + (won ? (deal.win || 0) : 0));
    }
  }
  if (typeof window.completeRound === "function" && !window.completeRound.__foLed) {
    var _cr = window.completeRound;
    window.completeRound = function () {
      var out = _cr.apply(this, arguments);
      try { foSettle(); if (typeof saveGame === "function") saveGame(false); } catch (e) {}
      return out;
    };
    window.completeRound.__foLed = 1;
  }

  // ---------------------------------------------------------------------------
  // The book (#/ledger)
  // ---------------------------------------------------------------------------
  function foRunway() {
    var me = userTeam();
    var burn = foWages(me) + (me.seats || 9000) + ((me.acadY || 2) + (me.acadS || 2)) * 2500;
    var att = (typeof attendance === "function") ? attendance(me) : 2600;
    var deal = foDeal();
    var inc = FO_TV + (deal ? deal.flat : 0) + Math.round(att * 9 / 2);  // gate only every other round
    var net = inc - burn;
    return { burn: burn, inc: inc, net: net, gate: att * 9,
      rounds: net >= 0 ? null : Math.max(0, Math.floor((App.fin.bank || 0) / -net)) };
  }
  window.foRenderLedger = function () {
    try { if (window.foLsCss) window.foLsCss(); } catch (eLs) {}   // this room wears the season sheet's buttons
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foLedCss();
    document.body.classList.add("fo-led-on");
    try { if (typeof econInit === "function") econInit(); } catch (e0) {}
    var me = userTeam(), fin = App.fin || { bank: 0, ledger: [] };
    var rw = foRunway(), deal = foDeal();
    var stat = function (k, v, sub) { return "<div class='fo-led-stat'><span>" + k + "</span><b>" + v + "</b>" + (sub ? "<em>" + sub + "</em>" : "") + "</div>"; };
    var hero = "<div class='fo-led-hero'>" +
      "<div class='fo-led-tag'>The club accounts &middot; season " + (App.seasonNo || 1) + "</div>" +
      "<div class='fo-led-stats'>" +
      stat("Bank", M$(fin.bank)) +
      stat("Wages / round", M$(-foWages(me)), (me.players || []).length + " professionals") +
      stat("Next home gate", "~" + M$(rw.gate), (typeof attendance === "function" ? attendance(me).toLocaleString() : "") + " expected") +
      stat("Round result", (rw.net >= 0 ? "+" : "") + M$(rw.net).replace("$-", "-$"), rw.rounds != null ? "covers ~" + rw.rounds + " more rounds" : "in the black") +
      "</div></div>";

    // the deals on the table, or the one already signed
    var spon;
    if (deal) {
      spon = "<div class='fo-led-sec'><h3>The shirt</h3><div class='fo-led-deal on'><b>" + E(deal.name) + "</b>" +
        "<span>" + M$(deal.flat) + " a round" + (deal.win ? " &middot; " + M$(deal.win) + " every win" : "") + " &middot; signed for season " + deal.season + "</span></div></div>";
    } else {
      var offers = foOffers();
      spon = "<div class='fo-led-sec'><h3>The shirt is bare</h3><p class='fo-led-note'>Two deals on the table. Both run to the end of the season; neither waits forever, but neither walks away either.</p>" +
        offers.map(function (o) {
          return "<div class='fo-led-deal'><b>" + E(o.name) + "</b>" +
            "<span>" + M$(o.flat) + " a round" + (o.win ? " &middot; " + M$(o.win) + " every win" : " &middot; no strings") + "</span>" +
            "<i>" + E(o.blurb) + "</i>" +
            "<button type='button' class='fo-ls-btn' data-led-sign='" + E(o.id) + "'>Sign</button></div>";
        }).join("") + "</div>";
    }

    // capital works: what a chairman can actually build
    var canStand = fin.bank >= 240000, canAcad = (me.acadS || 2) < 5 && fin.bank >= (me.acadS || 2) * 60000;
    var works = "<div class='fo-led-sec'><h3>Works</h3>" +
      "<div class='fo-led-work'><b>Extend the stand</b><span>+2,000 seats &middot; bigger gates, dearer upkeep</span>" +
      "<button type='button' class='fo-ls-btn" + (canStand ? "" : " off") + "' data-led-work='stand'>" + M$(-240000).replace("-", "") + "</button></div>" +
      ((me.acadS || 2) < 5 ? "<div class='fo-led-work'><b>Senior academy, level " + ((me.acadS || 2) + 1) + "</b><span>the pros develop faster</span>" +
        "<button type='button' class='fo-ls-btn" + (canAcad ? "" : " off") + "' data-led-work='acad'>" + M$(-(me.acadS || 2) * 60000).replace("-", "") + "</button></div>" : "") +
      "</div>";

    // the book itself: red and black ink, running balance
    var rows = (fin.ledger || []).slice(0, 60).map(function (l) {
      return "<tr><td class='wk'>" + E(l.wk || "") + "</td><td>" + E(l.label || l.item || "") + "</td>" +
        "<td class='n " + ((l.amt || 0) < 0 ? "out" : "in") + "'>" + M$(l.amt) + "</td>" +
        "<td class='n bal'>" + (l.balance != null ? M$(l.balance) : "") + "</td></tr>";
    }).join("");
    var book = "<div class='fo-led-sec'><h3>The book</h3>" +
      (rows ? "<table class='fo-led-book'><thead><tr><th>Round</th><th>Entry</th><th class='n'>Amount</th><th class='n'>Balance</th></tr></thead><tbody>" + rows + "</tbody></table>"
        : "<p class='fo-led-note'>Nothing written yet. The first round opens the book.</p>") + "</div>";

    page.innerHTML = "<div class='fo-led'>" + hero +
      "<div class='fo-led-paper'>" + spon + works + book +
      "<div class='fo-led-foot'>Kept in the club's own hand. Prize money lands at the season's end; the cup pays its winners.</div></div>" +
      "<div class='fo-cer-actions' style='margin-top:16px'><a class='fo-ls-btn ghost' href='#/desk'>&lsaquo; The desk</a></div></div>";

    page.querySelectorAll("[data-led-sign]").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = foOffers().filter(function (x) { return x.id === b.getAttribute("data-led-sign"); })[0];
        if (!o || foDeal()) return;
        App.fin.sponsor = { id: o.id, name: o.name, flat: o.flat, win: o.win, season: App.seasonNo || 1 };
        try { saveGame(false); } catch (e) {}
        window.foRenderLedger();
      });
    });
    page.querySelectorAll("[data-led-work]").forEach(function (b) {
      b.addEventListener("click", function () {
        var me2 = userTeam(), kind = b.getAttribute("data-led-work");
        if (kind === "stand" && App.fin.bank >= 240000) { ledger("Stand extension (+2,000 seats)", -240000); me2.seats = (me2.seats || 9000) + 2000; }
        else if (kind === "acad" && (me2.acadS || 2) < 5 && App.fin.bank >= (me2.acadS || 2) * 60000) { ledger("Senior academy upgrade", -(me2.acadS || 2) * 60000); me2.acadS = (me2.acadS || 2) + 1; }
        else return;
        try { saveGame(false); } catch (e) {}
        window.foRenderLedger();
      });
    });
  };
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/ledger") document.body.classList.remove("fo-led-on"); });

  // the desk card: the week's money at a glance, and the pen if the shirt is bare
  window.foLedgerCard = function () {
    if (!ready() || !App.fin) return "";
    var rw = foRunway(), deal = foDeal();
    var last = (App.fin.ledger || []).slice(0, 3).map(function (l) {
      return "<div class='fo-ls-line'><i class='" + (l.amt < 0 ? "fo-led-r" : "fo-led-g") + "'>" + (l.amt < 0 ? "&#9662;" : "&#9652;") + "</i>" + E(l.label || "") + " <b>" + M$(l.amt) + "</b></div>";
    }).join("");
    return "<div class='fo-card fo-ls-card pap letter'><div class='fo-let-head'><i>" + E(myName() || "The Club") + " C.C.</i><b>Statement of account</b></div>" +
      "<div class='fo-card-h2row'><div class='fo-card-h2'>The ledger</div><span class='fo-ls-k'>Bank <b>" + M$(App.fin.bank) + "</b></span></div><div class='fo-card-b'>" +
      (last || "<div class='fo-ls-line fo-ls-fine'>The book opens with the first round.</div>") +
      (!deal ? "<div class='fo-ls-line' style='margin-top:8px'><b>The shirt is bare</b> &mdash; two sponsors are waiting on your signature.</div>" : "") +
      "<a class='fo-ls-btn ghost' href='#/ledger'>Open the book &rsaquo;</a></div></div>";
  };

  function foLedCss() {
    if (document.getElementById("fo-led-css")) return;
    var s = document.createElement("style"); s.id = "fo-led-css";
    s.textContent = [
      "html body.ftpskin.fo-led-on,html body.fo-led-on{background:linear-gradient(180deg,#f2ebd6,#ece3ca) fixed !important}",
      "html body.fo-led-on .wrap{max-width:none !important;width:100% !important;background:transparent !important;box-shadow:none !important}",
      ".fo-led{max-width:880px;margin:0 auto;padding:18px 14px 40px}",
      "html body #page .fo-led-hero{background:linear-gradient(135deg,#FFFEFB,#F5F0E2 70%) !important;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:18px 20px;box-shadow:0 12px 28px rgba(30,38,52,.12);margin-bottom:18px}",
      ".fo-led-tag{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:#B44A22;margin-bottom:12px}",
      ".fo-led-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}",
      ".fo-led-stat span{display:block;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#8A8272}",
      ".fo-led-stat b{display:block;font-size:20px;color:#141C28;font-variant-numeric:tabular-nums;margin:2px 0 1px}",
      ".fo-led-stat em{font-style:normal;font-size:11px;color:#8A8272}",
      ".fo-led-paper{background:linear-gradient(172deg,#f8f1de,#f0e6cb 60%,#e9ddbe);border-radius:4px;box-shadow:0 16px 34px rgba(0,0,0,.28),0 2px 7px rgba(0,0,0,.18);padding:20px 22px 16px;color:#3a3020}",
      ".fo-led-sec{margin-bottom:22px}",
      ".fo-led-sec h3{font-family:Georgia,serif;font-size:17px;color:#241d0e;border-top:3px double #241d0e;border-bottom:1px solid rgba(36,29,14,.55);padding:8px 2px;margin:0 0 12px}",
      ".fo-led-note{font-family:Georgia,serif;font-style:italic;font-size:13px;color:#6d5c36;margin:0 0 12px}",
      ".fo-led-deal{border:1px dotted rgba(36,29,14,.45);border-radius:3px;padding:12px 14px;margin-bottom:10px}",
      ".fo-led-deal.on{border-style:solid;border-color:#2f7a52;background:rgba(47,122,82,.07)}",
      ".fo-led-deal b{display:block;font-family:Georgia,serif;font-size:15px;color:#241d0e}",
      ".fo-led-deal span{display:block;font-size:12.5px;color:#463a20;margin:2px 0}",
      ".fo-led-deal i{display:block;font-family:Georgia,serif;font-style:italic;font-size:12px;color:#8a7b52;margin-bottom:8px}",
      ".fo-led-work{display:flex;align-items:center;gap:12px;border-bottom:1px dotted rgba(36,29,14,.3);padding:9px 2px}",
      ".fo-led-work b{font-family:Georgia,serif;color:#241d0e;font-size:14px}",
      ".fo-led-work span{flex:1;font-size:12px;color:#8a7b52}",
      "html body .fo-ls-btn.off{opacity:.45;pointer-events:none}",
      ".fo-led-book{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}",
      ".fo-led-book th{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#8a7b52;text-align:left;border-bottom:1px solid rgba(36,29,14,.55);padding:6px 6px}",
      ".fo-led-book th.n{text-align:right}",
      ".fo-led-book td{border-bottom:1px dotted rgba(36,29,14,.3);padding:7px 6px;color:#3a3020}",
      ".fo-led-book td.n{text-align:right}",
      ".fo-led-book td.wk{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.08em;color:#8a7b52;white-space:nowrap}",
      ".fo-led-book td.in{color:#1f5c3f;font-weight:600}",
      ".fo-led-book td.out{color:#a13a20;font-weight:600}",
      ".fo-led-book td.bal{color:#241d0e}",
      ".fo-led-foot{font-family:Georgia,serif;font-style:italic;font-size:11.5px;color:#8a7b52;margin-top:14px}",
      ".fo-led-r{color:#a13a20}.fo-led-g{color:#1f5c3f}",
      "@media(max-width:700px){.fo-led-stats{grid-template-columns:1fr 1fr}.fo-led-paper{padding:14px 12px}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();

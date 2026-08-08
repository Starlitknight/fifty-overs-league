/* ============================================================================
   MATCHDAY DRESS — two rooms the club walks through on match day, reskinned
   into the painted world without touching a line of their logic.

   THE SCORER'S BOOK (#/scorecard): the navy broadcast summary stays — that's
   the television half — but everything under it becomes the scorer's linen
   book: ruled paper, dismissals in ink italic, margin boxes, and a red
   FULL TIME stamp pressed onto the page at stumps.

   THE DRESSING ROOM (#/orders) is retired: the orders page reads in the
   game's own daylight now, like every other page. Its own sheet (league/
   08-orders.js) carries the cream cards, so nothing here paints it any more.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foDress) return; window.__foDress = 1;

  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }

  function ensureStamp() {
    if (!document.body.classList.contains("fo-scb-on")) return;
    var page = document.getElementById("page"); if (!page) return;
    if (page.querySelector(".fo-scb-stamp")) return;
    // only a finished match gets the stamp — live and preview cards do not
    var hero = page.querySelector(".fo-mhead") || page.querySelector(".fo-live-hero");
    if (!hero || (hero.textContent || "").indexOf("FULL TIME") < 0) return;
    var host = page.querySelector(".fo-sci"); if (!host) return;
    var st = document.createElement("span");
    st.className = "fo-scb-stamp"; st.textContent = "FULL TIME";
    host.appendChild(st);
  }
  function apply() {
    var h = (location.hash || "").split("?")[0];
    document.body.classList.toggle("fo-scb-on", h === "#/scorecard");
    // the dark room is gone: strip it wherever an older session left it on
    try {
      document.body.classList.remove("fo-drs-on");
      var b0 = document.getElementById("fo-drs-bg"); if (b0) b0.remove();
      var v0 = document.getElementById("fo-drs-veil"); if (v0) v0.remove();
    } catch (eD) {}
    if (h === "#/scorecard") ensureStamp();
  }
  window.addEventListener("hashchange", function () { setTimeout(apply, 60); });
  try {
    new MutationObserver(function () { try { apply(); } catch (e) {} })
      .observe(document.getElementById("page") || document.body, { childList: true, subtree: true });
  } catch (eOb) {}
  setTimeout(apply, 120);

  var s = document.createElement("style"); s.id = "fo-dress-css";
  s.textContent = [
    // ======================= THE SCORER'S BOOK ==============================
    // laid paper: faint ruled lines and a soft vignette, no texture files
    "html body.ftpskin.fo-scb-on,html body.fo-scb-on{background:linear-gradient(180deg,#f2ebd6,#ece3ca) fixed !important}",
    "body.fo-scb-on #page{position:relative}",
    "body.fo-scb-on #page:before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(43,36,22,.045) 27px 28px),radial-gradient(120% 90% at 50% 0%,transparent 60%,rgba(43,36,22,.08))}",
    "body.fo-scb-on #page>*{position:relative;z-index:1}",
    // innings panels shed their chrome and sit straight on the page
    "html body.ftpskin.fo-scb-on .fo-sci,html body.fo-scb-on .fo-sci{position:relative;background:transparent !important;border:0 !important;box-shadow:none !important;border-radius:0;margin-bottom:26px}",
    // the navy innings bar becomes a book heading: double rule over, single under
    "html body.ftpskin.fo-scb-on .fo-sci-head,html body.fo-scb-on .fo-sci-head{background:transparent !important;color:#241d0e !important;border-top:3px double #241d0e;border-bottom:1px solid rgba(36,29,14,.65);padding:9px 4px !important;font-family:Fraunces,Georgia,serif}",
    "html body.fo-scb-on #page .fo-sci-head b{font-size:17px;letter-spacing:.02em;color:#241d0e !important;-webkit-text-fill-color:#241d0e !important}",
    "html body.fo-scb-on #page .fo-sci-head n{font-family:Fraunces,Georgia,serif;font-weight:700;color:#241d0e !important}",
    "html body.fo-scb-on #page .fo-sci-head span{color:#241d0e !important}",
    "html body.fo-scb-on #page .fo-sci-head em{color:#7c6c45 !important}",
    "html body.fo-scb-on #page .fo-sci-head .fo-sci-tgl{color:#a1926a !important}",
    // the table: ink rules, no zebra, scorer's numerals
    "html body.ftpskin.fo-scb-on .fo-sct tr td,html body.fo-scb-on .fo-sct tr td{background:transparent !important;border-bottom:1px dotted rgba(36,29,14,.35) !important;color:#2b2416;font-variant-numeric:tabular-nums}",
    "html body.ftpskin.fo-scb-on .fo-sct th,html body.fo-scb-on .fo-sct th{background:transparent !important;color:#8a7b52 !important;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid rgba(36,29,14,.55) !important}",
    "html body.fo-scb-on #page .fo-sct a,html body.ftpskin.fo-scb-on #page .fo-sct a{color:#2b2416 !important;text-decoration:none;border-bottom:1px dotted rgba(138,74,33,.5)}",
    // dismissals: the scorer's ink italic
    "body.fo-scb-on .fo-sci-dis,body.fo-scb-on .fo-sci-disc{font-family:Fraunces,Georgia,serif;font-style:normal;color:#6d5c36 !important;font-size:12.5px}",
    // not out lives in red ink, as it always has
    "body.fo-scb-on .fo-sci-no td:first-child,body.fo-scb-on .fo-sci-no .fo-sci-dis,body.fo-scb-on .fo-sci-no .fo-sci-disc{color:#a13a20 !important}",
    "body.fo-scb-on .fo-sci-ex td,body.fo-scb-on .fo-sci-tot td{border-bottom:0 !important}",
    "body.fo-scb-on .fo-sci-tot td{border-top:2px solid #241d0e !important;font-family:Fraunces,Georgia,serif}",
    "body.fo-scb-on .fo-sci-rr{color:#8a7b52 !important}",
    // margin boxes: did-not-bat and the fall, ruled off to the side
    "body.fo-scb-on .fo-sci-box{background:transparent !important;border:1px dotted rgba(36,29,14,.45) !important;border-radius:0}",
    "body.fo-scb-on .fo-sci-box b{color:#8a7b52;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase}",
    "body.fo-scb-on .fo-sci-box span{color:#463a20;font-family:Fraunces,Georgia,serif;font-style:normal;font-size:12.5px}",
    // tabs become a contents line in the book's own hand
    "html body.fo-scb-on #page .fo-sctab,html body.ftpskin.fo-scb-on #page .fo-sctab{background:transparent !important;border:0 !important;border-radius:0 !important;padding:7px 2px !important;margin-right:16px;font-family:Oswald,sans-serif !important;font-size:10px !important;letter-spacing:.18em;text-transform:uppercase;color:#8a7b52 !important;border-bottom:2px solid transparent !important;cursor:pointer}",
    "html body.fo-scb-on #page .fo-sctab.on{color:#8a4a21 !important;border-bottom-color:#C95532 !important}",
    // generic panels on the page (charts, ratings) join the paper
    "html body.ftpskin.fo-scb-on #page .panel,html body.fo-scb-on #page .panel{background:transparent !important;border:0 !important;box-shadow:none !important}",
    "html body.ftpskin.fo-scb-on #page .panel h4,html body.fo-scb-on #page .panel h4{background:transparent !important;color:#241d0e !important;border-top:3px double #241d0e;border-bottom:1px solid rgba(36,29,14,.65);font-family:Fraunces,Georgia,serif;padding:9px 4px}",
    // the stamp, pressed slightly askew at the top of the first innings page
    ".fo-scb-stamp{position:absolute;top:52px;right:16px;z-index:2;transform:rotate(-7deg);font-family:Oswald,sans-serif;font-weight:700;font-size:15px;letter-spacing:.26em;color:#c23b25;border:3px solid #c23b25;border-radius:5px;padding:5px 12px 4px;opacity:.72;pointer-events:none;mix-blend-mode:multiply}",
    "@media(max-width:760px){.fo-scb-stamp{font-size:12px;top:46px;right:6px}}"
  ].join("\n");
  // the skin's stylesheet is inlined after the scripts, so equal-specificity
  // ties would go against us from <head>. Living at the end of <body> makes
  // this sheet the last word instead.
  function lastWord() { try { (document.body || document.head).appendChild(s); } catch (e) { document.head.appendChild(s); } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lastWord);
  else lastWord();
})();

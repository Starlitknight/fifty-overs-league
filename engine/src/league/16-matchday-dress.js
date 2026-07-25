/* ============================================================================
   MATCHDAY DRESS — two rooms the club walks through on match day, reskinned
   into the painted world without touching a line of their logic.

   THE SCORER'S BOOK (#/scorecard): the navy broadcast summary stays — that's
   the television half — but everything under it becomes the scorer's linen
   book: ruled paper, dismissals in ink italic, margin boxes, and a red
   FULL TIME stamp pressed onto the page at stumps.

   THE DRESSING ROOM (#/orders): the plan is made where plans are made. The
   dressing-room painting sits behind everything, panels turn to dark glass,
   the bowling lanes become the Gaffer's chalkboard, and the toss call is a
   worn gold coin. All the existing drag/tap interactions are untouched —
   this module only ever adds paint.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foDress) return; window.__foDress = 1;

  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }

  function ensureRoom() {
    if (!document.body.classList.contains("fo-drs-on")) return;
    if (document.getElementById("fo-drs-bg")) return;
    var img = document.createElement("img");
    img.id = "fo-drs-bg"; img.alt = "";
    img.src = ART() + "home/" + (window.innerWidth < 760 ? "hgm" : "hgd") + "-dressing-room.webp";
    img.onerror = function () { img.remove(); };
    var veil = document.createElement("div"); veil.id = "fo-drs-veil";
    document.body.appendChild(img); document.body.appendChild(veil);
  }
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
    document.body.classList.toggle("fo-drs-on", h === "#/orders");
    if (h === "#/orders") ensureRoom();
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
    "html body.ftpskin.fo-scb-on .fo-sci-head,html body.fo-scb-on .fo-sci-head{background:transparent !important;color:#241d0e !important;border-top:3px double #241d0e;border-bottom:1px solid rgba(36,29,14,.65);padding:9px 4px !important;font-family:Georgia,serif}",
    "html body.fo-scb-on #page .fo-sci-head b{font-size:17px;letter-spacing:.02em;color:#241d0e !important;-webkit-text-fill-color:#241d0e !important}",
    "html body.fo-scb-on #page .fo-sci-head n{font-family:Georgia,serif;font-weight:700;color:#241d0e !important}",
    "html body.fo-scb-on #page .fo-sci-head span{color:#241d0e !important}",
    "html body.fo-scb-on #page .fo-sci-head em{color:#7c6c45 !important}",
    "html body.fo-scb-on #page .fo-sci-head .fo-sci-tgl{color:#a1926a !important}",
    // the table: ink rules, no zebra, scorer's numerals
    "html body.ftpskin.fo-scb-on .fo-sct tr td,html body.fo-scb-on .fo-sct tr td{background:transparent !important;border-bottom:1px dotted rgba(36,29,14,.35) !important;color:#2b2416;font-variant-numeric:tabular-nums}",
    "html body.ftpskin.fo-scb-on .fo-sct th,html body.fo-scb-on .fo-sct th{background:transparent !important;color:#8a7b52 !important;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid rgba(36,29,14,.55) !important}",
    "html body.fo-scb-on #page .fo-sct a,html body.ftpskin.fo-scb-on #page .fo-sct a{color:#2b2416 !important;text-decoration:none;border-bottom:1px dotted rgba(138,74,33,.5)}",
    // dismissals: the scorer's ink italic
    "body.fo-scb-on .fo-sci-dis,body.fo-scb-on .fo-sci-disc{font-family:Georgia,serif;font-style:italic;color:#6d5c36 !important;font-size:12.5px}",
    // not out lives in red ink, as it always has
    "body.fo-scb-on .fo-sci-no td:first-child,body.fo-scb-on .fo-sci-no .fo-sci-dis,body.fo-scb-on .fo-sci-no .fo-sci-disc{color:#a13a20 !important}",
    "body.fo-scb-on .fo-sci-ex td,body.fo-scb-on .fo-sci-tot td{border-bottom:0 !important}",
    "body.fo-scb-on .fo-sci-tot td{border-top:2px solid #241d0e !important;font-family:Georgia,serif}",
    "body.fo-scb-on .fo-sci-rr{color:#8a7b52 !important}",
    // margin boxes: did-not-bat and the fall, ruled off to the side
    "body.fo-scb-on .fo-sci-box{background:transparent !important;border:1px dotted rgba(36,29,14,.45) !important;border-radius:0}",
    "body.fo-scb-on .fo-sci-box b{color:#8a7b52;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase}",
    "body.fo-scb-on .fo-sci-box span{color:#463a20;font-family:Georgia,serif;font-style:italic;font-size:12.5px}",
    // tabs become a contents line in the book's own hand
    "html body.fo-scb-on #page .fo-sctab,html body.ftpskin.fo-scb-on #page .fo-sctab{background:transparent !important;border:0 !important;border-radius:0 !important;padding:7px 2px !important;margin-right:16px;font-family:Oswald,sans-serif !important;font-size:10px !important;letter-spacing:.18em;text-transform:uppercase;color:#8a7b52 !important;border-bottom:2px solid transparent !important;cursor:pointer}",
    "html body.fo-scb-on #page .fo-sctab.on{color:#8a4a21 !important;border-bottom-color:#C95532 !important}",
    // generic panels on the page (charts, ratings) join the paper
    "html body.ftpskin.fo-scb-on #page .panel,html body.fo-scb-on #page .panel{background:transparent !important;border:0 !important;box-shadow:none !important}",
    "html body.ftpskin.fo-scb-on #page .panel h4,html body.fo-scb-on #page .panel h4{background:transparent !important;color:#241d0e !important;border-top:3px double #241d0e;border-bottom:1px solid rgba(36,29,14,.65);font-family:Georgia,serif;padding:9px 4px}",
    // the stamp, pressed slightly askew at the top of the first innings page
    ".fo-scb-stamp{position:absolute;top:52px;right:16px;z-index:2;transform:rotate(-7deg);font-family:Oswald,sans-serif;font-weight:700;font-size:15px;letter-spacing:.26em;color:#c23b25;border:3px solid #c23b25;border-radius:5px;padding:5px 12px 4px;opacity:.72;pointer-events:none;mix-blend-mode:multiply}",
    "@media(max-width:760px){.fo-scb-stamp{font-size:12px;top:46px;right:6px}}",

    // ======================= THE DRESSING ROOM ==============================
    "#fo-drs-bg,#fo-drs-veil{display:none}",
    "body.fo-drs-on #fo-drs-bg{display:block;position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 42%;z-index:-2}",
    "body.fo-drs-on #fo-drs-veil{display:block;position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(9,8,6,.66),rgba(11,10,8,.38) 30%,rgba(9,8,6,.5) 66%,rgba(6,5,4,.78))}",
    // isolation makes body a stacking context, so the negative-z backdrop
    // paints above the body background instead of vanishing behind it
    "html body.ftpskin.fo-drs-on,html body.fo-drs-on{background:#0b0a07 !important;isolation:isolate}",
    "html body.fo-drs-on .wrap{background:transparent !important;box-shadow:none !important}",
    "html body.fo-drs-on #page{background:transparent !important}",
    // the fixture title hangs in the room's air (the skin paints it as navy
    // gradient text via background-clip, so the fill colour must be forced)
    "html body.fo-drs-on #page .fo-ord-hero .h-t{color:#fff !important;-webkit-text-fill-color:#fff !important;background:none !important;text-shadow:0 4px 22px rgba(0,0,0,.75)}",
    "html body.fo-drs-on #page .fo-ord-hero .h-v{color:#EBC271 !important;-webkit-text-fill-color:#EBC271 !important;background:none !important}",
    "html body.fo-drs-on #page .fo-ord-herosub,html body.fo-drs-on #page .fo-ord-herosub *{color:#d8c9a6 !important;-webkit-text-fill-color:#d8c9a6 !important;text-shadow:0 2px 10px rgba(0,0,0,.7)}",
    // panels become dark glass hanging in the room
    "html body.ftpskin.fo-drs-on #page .panel,html body.fo-drs-on #page .panel{background:rgba(9,14,24,.68) !important;border:1px solid rgba(126,158,208,.2) !important;border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.5);color:#dbe4f4;backdrop-filter:blur(3px)}",
    "html body.fo-drs-on #page .fo-ord-planv,html body.fo-drs-on #page .pv-xi,html body.fo-drs-on #page .pv-bench,html body.fo-drs-on #page .pv-toss,html body.fo-drs-on #page .fo-ord-cols,html body.fo-drs-on #page .fo-ord-mgrid,html body.fo-drs-on #page .fo-ord-cond{background:transparent !important;box-shadow:none !important}",
    "html body.ftpskin.fo-drs-on #page .panel h4,html body.fo-drs-on #page .panel h4{background:transparent !important;color:#EBC271 !important;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;border-bottom:1px solid rgba(126,158,208,.18)}",
    "html body.ftpskin.fo-drs-on #page .panel .pad,html body.fo-drs-on #page .panel .pad{background:transparent !important;color:#c6d2e6}",
    "html body.fo-drs-on #page .fo-j-gbox{background:rgba(7,13,24,.55) !important}",
    "body.fo-drs-on #page .small{color:#93a5c2 !important}",
    "body.fo-drs-on #page .fo-ord-vzh{color:#EBC271 !important}body.fo-drs-on #page .fo-ord-vzh span{color:#93a5c2 !important}",
    // batting order and bench: kit cards in the low light. The chips carry
    // heavyweight skin rules, so these are deliberately over-specified.
    "html body.ftpskin.fo-drs-on #page button.xc,html body.fo-drs-on #page button.xc{background:linear-gradient(180deg,rgba(22,32,52,.95),rgba(13,21,37,.95)) !important;border:1px solid rgba(126,158,208,.24) !important;color:#e7eefb !important;box-shadow:0 4px 12px rgba(0,0,0,.4)}",
    "html body.ftpskin.fo-drs-on #page button.xc .r1 b,html body.fo-drs-on #page button.xc .r1 b{color:#f2f6ff !important;-webkit-text-fill-color:#f2f6ff !important}",
    "html body.fo-drs-on #page button.xc .r1 u{color:#0d1526 !important;background:#EBC271 !important}",
    "html body.fo-drs-on #page button.xc .hd{color:#93a5c2 !important}",
    "html body.fo-drs-on #page button.xc .ov b{color:#EBC271 !important;-webkit-text-fill-color:#EBC271 !important}",
    "html body.fo-drs-on #page button.xc .fo-ord-tp{color:#d8c9a6 !important;background:rgba(235,194,113,.1) !important;border-color:rgba(235,194,113,.28) !important}",
    "html body.fo-drs-on #page button.xc.xc-dim{opacity:.72}",
    "html body.fo-drs-on #page button.xc .dh{color:#5a6d8d !important}",
    // the chalkboard: the Gaffer's fifty overs in chalk on slate green
    "html body.fo-drs-on #page .fo-ord-lanes{background:linear-gradient(178deg,#17251e,#101b15 70%) !important;border:7px solid #3d2e1e !important;border-radius:8px;padding:13px 12px;box-shadow:inset 0 0 40px rgba(0,0,0,.5),0 12px 30px rgba(0,0,0,.5)}",
    "body.fo-drs-on .fo-ord-lane .ln{color:#e6e9dd !important;font-family:Georgia,serif;font-style:italic}",
    "body.fo-drs-on .fo-ord-lane u{color:#e6e9dd !important}",
    "body.fo-drs-on .fo-ord-lane .lt i{background:rgba(230,233,221,.08) !important;border-color:rgba(230,233,221,.1) !important}",
    "body.fo-drs-on .fo-ord-lane .lt i.f{background:#e6e9dd !important;box-shadow:0 0 5px rgba(230,233,221,.4)}",
    "body.fo-drs-on .fo-ord-lane .lt i.pp{border-bottom:2px solid rgba(123,211,166,.4)}",
    "body.fo-drs-on .fo-ord-lane .lt i.dth{border-bottom:2px solid rgba(224,112,79,.45)}",
    "body.fo-drs-on .fo-ord-lane.lax em{color:#9aa895 !important;font-family:Oswald,sans-serif;letter-spacing:.16em}",
    // phone over-grid joins the board
    "html body.fo-drs-on #page .fo-ord-mgrid .mgc{background:rgba(230,233,221,.07) !important;border-color:rgba(230,233,221,.14) !important;color:#c9d2c4 !important}",
    "body.fo-drs-on #page .fo-ord-mgrid .mg-hint{color:#9aa895 !important}",
    // the toss: a worn gold coin for the call, brass plates for the choice
    "html body.fo-drs-on #page button[data-fo-toss^='call']{width:58px;height:58px;border-radius:50% !important;border:0 !important;background:radial-gradient(circle at 35% 28%,#f6dd8d,#caa34e 55%,#8a6d22 95%) !important;color:#3c2f0d !important;font:700 10px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.08em;box-shadow:inset 0 -3px 7px rgba(0,0,0,.35),inset 0 2px 3px rgba(255,255,255,.5),0 5px 12px rgba(0,0,0,.55);opacity:.55;transition:.15s}",
    "html body.ftpskin.fo-drs-on #page button[data-fo-toss^='call'].on,html body.fo-drs-on #page button[data-fo-toss^='call'].on{opacity:1;outline:2px solid #EBC271;outline-offset:3px;transform:scale(1.06);background:radial-gradient(circle at 35% 28%,#f6dd8d,#caa34e 55%,#8a6d22 95%) !important;color:#3c2f0d !important}",
    "html body.fo-drs-on #page button[data-fo-toss^='dec']{border:1px solid rgba(235,194,113,.5) !important;border-radius:8px !important;background:linear-gradient(180deg,rgba(58,46,26,.9),rgba(40,32,18,.9)) !important;color:#EBC271 !important;font:600 10.5px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.12em;padding:10px 16px !important;opacity:.55}",
    "html body.ftpskin.fo-drs-on #page button[data-fo-toss^='dec'].on,html body.fo-drs-on #page button[data-fo-toss^='dec'].on{opacity:1;box-shadow:0 0 0 2px rgba(235,194,113,.35),0 4px 10px rgba(0,0,0,.4);background:linear-gradient(180deg,rgba(74,58,30,.95),rgba(52,40,20,.95)) !important;color:#F5C566 !important}",
    "body.fo-drs-on .fo-ord-toss .tl{color:#93a5c2 !important;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase}",
    // bowler cards under the board
    "html body.ftpskin.fo-drs-on #page .fo-ord-bws button.bw,html body.fo-drs-on #page .fo-ord-bws button.bw{background:rgba(16,26,44,.92) !important;border:1px solid rgba(126,158,208,.22) !important;color:#e7eefb !important}",
    "html body.fo-drs-on #page .fo-ord-bws button.bw b{color:#f2f6ff !important;-webkit-text-fill-color:#f2f6ff !important}",
    "html body.fo-drs-on #page .fo-ord-bws button.bw .bt{color:#93a5c2 !important}",
    "html body.fo-drs-on #page .fo-ord-bws button.bw .ov b{color:#EBC271 !important;-webkit-text-fill-color:#EBC271 !important}",
    // tables inside orders panels lose the skin's white stripes
    "html body.ftpskin.fo-drs-on #page tr:nth-child(even) td{background:transparent !important}",
    "html body.fo-drs-on #page td,html body.fo-drs-on #page th{color:#c6d2e6}"
  ].join("\n");
  // the skin's stylesheet is inlined after the scripts, so equal-specificity
  // ties would go against us from <head>. Living at the end of <body> makes
  // this sheet the last word instead.
  function lastWord() { try { (document.body || document.head).appendChild(s); } catch (e) { document.head.appendChild(s); } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lastWord);
  else lastWord();
})();

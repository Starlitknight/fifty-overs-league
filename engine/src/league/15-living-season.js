/* ============================================================================
   THE CAREER RECORD — the milestone engine, and the career panel it paints on
   a player's page. One module, and one rule it obeys:

     EVERY FACT IS DERIVED FROM App.results, DETERMINISTICALLY.

   Matches here are played by humans who are sometimes online and bots that
   never are, so nothing in this file requires anyone to be at the keyboard
   when a ball is bowled: a career line and its milestones are recomputed from
   the record on every read. Two clients that saw none of the same rounds
   render the same career.

   This module used to carry the two rooms that read from it as well — The Desk
   (the morning's post: presser, promoter, board, rivalry, digest) and The
   Season So Far (awards night). Both rooms are retired, so what stayed is the
   record itself plus the style sheet the surviving rooms borrow their pills
   from.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foLivingSeason) return; window.__foLivingSeason = 1;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(x) { return typeof x === "number" && isFinite(x) ? x : 0; }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function seasonNoOf(r) { return r.seasonNo || (App.seasonNo || 1); }
  function ordinal(n) { var v = n % 100; if (v >= 11 && v <= 13) return n + "th"; return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"); }

  // ---------------------------------------------------------------------------
  // The record book: one pass over every result, memoized on results.length.
  // Career lines per player plus the milestone stream, oldest first.
  // ---------------------------------------------------------------------------
  var _bk = null, _bkN = -1, _bkS = -1;
  function book() {
    var res = App.results || [];
    if (_bk && _bkN === res.length && _bkS === (App.seasonNo || 1)) return _bk;
    var car = {}, events = [];
    var MRUNS = [500, 1000, 2500, 5000], MWK = [25, 50, 100, 200], MCAP = [10, 25, 50, 100];
    function C(nm) {
      return car[nm] || (car[nm] = { m: 0, runs: 0, bf: 0, outs: 0, hs: 0, hsb: 0, fifty: 0, hundred: 0, wk: 0, cb: 0, cr: 0, bw: 0, br: 1e9, ff: 0, team: "" });
    }
    function fire(nm, r, txt, big) { events.push({ n: nm, ix: r.ix, s: seasonNoOf(r), rd: r.round, date: r.date, txt: txt, big: !!big, team: C(nm).team }); }
    res.forEach(function (r) {
      if (!r || !r.innings || r.comp === "youth" || r.comp === "friendly") return;
      var seen = {};
      r.innings.forEach(function (inn) {
        if (!inn) return;
        var fieldTeam = inn.batTeam === r.home ? r.away : r.home;
        (inn.bat || []).forEach(function (b) {
          if (!b || !b.p || !(b.b > 0 || b.out)) return;
          var nm = b.p.name, c = C(nm); c.team = inn.batTeam; seen[nm] = 1;
          var pre = c.runs;
          c.runs += num(b.r); c.bf += num(b.b); if (b.out) c.outs++;
          if (b.r > c.hs) { c.hs = b.r; c.hsb = b.b; }
          if (b.r >= 100) { c.hundred++; if (c.hundred === 1) fire(nm, r, "a maiden century — " + b.r + " off " + b.b, 1); else fire(nm, r, "century no. " + c.hundred + " — " + b.r + " off " + b.b, 1); }
          else if (b.r >= 50) { c.fifty++; if (c.fifty === 1) fire(nm, r, "a first career fifty — " + b.r + " off " + b.b); }
          MRUNS.forEach(function (t) { if (pre < t && c.runs >= t) fire(nm, r, t.toLocaleString() + " career runs"); });
        });
        for (var k in (inn.bowlers || {})) {
          var br = inn.bowlers[k]; if (!br) continue;
          var c2 = C(k); c2.team = fieldTeam; seen[k] = 1;
          var preW = c2.wk;
          c2.wk += num(br.w); c2.cb += num(br.b); c2.cr += num(br.r);
          if (br.w > c2.bw || (br.w === c2.bw && br.r < c2.br)) { c2.bw = br.w; c2.br = br.r; }
          if (br.w >= 5) { c2.ff++; fire(k, r, br.w + "/" + br.r + (c2.ff === 1 ? " — a first five-for" : " — five-for no. " + c2.ff), 1); }
          MWK.forEach(function (t) { if (preW < t && c2.wk >= t) fire(k, r, ordinal(t) + " career wicket", t >= 100); });
        }
      });
      for (var nm2 in seen) {
        var c3 = C(nm2), pre2 = c3.m; c3.m++;
        MCAP.forEach(function (t) { if (pre2 < t && c3.m >= t) fire(nm2, r, t + " appearances for " + (c3.team || "the club")); });
      }
    });
    _bk = { car: car, events: events }; _bkN = res.length; _bkS = App.seasonNo || 1;
    return _bk;
  }

  // ---------------------------------------------------------------------------
  // Player pages: the career the record book remembers. The dossier stage
  // rebuilds itself after render, so a one-shot append gets relocated or
  // dropped — the page observer re-ensures the panel instead.
  // ---------------------------------------------------------------------------
  function careerHTML(nm) {
    // THE UMPIRE'S BOOK OUTRANKS THE LOCAL RECORD. A claimed club's rounds
    // are played on the server and never land in App.results - but the
    // adopted squad carries each man's served career, refreshed after every
    // round. When the world has written a book for this man, read his.
    try {
      var sp = null, t9 = userTeam();
      ((t9 && t9.players) || []).concat((t9 && t9.youth) || []).forEach(function (p9) {
        if (p9 && p9.name === nm && p9.career && p9.career.m) sp = p9;
      });
      if (sp) {
        var sc = sp.career;
        var kvS = function (k, v) { return "<div class='fo-ls-ck'><span>" + k + "</span><b>" + v + "</b></div>"; };
        var srS = sc.balls ? (100 * (sc.runs || 0) / sc.balls).toFixed(1) : "&ndash;";
        var ecS = sc.ovb ? ((sc.conc || 0) / Math.max(1, sc.ovb / 6)).toFixed(2) : null;
        return "<div class='panel fo-ls-career'><h4>Career record</h4><div class='pad'>" +
          "<div class='fo-ls-crow'>" +
          kvS("Matches", sc.m) + kvS("Runs", sc.runs || 0) +
          kvS("Strike rate", srS) + kvS("Best", sc.hs || 0) +
          (sc.ovb ? kvS("Wickets", sc.wkts || 0) +
            kvS("Best bowling", sc.bb ? sc.bb.w + "/" + sc.bb.r : "&ndash;") +
            kvS("Economy", ecS) + kvS("Overs", Math.floor(sc.ovb / 6)) : "") +
          "</div>" +
          (sp.intl && sp.intl.m ? "<div class='fo-ls-mile'><span class='fo-ls-mh'>For his country</span>" +
            "<div class='fo-ls-line'><b>" + sp.intl.m + " cap" + (sp.intl.m === 1 ? "" : "s") + "</b> &mdash; " +
            (sp.intl.runs || 0) + " runs, best " + (sp.intl.hs || 0) +
            ((sp.intl.wkts | 0) ? ", " + sp.intl.wkts + " wickets" : "") + "</div></div>" : "") +
          "</div></div>";
      }
    } catch (eSv) {}
    var bk = book(), c = bk.car[nm];
    if (!c || !c.m) return "";
    var evs = bk.events.filter(function (x) { return x.n === nm; }).slice(-8).reverse();
    var kv = function (k, v) { return "<div class='fo-ls-ck'><span>" + k + "</span><b>" + v + "</b></div>"; };
    return "<div class='panel fo-ls-career'><h4>Career record</h4><div class='pad'>" +
      "<div class='fo-ls-crow'>" +
      kv("Matches", c.m) + kv("Runs", c.runs) +
      kv("Average", c.outs ? (c.runs / c.outs).toFixed(1) : "&ndash;") +
      kv("Strike rate", c.bf ? (100 * c.runs / c.bf).toFixed(1) : "&ndash;") +
      kv("Best", c.hs + (c.hsb ? " (" + c.hsb + ")" : "")) +
      kv("100s / 50s", c.hundred + " / " + c.fifty) +
      (c.cb ? kv("Wickets", c.wk) + kv("Best bowling", c.bw + "/" + (c.br === 1e9 ? 0 : c.br)) + kv("Economy", (c.cr / Math.max(1, c.cb / 6)).toFixed(2)) : "") +
      "</div>" +
      (evs.length ? "<div class='fo-ls-mile'><span class='fo-ls-mh'>Milestones</span>" + evs.map(function (x) {
        return "<div class='fo-ls-line'><b>S" + x.s + (x.rd != null ? " R" + (x.rd + 1) : "") + "</b> &mdash; " + E(x.txt) + "</div>";
      }).join("") + "</div>" : "") +
      "</div></div>";
  }
  function ensureCareer() {
    if ((location.hash || "").split("?")[0] !== "#/player") return;
    var page = document.getElementById("page"); if (!page) return;
    if (page.querySelector(".fo-ls-career")) return;
    var mH = /[?&]n=([^&]+)/.exec(location.hash || ""); if (!mH) return;
    var nm; try { nm = decodeURIComponent(mH[1]); } catch (e) { return; }
    if (!ready()) return;
    var html = careerHTML(nm); if (!html) return;
    foLsCss();
    var host = document.createElement("div"); host.innerHTML = html;
    var col = page.querySelector("#fo-pstage .fo-ps-r") || page;
    col.appendChild(host.firstChild);
  }
  try {
    new MutationObserver(function () { try { ensureCareer(); } catch (e) {} })
      .observe(document.getElementById("page") || document.body, { childList: true, subtree: true });
  } catch (eOb) {}
  window.addEventListener("hashchange", function () { setTimeout(function () { try { ensureCareer(); } catch (e) {} }, 250); });

  // ---------------------------------------------------------------------------
  // Skin
  // ---------------------------------------------------------------------------
  // The nets and the honours board borrow this sheet's pills and its page
  // furniture, so it has to be reachable from outside: landing straight on one
  // of those rooms used to paint bare underlined links where the pills should
  // be. The rules for the two retired rooms are left in place because the
  // surviving rooms took their eyebrow, their headline and their action row.
  function foLsCss() {
    if (document.getElementById("fo-ls-css")) return;
    var s = document.createElement("style"); s.id = "fo-ls-css";
    s.textContent = [
      // ---- the desk: the morning's post in the club office ----
      "html body.fo-desk-on{background:#E9E4D8 !important}",
      "html body.fo-desk-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-desk-on #page{padding:0 !important;margin:0 !important;background:#0d0a06 !important}",
      "html body.fo-cer-on #page{padding:0 !important;margin:0 !important;background:#070d18 !important}",
      ".fo-desk{position:relative;min-height:100vh;color:#eaf0fb;padding:72px 18px 40px;isolation:isolate}",
      ".fo-desk-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 38%;z-index:-2}",
      ".fo-desk-veil{position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(13,9,4,.22),rgba(15,11,6,.10) 34%,rgba(13,9,5,.14) 68%,rgba(9,6,3,.30))}",
      ".fo-desk-in{max-width:1120px;margin:0 auto}",
      ".fo-desk-h1{font-family:Manrope,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(40px,6.4vw,72px);line-height:.9;margin:0 0 8px;color:#fff;text-shadow:0 4px 26px rgba(0,0,0,.7)}",
      ".fo-desk-tag{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:14.5px;color:#d8c9a6;margin:0 0 22px;text-shadow:0 2px 10px rgba(0,0,0,.7)}",
      ".fo-desk-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#C9571F;box-shadow:0 0 8px rgba(201,85,50,.9);vertical-align:2px}",
      ".fo-ls-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:14px 0 24px;align-items:start}",
      "@media(max-width:1080px){.fo-ls-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}",
      "@media(max-width:700px){.fo-ls-strip{grid-template-columns:minmax(0,1fr)}}",
      ".fo-ls-card{border-radius:14px;padding:0}",
      ".fo-ls-card .fo-card-h2row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px 0}",
      ".fo-ls-card .fo-card-h2{font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#E8B96A}",
      ".fo-ls-card .fo-card-b{font-size:12.5px;line-height:1.55;padding:10px 16px 15px}",
      ".fo-ls-card .fo-morelink{font-size:11px;color:#E8B96A !important;text-decoration:none}",
      ".fo-ls-k{font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#7d8fad}.fo-ls-k b{color:#E8B96A}",
      ".fo-ls-line{margin:0 0 7px;color:#cfdaec}.fo-ls-line:last-child{margin-bottom:0}",
      // the last meeting is a match you played; it reads as part of the line
      // and only the chevron tells you it opens
      ".fo-ls-line a.fo-ls-open{color:inherit;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.28)}",
      ".fo-ls-line a.fo-ls-open:hover{border-bottom-color:currentColor}",
      ".pap .fo-ls-line a.fo-ls-open{border-bottom-color:rgba(36,29,14,.3)}",
      ".fo-ls-line b{color:#f2f6ff}.fo-ls-line span{color:#7d8fad;font-size:11px}.fo-ls-line i{font-style:normal;margin-right:4px}",
      ".fo-ls-dim{color:#7d8fad}.fo-ls-move b{color:#E8B96A}",
      ".fo-ls-fine{font-size:11px;color:#7d8fad}",
      ".fo-ls-quote,.fo-ls-q{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:14.5px;line-height:1.55;color:#e7eefb}",
      ".fo-ls-h2h{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}",
      ".fo-ls-h2h b{font-family:Manrope,sans-serif;font-size:26px;color:#E8B96A}.fo-ls-h2h span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#7d8fad}.fo-ls-h2h i{color:#42536e;font-style:normal}",
      ".fo-ls-goal{display:flex;gap:9px;align-items:flex-start;margin-bottom:8px}",
      ".fo-ls-goal i{font-style:normal;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(126,158,208,.4);color:#93a5c2;font-size:10px;line-height:15px;text-align:center;flex:none;margin-top:1px}",
      ".fo-ls-goal.ok i{background:#2f9d78;border-color:#2f9d78;color:#fff}",
      ".fo-ls-goal b{display:block;font-size:12.5px;color:#f2f6ff}.fo-ls-goal span{font-size:11px;color:#7d8fad}",
      ".fo-ls-wwon i{color:#5BD0A6}.fo-ls-wlost i{color:#e0704f}.fo-ls-wwon b{color:#5BD0A6}.fo-ls-wlost b{color:#e0704f}",
      ".fo-ls-offer{margin-top:9px;padding:10px 12px;border:1px dashed rgba(235,194,113,.4);border-radius:10px;background:rgba(235,194,113,.06)}",
      // ---- paper: everything the post brought is a physical thing ----
      ".fo-ls-card.pap{background:linear-gradient(172deg,#f8f1de,#f0e6cb 55%,#e9ddbe);color:#3a3020;border:0;border-radius:3px;box-shadow:0 16px 34px rgba(0,0,0,.55),0 2px 7px rgba(0,0,0,.35)}",
      ".fo-ls-strip>.pap:nth-child(odd){transform:rotate(-.5deg)}",
      ".fo-ls-strip>.pap:nth-child(even){transform:rotate(.45deg)}",
      ".fo-ls-strip>.fo-ls-card{transition:transform .22s ease,box-shadow .22s ease}",
      ".fo-ls-strip>.fo-ls-card:hover{transform:rotate(0) translateY(-3px);box-shadow:0 22px 44px rgba(0,0,0,.6),0 3px 9px rgba(0,0,0,.35)}",
      ".pap .fo-card-h2{color:#7c5f1d}.pap .fo-ls-k{color:#93835c}.pap .fo-ls-k b{color:#7c5f1d}",
      ".pap .fo-ls-line{color:#453a22}.pap .fo-ls-line b{color:#241d0e}.pap .fo-ls-line span{color:#93835c}",
      ".pap .fo-ls-dim{color:#93835c}.pap .fo-ls-fine{color:#93835c}.pap .fo-ls-move b{color:#8a4a21}",
      ".pap .fo-ls-quote,.pap .fo-ls-q{color:#241d0e}",
      ".pap .fo-ls-goal i{border-color:#b7a878;color:#93835c}.pap .fo-ls-goal.ok i{background:#2f7a52;border-color:#2f7a52;color:#f8f1de}",
      ".pap .fo-ls-goal b{color:#241d0e}.pap .fo-ls-goal span{color:#93835c}",
      ".pap .fo-ls-wwon i,.pap .fo-ls-wwon b{color:#1f7a52}.pap .fo-ls-wlost i,.pap .fo-ls-wlost b{color:#a13a20}",
      ".pap .fo-morelink{color:#8a4a21 !important}",
      "html body .pap .fo-ls-btn.ghost{color:#8a4a21 !important;box-shadow:inset 0 0 0 1.5px #b56a3f}",
      "html body .pap .fo-ls-btn.ghost:hover{background:rgba(181,106,63,.12) !important}",
      // the telegram: rules above and below, spaced capitals, a wire stamp
      ".tele .fo-card-h2row{border-bottom:2px solid #241d0e;padding-bottom:8px}",
      ".tele .fo-card-h2{color:#241d0e;font-size:11px;letter-spacing:.3em}",
      ".fo-tele-sub{font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.24em;color:#93835c;padding:7px 16px 0}",
      ".tele .fo-card-b{border-top:1px solid rgba(36,29,14,.25);margin-top:7px}",
      // the newspaper clipping: torn top edge, masthead serif, a big pull quote
      ".news{clip-path:polygon(0 7px,3% 2px,7% 8px,12% 1px,18% 7px,24% 2px,31% 8px,38% 3px,45% 7px,52% 1px,59% 8px,66% 2px,73% 7px,80% 3px,87% 8px,93% 2px,97% 7px,100% 3px,100% 100%,0 100%)}",
      ".news .fo-card-h2{font-family:Fraunces,Georgia,serif;font-size:15px;font-weight:700;text-transform:none;letter-spacing:.02em;color:#241d0e;padding-top:4px}",
      ".news .fo-card-h2row{border-bottom:1px solid #241d0e;padding-bottom:6px;box-shadow:0 3px 0 -1px rgba(36,29,14,.35)}",
      ".news .fo-ls-q{position:relative;padding-left:20px;font-size:15px}",
      ".news .fo-ls-q:before{content:'\\201C';position:absolute;left:0;top:-4px;font-family:Fraunces,Georgia,serif;font-size:34px;color:#b7a878}",
      // the board letter: letterhead, minutes, a signature and the seal
      ".fo-let-head{text-align:center;padding:15px 16px 0}",
      ".fo-let-head i{display:block;font-family:Fraunces,Georgia,serif;font-style:normal;font-size:15px;color:#241d0e}",
      ".fo-let-head b{display:block;font-family:Manrope,sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.26em;color:#93835c;margin-top:3px;padding-bottom:8px;border-bottom:1px solid rgba(36,29,14,.3)}",
      ".letter{position:relative}",
      ".letter .fo-card-h2row{padding-top:9px}",
      ".fo-let-sign{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:14px;color:#241d0e;text-align:right;margin-top:10px;padding-right:36px}",
      ".letter:after{content:'';position:absolute;right:12px;bottom:13px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#c4573a,#8e2f18 70%);box-shadow:0 1px 3px rgba(0,0,0,.4);opacity:.9}",
      // the almanack page: italic sub-head, dotted rules between entries
      ".fo-alma-sub{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:11.5px;color:#93835c;padding:3px 16px 0}",
      ".alma .fo-ls-line{border-bottom:1px dotted rgba(36,29,14,.3);padding-bottom:6px}",
      ".alma .fo-ls-line:last-child{border-bottom:0;padding-bottom:0}",
      // the fixture poster: dark bill among the papers, gold frame, big names
      ".fo-ls-card.poster{background:linear-gradient(168deg,#FDF8EC,#F5EDD8 65%);color:#1E2736;border:1px solid rgba(176,132,9,.55);outline:1px solid rgba(176,132,9,.28);outline-offset:-6px;border-radius:4px;box-shadow:0 12px 26px rgba(60,50,20,.18)}",
      ".poster .fo-card-h2row{justify-content:center;gap:8px}",
      ".poster .fo-card-h2{letter-spacing:.3em}",
      ".poster .fo-ls-k{color:#8A8272}",
      ".fo-pos-names{text-align:center;font-family:Fraunces,Georgia,serif;font-size:16px;color:#1E2736;margin:6px 0 4px}",
      ".fo-pos-names b{display:block;font-size:17px;letter-spacing:.02em}",
      ".fo-pos-names i{display:block;font-style:normal;color:#B08409;font-size:13px;margin:2px 0}",
      ".poster .fo-ls-h2h{justify-content:center}",
      ".poster .fo-ls-line{text-align:center;color:#4A5364}.poster .fo-ls-line b{color:#8A6A1F}",
      // the promoter's ticket: dark stock, gold foil, a perforated stub
      ".fo-ls-card.tick{position:relative;background:linear-gradient(170deg,#FBF3DC,#F3E6C2 70%);color:#4A3B18;border:1px solid rgba(176,132,9,.5);border-radius:6px;box-shadow:0 12px 26px rgba(60,50,20,.18)}",
      ".tick:before,.tick:after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#E9E4D8;top:50%;margin-top:-8px;box-shadow:inset 0 0 0 1px rgba(176,132,9,.35)}",
      ".tick:before{left:-8px}.tick:after{right:-8px}",
      ".tick .fo-card-h2{color:#8A6A1F;letter-spacing:.26em}",
      ".tick .fo-ls-line{color:#4A3B18}.tick .fo-ls-line b{color:#8A5A10}.tick .fo-ls-line span{color:#8A8060}",
      ".tick .fo-ls-fine{color:#8A8060}",
      ".fo-tick-stub{border-top:1px dashed rgba(176,132,9,.45);margin:0 10px;padding:8px 6px 10px;text-align:center;font-family:Manrope,sans-serif;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#8A8060}",
      "html body.ftpskin .fo-ls-btn,html body .fo-ls-btn{display:inline-flex;align-items:center;min-height:44px;margin-top:8px;border:0 !important;border-radius:999px !important;padding:0 19px !important;background:#C9571F !important;color:#FFFEFC !important;font:600 11px Manrope,sans-serif !important;text-transform:uppercase;letter-spacing:.14em;cursor:pointer;text-decoration:none}",
      "html body .fo-ls-btn:hover{background:#B44A22 !important;color:#FFFEFC !important}",
      "html body .fo-ls-btn.ghost,html body #page .fo-ls-btn.ghost{background:transparent !important;color:#E8B96A !important;box-shadow:inset 0 0 0 1.5px rgba(235,194,113,.55)}",
      "html body .fo-ls-btn.ghost:hover{background:rgba(235,194,113,.1) !important}",
      ".fo-ls-pressbtns{display:flex;gap:8px;flex-wrap:wrap}",
      // career panel on player pages (the dossier below the hero is dark)
      ".fo-ls-career.fo-ls-career{background:rgba(14,26,48,.62);border:1px solid rgba(126,158,208,.2);border-radius:14px;margin:14px 0;overflow:hidden}",
      ".fo-ls-career h4{margin:0;padding:12px 16px 0;font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#E8B96A;background:transparent;border:0}",
      ".fo-ls-career .pad{padding:10px 16px 14px;color:#cfdaec}",
      ".fo-ls-crow{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px;margin-bottom:4px}",
      ".fo-ls-ck span{display:block;font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.13em;color:#7d8fad}",
      ".fo-ls-ck b{font-size:15px;color:#f2f6ff;font-variant-numeric:tabular-nums}",
      ".fo-ls-mile{margin-top:10px;border-top:1px solid rgba(126,158,208,.18);padding-top:9px}",
      ".fo-ls-mh{display:block;font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#7d8fad;margin-bottom:6px}",
      // awards night: floodlights over the arches, gold type, no chrome
      "html body.fo-cer-on{background:#070d18 !important}",
      "html body.fo-cer-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      ".fo-cer{position:relative;min-height:100vh;color:#eaf0fb;padding:74px 18px 40px;isolation:isolate}",
      ".fo-cer-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%;z-index:-2}",
      ".fo-cer-veil{position:fixed;inset:0;z-index:-1;background:radial-gradient(80% 50% at 50% 0%,rgba(235,194,113,.10),transparent 60%),linear-gradient(180deg,rgba(6,10,20,.34),rgba(7,12,24,.20) 36%,rgba(5,9,18,.30) 72%,rgba(4,7,14,.48))}",
      ".fo-cer-in{max-width:760px;margin:0 auto}",
      ".fo-cer-face{display:block;width:54px;height:54px;border-radius:50%;overflow:hidden;flex:none;border:2px solid rgba(235,194,113,.7);box-shadow:0 5px 16px rgba(0,0,0,.55);background:#0d1526}",
      ".fo-cer-face img{width:100%;height:100%;object-fit:cover;object-position:50% 12%}",
      ".fo-cer-eyebrow{font-family:Manrope,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.3em;color:#E8B96A;margin-bottom:10px}",
      ".fo-cer h1{font-family:Manrope,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(44px,8vw,84px);line-height:.9;margin:0 0 26px;color:#fff}",
      ".fo-cer-podium{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:28px}",
      ".fo-cer-step{position:relative;background:rgba(10,19,36,.82);border:1px solid rgba(126,158,208,.22);border-top:3px solid #7d8fad;border-radius:12px;padding:12px 16px;min-width:150px;backdrop-filter:blur(3px)}",
      ".fo-cer-step b{display:block;font-family:Manrope,sans-serif;font-size:22px;color:#E8B96A}",
      ".fo-cer-step span{display:block;font-weight:700;margin:2px 0}.fo-cer-step em{font-style:normal;font-size:11px;color:#93a5c2}",
      ".fo-cer-step.s1{border-top-color:#E8B96A;border-color:rgba(235,194,113,.6);box-shadow:0 8px 30px rgba(235,194,113,.16)}",
      ".fo-cer-step.s2{border-top-color:#c8d0dc}.fo-cer-step.s3{border-top-color:#c98a5a}",
      ".fo-cer-step.me{outline:2px solid #C9571F}",
      ".fo-cer-mypos{align-self:center;font-family:Fraunces,Georgia,serif;font-style:normal;color:#93a5c2}",
      ".fo-cer-aws{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:26px}",
      ".fo-cer-aw{display:flex;gap:12px;align-items:center;background:rgba(10,19,36,.78);border:1px solid rgba(126,158,208,.18);border-radius:12px;padding:13px 15px;backdrop-filter:blur(3px)}",
      ".fo-cer-aw i{font-style:normal;font-size:24px;flex:none}",
      ".fo-cer-aw span{display:block;font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#E8B96A}",
      ".fo-cer-aw b{display:block;font-size:16px;margin:1px 0}.fo-cer-aw em{font-style:normal;font-size:11.5px;color:#93a5c2}",
      ".fo-cer-def{background:linear-gradient(135deg,rgba(201,85,50,.16),rgba(14,26,48,.6));border:1px solid rgba(201,85,50,.35);border-radius:12px;padding:15px 17px;margin-bottom:26px}",
      ".fo-cer-def span{display:block;font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#e8a08a;margin-bottom:4px}",
      ".fo-cer-def b{display:block;font-size:15px;margin-bottom:6px}",
      "html body #page .fo-cer-def a{color:#E8B96A !important;font-size:12px;text-decoration:none}",
      ".fo-cer-goals{background:rgba(14,26,48,.55);border:1px solid rgba(126,158,208,.18);border-radius:12px;padding:15px 17px;margin-bottom:26px}",
      ".fo-cer-goals>span{display:block;font-family:Manrope,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#E8B96A;margin-bottom:9px}",
      ".fo-cer-goals .fo-ls-goal b{color:#eaf0fb}.fo-cer-goals .fo-ls-goal span{color:#93a5c2}",
      ".fo-cer-goals .fo-ls-goal i{border-color:rgba(126,158,208,.4);color:#93a5c2}",
      ".fo-cer-actions{display:flex;gap:10px;flex-wrap:wrap}"
    ].join("");
    document.head.appendChild(s);
  }
  // The nets and the club ledger borrow this sheet's pill buttons. Landing
  // straight on one of those rooms - which the menu now makes easy - used to
  // paint bare underlined links where the pills should be, because nothing
  // had brought the sheet onto the page yet.
  window.foLsCss = foLsCss;
})();

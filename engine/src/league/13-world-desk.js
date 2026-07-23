// ===========================================================================
//  THE WORLD DESK (#/wire) — the Living World, made visible
//
//  A broadcast command-centre for the persistent, deterministic world: a hero
//  over the world map, the reigning King, the Champions Cup bracket with real
//  scorelines, the world news feed ("the Wire") with filter tabs, featured
//  fixtures, a global world table, the gallery of nation bosses, and the Hall
//  of Champions. It reads a real, engine-played season baked into the page as
//  window.FO_WORLD_SNAPSHOT (see tools/build-world-snapshot.mjs). Self-contained:
//  its own styles, its own escaping. When the live server tick lands, this same
//  view reads today's world instead of a season snapshot.
// ===========================================================================
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function snap() { try { return window.FO_WORLD_SNAPSHOT || null; } catch (e) { return null; } }
  // art resolver: same rule the league layer uses, computed locally so the desk
  // stays independent of the shared closure
  var ART = (location.pathname.indexOf("/client/") !== -1) ? "art/" : (location.pathname.indexOf("/next/") !== -1 ? "../client/art/" : "client/art/");
  function boss(code) { return ART + "circuit/boss-" + code + ".webp"; }

  // a stable per-nation hue for the little code chips (crest stand-ins)
  function hue(code) { var h = 0, i; for (i = 0; i < (code || "").length; i++) h = (h * 31 + code.charCodeAt(i)) % 360; return h; }
  function chip(code) {
    if (!code) return "<span class='fo-wd-chip' style='--h:210'>&middot;&middot;</span>";
    if (code === "thorne") return "<span class='fo-wd-chip king'>&#9819;</span>";
    return "<span class='fo-wd-chip' style='--h:" + hue(code) + "'>" + E(code.slice(0, 3).toUpperCase()) + "</span>";
  }

  // category glyphs for the Wire
  var GLYPH = {
    upset: "<svg viewBox='0 0 24 24'><path d='M13 2 4 14h6l-1 8 9-12h-6z'/></svg>",
    cup: "<svg viewBox='0 0 24 24'><path d='M6 4h12v3a6 6 0 0 1-12 0zM9 15h6l1 5H8zM4 5h2v2a3 3 0 0 1-2-2zm16 0h-2v2a3 3 0 0 0 2-2z'/></svg>",
    transfer: "<svg viewBox='0 0 24 24'><path d='M4 8h12l-3-3 1.4-1.4L20 9l-5.6 5.4L13 13l3-3H4zm16 8H8l3 3-1.4 1.4L4 15l5.6-5.4L11 11l-3 3h12z'/></svg>",
    retirement: "<svg viewBox='0 0 24 24'><path d='M5 3h2v18H5zM8 4h11l-2 4 2 4H8z'/></svg>",
    league: "<svg viewBox='0 0 24 24'><path d='M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z'/></svg>"
  };
  var CAT = ["all", "upset", "cup", "transfer", "retirement"];
  var CATLBL = { all: "All", upset: "Upsets", cup: "Cup", transfer: "Transfers", retirement: "Retirements", league: "League" };

  // ---- panels --------------------------------------------------------------
  function hero(w) {
    var st = w.status || {}, k = w.king || {};
    return "" +
      "<section class='fo-wd-topband'>" +
      "  <div class='fo-wd-hero' style='background-image:linear-gradient(90deg,rgba(8,13,26,.94) 30%,rgba(8,13,26,.55) 70%,rgba(8,13,26,.82)),url(" + ART + "circuit/world.webp)'>" +
      "    <div class='fo-wd-kick'>THE FIFTY OVERS WORLD</div>" +
      "    <h1>THE WIRE</h1>" +
      "    <p class='fo-wd-sub'>One living world of " + (st.nations || 19) + " nations. Every result below was played, ball by ball, through the real engine &mdash; and Reggie Thorne still sits on the throne.</p>" +
      "    <a class='fo-wd-back' href='#/circuit'>&#8249;&nbsp; Back to your club</a>" +
      "  </div>" +
      "  <div class='fo-wd-status'>" +
      "    <div class='fo-wd-cap'>WORLD STATUS</div>" +
      "    <div class='fo-wd-stats'>" +
      statBox("&#9862;", st.nations || 19, "Nations") +
      statBox("&#9873;", st.leagues || 19, "Leagues") +
      statBox("&#9819;", st.cups || 1, "Champions Cup") +
      "    </div>" +
      "  </div>" +
      "  <div class='fo-wd-king'>" +
      "    <img src='" + ART + "thorne.png' alt='Reggie Thorne' class='fo-wd-kingimg'>" +
      "    <div class='fo-wd-kingtx'>" +
      "      <div class='fo-wd-cap gold'>THE KING</div>" +
      "      <div class='fo-wd-kingnm'>" + E(k.name || "Reggie Thorne") + "</div>" +
      "      <div class='fo-wd-kingrole'>REIGNING CHAMPION</div>" +
      "      <div class='fo-wd-kingsea'><b>" + (k.seasons || 1) + "</b> season" + ((k.seasons || 1) === 1 ? "" : "s") + " unbeaten</div>" +
      "    </div>" +
      "  </div>" +
      "</section>";
  }
  function statBox(gl, n, lbl) { return "<div class='fo-wd-stat'><span class='g'>" + gl + "</span><b>" + E(n) + "</b><i>" + E(lbl) + "</i></div>"; }

  function tieCard(t, opts) {
    if (!t) return "<div class='fo-wd-tie empty'>&mdash;</div>";
    opts = opts || {};
    var sc = function (name, score, winner) {
      return "<div class='fo-wd-side" + (winner ? " won" : "") + "'>" + chip(name.code) +
        "<span class='nm'>" + E(name.n) + "</span>" +
        (score ? "<span class='sc'>" + E(score) + "</span>" : (winner ? "<span class='sc tick'>&#10003;</span>" : "")) + "</div>";
    };
    return "<div class='fo-wd-tie" + (opts.big ? " big" : "") + "'>" +
      sc({ n: t.win, code: t.winCode }, t.winScore, true) +
      sc({ n: t.lose, code: t.loseCode }, t.loseScore, false) +
      "</div>";
  }

  function cupPanel(w) {
    var c = w.cup, b = c.bracket || {};
    var col = function (lbl, ties, big) { return "<div class='fo-wd-round'><h5>" + lbl + "</h5>" + (ties || []).map(function (t) { return tieCard(t, { big: big }); }).join("") + "</div>"; };
    return "<section class='fo-wd-panel fo-wd-cup'>" +
      "<header class='fo-wd-ph'><span class='ico'>&#9819;</span><h3>The Champions Cup</h3><span class='fo-wd-day'>SEASON " + ((w.season || 0) + 1) + "</span></header>" +
      "<div class='fo-wd-podrow'>" +
      "  <div class='fo-wd-pod p2'><span class='pl'>2</span><b>" + E(c.runnerUp) + "</b><i>Runner-up</i></div>" +
      "  <div class='fo-wd-pod p1'><img src='" + ART + "circuit/trophy-crown.webp' alt='' class='trophy'><b>" + E(c.champion) + "</b><i>Champions</i></div>" +
      "  <div class='fo-wd-pod p3'><span class='pl'>3</span><b>" + E(c.third) + "</b><i>Third</i></div>" +
      "</div>" +
      "<div class='fo-wd-bracket'>" +
      col("Quarter-finals", b.qf) + col("Semi-finals", b.sf) +
      "<div class='fo-wd-round'><h5>Final</h5>" + tieCard(b.final, { big: true }) +
      (b.third ? "<h5 class='sub'>Third place</h5>" + tieCard(b.third) : "") + "</div>" +
      "</div></section>";
  }

  function wirePanel(w) {
    var tabs = CAT.map(function (c, i) { return "<button class='fo-wd-tab" + (i === 0 ? " on" : "") + "' data-cat='" + c + "' onclick='window.foWD.filter(this)'>" + CATLBL[c] + "</button>"; }).join("");
    var rows = (w.wire || []).map(function (h) {
      var cat = h.category || "league";
      return "<li data-cat='" + cat + "' class='c-" + cat + "'>" +
        "<span class='fo-wd-day'>DAY " + ((h.day || 0) + 1) + "</span>" +
        "<span class='fo-wd-wico'>" + (GLYPH[cat] || GLYPH.league) + "</span>" +
        "<span class='fo-wd-wtx'>" + (cat === "upset" ? "<b>UPSET</b> " : "") + E(h.headline) + "</span>" +
        "</li>";
    }).join("");
    return "<section class='fo-wd-panel fo-wd-news'>" +
      "<header class='fo-wd-ph'><span class='ico'>&#9673;</span><h3>The Wire</h3></header>" +
      "<div class='fo-wd-tabs'>" + tabs + "</div>" +
      "<ol class='fo-wd-feed' data-filter='all'>" + rows + "</ol>" +
      "</section>";
  }

  function fixturesPanel(w) {
    var rows = (w.featured || []).map(function (f) {
      return "<div class='fo-wd-fx'>" +
        "<div class='fo-wd-fxtop'><span class='comp'>" + E(f.comp) + "</span>" + (f.live ? "<span class='live'>&#9679; LIVE</span>" : "") + "</div>" +
        "<div class='fo-wd-fxrow'>" +
        "<span class='t'>" + chip(f.home.code) + "<span class='nm'>" + E(f.home.name) + "</span></span>" +
        "<span class='v'>v</span>" +
        "<span class='t a'>" + chip(f.away.code) + "<span class='nm'>" + E(f.away.name) + "</span></span>" +
        "</div></div>";
    }).join("");
    return "<section class='fo-wd-panel fo-wd-fixtures'>" +
      "<header class='fo-wd-ph'><span class='ico'>&#9200;</span><h3>Featured Fixtures</h3><span class='fo-wd-day'>MATCHDAY " + ((w.matchday || 0) + 1) + "</span></header>" +
      rows + "</section>";
  }

  function worldTablePanel(w) {
    var rows = (w.world || []).map(function (r, i) {
      return "<tr" + (r.kind === "boss" ? " class='boss'" : "") + "><td class='ps'>" + (i + 1) + "</td>" +
        "<td class='cl'>" + chip(r.code) + "<span class='nm'>" + E(r.name) + "</span></td>" +
        "<td>" + r.P + "</td><td>" + r.W + "</td><td>" + r.L + "</td><td class='pt'>" + r.pts + "</td></tr>";
    }).join("");
    return "<section class='fo-wd-panel fo-wd-wt'>" +
      "<header class='fo-wd-ph'><span class='ico'>&#9733;</span><h3>World Table</h3><span class='fo-wd-day'>TOP CLUBS</span></header>" +
      "<table><thead><tr><th></th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>" + rows + "</tbody></table></section>";
  }

  function bossesPanel(w) {
    var cards = (w.bosses || []).map(function (b) {
      return "<div class='fo-wd-bosscard'>" +
        "<div class='fo-wd-bossart'><img src='" + boss(b.code) + "' alt='' loading='lazy'><span class='code'>" + E(b.code.toUpperCase()) + "</span></div>" +
        "<div class='fo-wd-bossnm'>" + E(b.name) + "</div>" +
        "<div class='fo-wd-bosssub'>" + E(b.nation) + "</div>" +
        "</div>";
    }).join("");
    return "<section class='fo-wd-panel fo-wd-bosses'>" +
      "<header class='fo-wd-ph'><span class='ico'>&#9876;</span><h3>The Bosses</h3><span class='fo-wd-day'>" + (w.bosses || []).length + " NATIONS</span></header>" +
      "<div class='fo-wd-bossrow'>" + cards + "</div></section>";
  }

  function hallPanel(w) {
    var k = w.king || {};
    return "<section class='fo-wd-panel fo-wd-hall'>" +
      "<header class='fo-wd-ph'><span class='ico'>&#9819;</span><h3>Hall of Champions</h3></header>" +
      "<div class='fo-wd-hallbody'>" +
      "<img src='" + ART + "circuit/trophy-crown.webp' alt='' class='ht'>" +
      "<div class='fo-wd-halltx'>" +
      "<div class='fo-wd-hallnums'><span><b>" + (k.seasons || 1) + "</b>Seasons</span><span><b>1</b>King</span></div>" +
      "<div class='fo-wd-hallnm'>" + E(k.name || "Reggie Thorne") + "</div>" +
      "<div class='fo-wd-hallclub'>" + E(k.club || "Thorne's Invincible XI") + "</div>" +
      "</div></div></section>";
  }

  // ---- render --------------------------------------------------------------
  function render() {
    var page = document.getElementById("page"); if (!page) return;
    try { document.body.classList.add("fo-wd-on"); } catch (e) {}
    var w = snap();
    var sig = w ? (w.seed + ":" + w.asOfDay) : "none";
    if (page.__fowdSig === sig && page.querySelector(".fo-wd")) return;
    page.__fowdSig = sig;
    if (!w || !w.cup) {
      page.innerHTML = "<div class='fo-wd'><div class='fo-wd-in'><section class='fo-wd-panel' style='margin-top:40px'><header class='fo-wd-ph'><h3>The World</h3></header><p style='padding:16px;color:#93a4c0'>The world is still warming up. Check back once the season has run.</p><a class='fo-wd-back' href='#/circuit' style='margin:0 16px 16px'>&#8249; Back to your club</a></section></div></div>";
      return;
    }
    page.innerHTML =
      "<div class='fo-wd'><div class='fo-wd-in'>" +
      hero(w) +
      "<div class='fo-wd-mid'>" +
      cupPanel(w) +
      wirePanel(w) +
      "<div class='fo-wd-rail'>" + fixturesPanel(w) + worldTablePanel(w) + "</div>" +
      "</div>" +
      "<div class='fo-wd-bot'>" + bossesPanel(w) + hallPanel(w) + "</div>" +
      "</div></div>";
  }

  // Wire tab filtering (pure attribute toggle, no re-render)
  window.foWD = {
    filter: function (btn) {
      try {
        var cat = btn.getAttribute("data-cat");
        var wrap = btn.closest(".fo-wd-news");
        wrap.querySelectorAll(".fo-wd-tab").forEach(function (b) { b.classList.toggle("on", b === btn); });
        wrap.querySelector(".fo-wd-feed").setAttribute("data-filter", cat);
      } catch (e) {}
    }
  };

  function maybe() {
    try {
      if ((location.hash || "").split("?")[0] === "#/wire") setTimeout(render, 0);
      else document.body.classList.remove("fo-wd-on");   // restore the normal .wrap column elsewhere
    } catch (e) {}
  }
  window.addEventListener("hashchange", maybe);
  // route() in the core dispatches overlay pages by name; register the World
  // Desk as the 'wire' renderer so #/wire is recognised and paints into #page.
  window.foRenderWire = render;

  // a discoverable entry: a small link in the topbar, added once
  function addNav() {
    try {
      var tb = document.getElementById("topbar"); if (!tb || document.getElementById("fo-wd-nav")) return;
      var a = document.createElement("a"); a.id = "fo-wd-nav"; a.href = "#/wire"; a.textContent = "World"; a.className = "fo-wd-navlink"; a.dataset.nav = "wire";
      var brand = tb.querySelector(".brand");
      if (brand && brand.nextSibling) tb.insertBefore(a, brand.nextSibling); else tb.appendChild(a);
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(addNav, 0); });

  // ---- scoped styles -------------------------------------------------------
  (function () {
    if (document.getElementById("fo-wd-css")) return;
    var s = document.createElement("style"); s.id = "fo-wd-css";
    s.textContent = [
      // the desk owns the whole stage: while it's mounted we widen the app's
      // .wrap column (normally a padded 980px white card) to full width so the
      // dark broadcast layout can run edge to edge
      "html body.fo-wd-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "#page .fo-wd{position:relative;width:100%;min-height:100vh;",
      "  background:radial-gradient(130% 90% at 18% -5%,#13233f 0%,#0c1526 46%,#080d18 100%);color:#e9eefa;",
      "  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}",
      "#page .fo-wd *{box-sizing:border-box}",
      ".fo-wd-in{max-width:1520px;margin:0 auto;padding:14px 22px 60px}",
      // grid/flex children default to min-width:auto and would let long rows
      // (the boss gallery, long club names) blow out their track; pin to 0 so
      // overflow-x:auto and ellipsis actually contain them
      ".fo-wd-mid>*,.fo-wd-bot>*,.fo-wd-rail{min-width:0}",
      ".fo-wd-navlink{color:#E6B34C !important;font-weight:700}",
      // caps / kickers
      ".fo-wd-cap{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:2.5px;font-size:10px;color:#8ea3c4}",
      ".fo-wd-cap.gold{color:#EBC271}",
      ".fo-wd-day{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:1.6px;font-size:9.5px;color:#7e8fac;margin-left:auto}",
      // panels
      ".fo-wd-panel{background:linear-gradient(180deg,rgba(20,32,55,.72),rgba(12,20,36,.72));border:1px solid rgba(126,158,208,.15);border-radius:15px;padding:15px 16px;box-shadow:0 12px 30px -18px rgba(0,0,0,.7)}",
      ".fo-wd-ph{display:flex;align-items:center;gap:9px;margin:0 0 13px}",
      ".fo-wd-ph .ico{color:#EBC271;font-size:15px;line-height:1}",
      ".fo-wd-ph h3{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:2px;text-transform:uppercase;font-size:14px;color:#fff;margin:0}",
      // top band: hero | status | king
      ".fo-wd-topband{display:grid;grid-template-columns:1.65fr .82fr 1.15fr;gap:14px;margin:6px 0 16px;align-items:stretch}",
      ".fo-wd-hero{position:relative;border-radius:16px;overflow:hidden;padding:26px 26px 22px;background-size:cover;background-position:center;border:1px solid rgba(126,158,208,.16);min-height:230px;display:flex;flex-direction:column;justify-content:center}",
      ".fo-wd-kick{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:3.5px;font-size:11px;color:#EBC271}",
      ".fo-wd-hero h1{font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(44px,5.6vw,74px);line-height:.92;letter-spacing:1px;margin:4px 0 10px;color:#fff;text-transform:uppercase}",
      ".fo-wd-sub{max-width:440px;color:#aab8d0;font-size:13px;line-height:1.55;margin:0}",
      ".fo-wd-back{display:inline-block;margin-top:16px;color:#c6d2e6;font-size:12px;text-decoration:none;border:1px solid rgba(150,170,210,.28);border-radius:20px;padding:6px 14px;width:max-content;transition:.15s}",
      ".fo-wd-back:hover{color:#0c1526;background:#EBC271;border-color:#EBC271}",
      // status card
      ".fo-wd-status{background:linear-gradient(180deg,rgba(20,32,55,.72),rgba(12,20,36,.72));border:1px solid rgba(126,158,208,.15);border-radius:15px;padding:15px 14px;display:flex;flex-direction:column}",
      ".fo-wd-stats{display:flex;flex-direction:column;gap:8px;margin-top:12px;justify-content:center;flex:1}",
      ".fo-wd-stat{display:flex;align-items:center;gap:11px}",
      ".fo-wd-stat .g{font-size:17px;color:#EBC271;width:22px;text-align:center}",
      ".fo-wd-stat b{font-family:Oswald,sans-serif;font-size:26px;font-weight:600;color:#fff;line-height:1;min-width:34px}",
      ".fo-wd-stat i{font-style:normal;font-size:11px;color:#93a4c0;letter-spacing:.3px}",
      // king card
      ".fo-wd-king{position:relative;border-radius:15px;overflow:hidden;border:1px solid rgba(200,165,90,.32);background:linear-gradient(120deg,rgba(30,26,20,.6),rgba(14,18,30,.6));display:flex;align-items:stretch}",
      ".fo-wd-kingimg{width:52%;object-fit:cover;object-position:50% 18%;filter:saturate(1.02)}",
      ".fo-wd-kingtx{flex:1;padding:16px 14px;display:flex;flex-direction:column;justify-content:center;gap:3px;background:linear-gradient(90deg,rgba(12,18,30,0),rgba(12,18,30,.85) 40%);position:absolute;right:0;top:0;bottom:0;width:56%}",
      ".fo-wd-kingnm{font-family:Oswald,sans-serif;font-weight:700;font-size:24px;color:#fff;line-height:1;text-transform:uppercase;letter-spacing:.5px}",
      ".fo-wd-kingrole{font-size:10px;letter-spacing:2px;color:#EBC271;font-weight:600;margin-top:2px}",
      ".fo-wd-kingsea{font-size:12px;color:#aab8d0;margin-top:8px}.fo-wd-kingsea b{color:#fff;font-size:15px}",
      // middle three-column layout
      ".fo-wd-mid{display:grid;grid-template-columns:1.35fr .95fr 1fr;gap:14px;margin-bottom:16px;align-items:start}",
      ".fo-wd-rail{display:flex;flex-direction:column;gap:14px}",
      // cup podium
      ".fo-wd-podrow{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:9px;align-items:end;margin-bottom:16px}",
      ".fo-wd-pod{background:rgba(255,255,255,.045);border:1px solid rgba(126,158,208,.16);border-radius:11px;padding:12px 8px;text-align:center;position:relative}",
      ".fo-wd-pod .pl{display:block;font-family:Oswald,sans-serif;font-weight:700;font-size:19px;color:#8ea3c4;margin-bottom:5px}",
      ".fo-wd-pod.p1{background:linear-gradient(180deg,rgba(235,194,113,.22),rgba(235,194,113,.05));border-color:rgba(235,194,113,.5);padding-top:16px}",
      ".fo-wd-pod .trophy{width:34px;height:34px;object-fit:contain;margin-bottom:4px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}",
      ".fo-wd-pod b{display:block;font-size:12px;color:#fff;line-height:1.2}.fo-wd-pod.p1 b{font-size:13.5px}",
      ".fo-wd-pod i{font-style:normal;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#93a4c0;margin-top:3px;display:block}",
      // bracket
      ".fo-wd-bracket{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}",
      ".fo-wd-round h5{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:1.4px;font-size:9px;text-transform:uppercase;color:#7e8fac;margin:0 0 7px}",
      ".fo-wd-round h5.sub{margin-top:11px}",
      ".fo-wd-tie{background:rgba(10,16,28,.5);border:1px solid rgba(126,158,208,.12);border-radius:8px;padding:6px 7px;margin-bottom:7px}",
      ".fo-wd-tie.big{border-color:rgba(235,194,113,.34);background:linear-gradient(180deg,rgba(235,194,113,.08),rgba(10,16,28,.5))}",
      ".fo-wd-tie.empty{color:#556;text-align:center;padding:10px}",
      ".fo-wd-side{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;color:#93a4c0}",
      ".fo-wd-side.won{color:#fff;font-weight:600}",
      ".fo-wd-side .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-wd-side .sc{font-variant-numeric:tabular-nums;font-size:10.5px;color:#c6d2e6;font-weight:600}",
      ".fo-wd-side .sc.tick{color:#EBC271}",
      ".fo-wd-side.won .sc{color:#EBC271}",
      // chips
      ".fo-wd-chip{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:22px;height:22px;border-radius:6px;font-family:Oswald,sans-serif;font-size:8.5px;font-weight:600;letter-spacing:.3px;color:#eaf0fa;background:hsl(var(--h,210),42%,32%);border:1px solid hsl(var(--h,210),42%,46%)}",
      ".fo-wd-chip.king{background:linear-gradient(180deg,#5a4a1e,#2c2410);border-color:#EBC271;color:#EBC271;font-size:12px}",
      // wire
      ".fo-wd-tabs{display:flex;gap:5px;margin:-3px 0 10px;flex-wrap:wrap}",
      ".fo-wd-tab{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.6px;font-weight:500;color:#93a4c0;background:rgba(255,255,255,.04);border:1px solid rgba(126,158,208,.16);border-radius:20px;padding:4px 11px;cursor:pointer;transition:.15s;text-transform:uppercase}",
      ".fo-wd-tab:hover{color:#e9eefa}",
      ".fo-wd-tab.on{background:#EBC271;color:#0c1526;border-color:#EBC271;font-weight:600}",
      ".fo-wd-feed{list-style:none;margin:0;padding:0;max-height:560px;overflow:auto}",
      ".fo-wd-feed li{display:flex;align-items:flex-start;gap:9px;padding:9px 3px 9px 10px;border-bottom:1px solid rgba(126,158,208,.09);border-left:2.5px solid var(--wc,#6E86B8)}",
      ".fo-wd-feed li.c-upset{--wc:#C8674A}.fo-wd-feed li.c-cup{--wc:#EBC271}.fo-wd-feed li.c-transfer{--wc:#4DA6A2}.fo-wd-feed li.c-retirement{--wc:#8B93A8}.fo-wd-feed li.c-league{--wc:#6E86B8}",
      ".fo-wd-feed[data-filter='upset'] li:not([data-cat='upset']),.fo-wd-feed[data-filter='cup'] li:not([data-cat='cup']),.fo-wd-feed[data-filter='transfer'] li:not([data-cat='transfer']),.fo-wd-feed[data-filter='retirement'] li:not([data-cat='retirement']){display:none}",
      ".fo-wd-wico{flex:0 0 16px;margin-top:1px}.fo-wd-wico svg{width:15px;height:15px;fill:var(--wc,#6E86B8);opacity:.9}",
      ".fo-wd-wtx{font-size:12px;color:#d4deee;line-height:1.4}.fo-wd-wtx b{color:#C8674A;font-weight:700;letter-spacing:.5px;font-size:11px}",
      ".fo-wd-feed .fo-wd-day{flex:0 0 40px;margin:2px 0 0;color:#6c7c98}",
      // fixtures
      ".fo-wd-fx{padding:10px 0;border-bottom:1px solid rgba(126,158,208,.09)}.fo-wd-fx:last-child{border-bottom:none;padding-bottom:0}",
      ".fo-wd-fxtop{display:flex;align-items:center;gap:8px;margin-bottom:7px}",
      ".fo-wd-fxtop .comp{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:#8ea3c4}",
      ".fo-wd-fxtop .live{margin-left:auto;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:1px;color:#F26D6D;font-weight:600}",
      ".fo-wd-fxtop .live{animation:fowdpulse 1.6s infinite}@keyframes fowdpulse{50%{opacity:.5}}",
      ".fo-wd-fxrow{display:flex;align-items:center;gap:9px}",
      ".fo-wd-fxrow .t{display:flex;align-items:center;gap:7px;flex:1;min-width:0;font-size:12px;color:#e9eefa}",
      ".fo-wd-fxrow .t.a{flex-direction:row-reverse;text-align:right}",
      ".fo-wd-fxrow .t .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-wd-fxrow .v{font-size:10px;color:#6c7c98;font-style:italic;flex:0 0 auto}",
      // world table — neutralise the engine's global zebra rule
      // (body.ftpskin tr:nth-child(even) td{background:#fafafa}) that would wash
      // out the dark rows; the #page-scoped selector wins on specificity
      "#page .fo-wd table td,#page .fo-wd table th{background:transparent}",
      ".fo-wd-wt table{width:100%;border-collapse:collapse;font-size:12px}",
      ".fo-wd-wt th{font-size:8.5px;letter-spacing:.8px;text-transform:uppercase;color:#6c7c98;text-align:center;font-weight:600;padding:0 0 6px}",
      ".fo-wd-wt th:nth-child(2){text-align:left}",
      ".fo-wd-wt td{padding:5px 0;text-align:center;color:#aab8d0;border-top:1px solid rgba(126,158,208,.08)}",
      ".fo-wd-wt td.cl{text-align:left;color:#e9eefa;display:flex;align-items:center;gap:8px}",
      ".fo-wd-wt td.cl .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}",
      ".fo-wd-wt td.ps{color:#6c7c98;width:18px}.fo-wd-wt td.pt{color:#fff;font-weight:700}",
      ".fo-wd-wt tr:first-child td{color:#EBC271}.fo-wd-wt tr:first-child td.cl .nm{color:#EBC271;font-weight:600}",
      // bosses gallery
      ".fo-wd-bot{display:grid;grid-template-columns:1fr .34fr;gap:14px;align-items:start}",
      ".fo-wd-bossrow{display:flex;gap:11px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity}",
      ".fo-wd-bosscard{flex:0 0 122px;scroll-snap-align:start}",
      ".fo-wd-bossart{position:relative;border-radius:11px;overflow:hidden;aspect-ratio:3/4;border:1px solid rgba(126,158,208,.18);background:#0b1220}",
      ".fo-wd-bossart img{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block}",
      ".fo-wd-bossart .code{position:absolute;top:6px;left:6px;font-family:Oswald,sans-serif;font-size:8.5px;font-weight:600;letter-spacing:.5px;color:#fff;background:rgba(8,13,26,.72);border:1px solid rgba(235,194,113,.4);border-radius:5px;padding:1px 5px}",
      ".fo-wd-bossnm{font-size:11.5px;color:#fff;font-weight:600;margin-top:7px;line-height:1.15}",
      ".fo-wd-bosssub{font-size:10px;color:#8ea3c4;margin-top:1px}",
      ".fo-wd-bossrow::-webkit-scrollbar{height:7px}.fo-wd-bossrow::-webkit-scrollbar-thumb{background:rgba(126,158,208,.24);border-radius:4px}",
      // hall of champions
      ".fo-wd-hallbody{display:flex;gap:13px;align-items:center}",
      ".fo-wd-hall .ht{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}",
      ".fo-wd-hallnums{display:flex;gap:16px;margin-bottom:8px}",
      ".fo-wd-hallnums span{display:flex;flex-direction:column;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#8ea3c4}",
      ".fo-wd-hallnums b{font-family:Oswald,sans-serif;font-size:24px;font-weight:600;color:#EBC271;line-height:1}",
      ".fo-wd-hallnm{font-family:Oswald,sans-serif;font-size:17px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.5px}",
      ".fo-wd-hallclub{font-size:11px;color:#93a4c0;margin-top:1px}",
      // responsive
      "@media(max-width:1180px){.fo-wd-topband{grid-template-columns:1fr 1fr}.fo-wd-hero{grid-column:1/-1;min-height:190px}.fo-wd-mid{grid-template-columns:1fr 1fr}.fo-wd-cup{grid-column:1/-1}.fo-wd-bot{grid-template-columns:1fr}}",
      "@media(max-width:720px){.fo-wd-in{padding:10px 12px 50px}.fo-wd-topband{grid-template-columns:1fr}.fo-wd-mid{grid-template-columns:1fr}.fo-wd-bracket{grid-template-columns:1fr}.fo-wd-hero h1{font-size:46px}.fo-wd-king{min-height:150px}}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  })();

  setTimeout(function () { addNav(); maybe(); }, 60);
})();

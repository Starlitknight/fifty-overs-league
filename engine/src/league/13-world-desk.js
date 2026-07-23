// ===========================================================================
//  THE WORLD DESK (#/wire) — the Living World, made visible
//
//  A read-only broadcast desk for the persistent, deterministic world: the
//  reigning Champions Cup (podium + knockout bracket), the world news feed
//  ("the Wire"), and all nineteen national league tables. It reads a real,
//  engine-played season baked into the page as window.FO_WORLD_SNAPSHOT (see
//  tools/build-world-snapshot.mjs). Self-contained: its own styles, its own
//  escaping, no dependency on the league closure. When the live server tick
//  lands this same view reads today's world instead of a season snapshot.
// ===========================================================================
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function snap() { try { return window.FO_WORLD_SNAPSHOT || null; } catch (e) { return null; } }

  var ART = {
    "cup-final": "#F0B94E", "upset": "#C8674A", "thorne": "#B5304C", "boss-fall": "#C8674A",
    "cup-ko": "#F3D37A", "cup-groups": "#4DA6A2", "league-day": "#8ea0c0", "break": "#6b7280"
  };

  function podium(cup) {
    return "<div class='fo-wd-podium'>" +
      "<div class='fo-wd-cupname'>THE CHAMPIONS CUP</div>" +
      "<div class='fo-wd-pod'>" +
      "<div class='p2'><span class='medal'>2</span><b>" + E(cup.runnerUp) + "</b><i>runner-up</i></div>" +
      "<div class='p1'><span class='medal'>🏆</span><b>" + E(cup.champion) + "</b><i>champions</i></div>" +
      "<div class='p3'><span class='medal'>3</span><b>" + E(cup.third) + "</b><i>third</i></div>" +
      "</div></div>";
  }

  function bracket(cup) {
    var b = cup.bracket || {};
    var tie = function (t) { return t ? "<div class='fo-wd-tie'><b>" + E(t.win) + "</b><em>beat</em><span>" + E(t.lose) + "</span></div>" : ""; };
    var col = function (label, ties) { return "<div class='fo-wd-round'><h5>" + label + "</h5>" + (ties || []).map(tie).join("") + "</div>"; };
    return "<div class='fo-wd-bracket'>" +
      col("Quarter-finals", b.qf) + col("Semi-finals", b.sf) +
      "<div class='fo-wd-round'><h5>Final</h5>" + tie(b.final) + (b.third ? "<h5 class='thd'>Third place</h5>" + tie(b.third) : "") + "</div>" +
      "</div>";
  }

  function wireFeed(wire) {
    var rows = (wire || []).map(function (h) {
      var c = ART[h.art] || "#8ea0c0";
      var tag = h.phase === "cup" ? "CUP" : h.phase === "league" ? "DAY " + ((h.round || 0) + 1) : "·";
      return "<li style='--wc:" + c + "'><span class='fo-wd-tag'>" + tag + "</span><span class='fo-wd-head'>" + E(h.headline) + "</span></li>";
    }).join("");
    return "<ol class='fo-wd-wire'>" + rows + "</ol>";
  }

  function leagueTable(lg) {
    var rows = lg.table.map(function (r, i) {
      var cls = (i === 0 ? "win" : "") + (r.kind === "boss" ? " boss" : "");
      return "<tr class='" + cls + "'><td class='ps'>" + (i + 1) + "</td><td class='cl'>" + E(r.name) +
        (r.kind === "boss" ? " <em>★</em>" : "") + "</td><td>" + r.W + "</td><td>" + r.L + "</td><td class='pt'>" + r.pts + "</td></tr>";
    }).join("");
    return "<div class='fo-wd-lg'><h4>" + E(lg.name) + "</h4>" +
      "<table><thead><tr><th></th><th>Club</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  function render() {
    var page = document.getElementById("page"); if (!page) return;
    var w = snap();
    if (page.__fowdSig === (w ? w.seed + ":" + w.asOfDay : "none") && page.querySelector(".fo-wd")) return;
    page.__fowdSig = w ? w.seed + ":" + w.asOfDay : "none";
    if (!w || !w.cup) {
      page.innerHTML = "<div class='fo-wd'><div class='fo-wd-hero'><h1>The World</h1><p class='fo-wd-sub'>The world is still warming up. Check back once the season has run.</p><a class='fo-wd-back' href='#/circuit'>&#8249; Back to your club</a></div></div>";
      return;
    }
    var mb = Math.floor((w.asOfDay || 0) / 2) + 1;
    page.innerHTML =
      "<div class='fo-wd'>" +
      "<div class='fo-wd-hero'>" +
      "<div class='fo-wd-kick'>THE FIFTY OVERS WORLD &middot; SEASON " + ((w.season || 0) + 1) + " &middot; MATCHDAY " + mb + "</div>" +
      "<h1>The Wire</h1>" +
      "<p class='fo-wd-sub'>One living world of nineteen nations. Every result below was played, ball by ball, through the real engine — and Reggie Thorne still sits on the throne.</p>" +
      "<a class='fo-wd-back' href='#/circuit'>&#8249; Back to your club</a>" +
      "</div>" +
      "<div class='fo-wd-top'>" +
      "<div class='fo-wd-cup'>" + podium(w.cup) + bracket(w.cup) + "</div>" +
      "<div class='fo-wd-news'><h3>The Wire</h3>" + wireFeed(w.wire) + "</div>" +
      "</div>" +
      "<h3 class='fo-wd-lgh'>The nations &middot; final tables</h3>" +
      "<div class='fo-wd-leagues'>" + w.leagues.map(leagueTable).join("") + "</div>" +
      "</div>";
  }

  function maybe() {
    try {
      if ((location.hash || "").split("?")[0] === "#/wire") setTimeout(render, 0);
    } catch (e) {}
  }
  window.addEventListener("hashchange", maybe);
  // route() in the core dispatches overlay pages by name; register the World
  // Desk as the 'wire' renderer so #/wire is recognised (and not bounced to
  // #/circuit as an unknown hash). It paints into #page like the other overlays.
  window.foRenderWire = render;
  // a discoverable entry: a small link in the topbar, added once
  function addNav() {
    try {
      var tb = document.getElementById("topbar"); if (!tb || document.getElementById("fo-wd-nav")) return;
      var a = document.createElement("a"); a.id = "fo-wd-nav"; a.href = "#/wire"; a.textContent = "World"; a.className = "fo-wd-navlink";
      var brand = tb.querySelector(".brand");
      if (brand && brand.nextSibling) tb.insertBefore(a, brand.nextSibling); else tb.appendChild(a);
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(addNav, 0); });

  // scoped styles
  (function () {
    if (document.getElementById("fo-wd-css")) return;
    var s = document.createElement("style"); s.id = "fo-wd-css";
    s.textContent =
      "#page .fo-wd{max-width:1120px;margin:0 auto;padding:6px 12px 40px;color:#e8edf6}" +
      // neutralise the engine's global zebra rule (body.ftpskin tr:nth-child(even) td)
      // which paints a near-white cell background and washes out the dark tables
      "#page .fo-wd table td,#page .fo-wd table th{background:transparent}" +
      ".fo-wd-navlink{color:#F0B94E !important;font-weight:700}" +
      ".fo-wd-hero{padding:18px 4px 14px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:16px}" +
      ".fo-wd-kick{font-family:Oswald,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:3px;color:#F3D37A}" +
      ".fo-wd-hero h1{font-family:Oswald,sans-serif;font-weight:600;font-size:clamp(34px,6vw,58px);letter-spacing:1px;margin:4px 0 6px;color:#fff;text-transform:uppercase}" +
      ".fo-wd-sub{max-width:640px;color:#aeb9cc;font-size:13.5px;line-height:1.5;margin:0}" +
      ".fo-wd-back{display:inline-block;margin-top:10px;color:#9fb0c9;font-size:12px;text-decoration:none}" +
      ".fo-wd-back:hover{color:#F0B94E}" +
      ".fo-wd-top{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;margin-bottom:22px}" +
      "@media(max-width:820px){.fo-wd-top{grid-template-columns:1fr}}" +
      ".fo-wd-cup,.fo-wd-news{background:linear-gradient(180deg,rgba(12,22,40,.9),rgba(8,15,28,.9));border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px}" +
      ".fo-wd-cupname{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:3px;font-size:11px;color:#F3D37A;text-align:center;margin-bottom:12px}" +
      ".fo-wd-pod{display:grid;grid-template-columns:1fr 1.2fr 1fr;align-items:end;gap:8px;margin-bottom:16px}" +
      ".fo-wd-pod>div{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 8px;text-align:center}" +
      ".fo-wd-pod .p1{background:linear-gradient(180deg,rgba(240,185,78,.22),rgba(240,185,78,.06));border-color:rgba(240,185,78,.5);padding-top:20px}" +
      ".fo-wd-pod .medal{display:block;font-family:Oswald,sans-serif;font-weight:700;font-size:20px;color:#F0B94E;margin-bottom:4px}" +
      ".fo-wd-pod .p1 .medal{font-size:30px}" +
      ".fo-wd-pod b{display:block;font-size:12.5px;color:#fff;line-height:1.2}" +
      ".fo-wd-pod .p1 b{font-size:14px}" +
      ".fo-wd-pod i{font-style:normal;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#9fb0c9}" +
      ".fo-wd-bracket{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}" +
      ".fo-wd-round h5{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:1.5px;font-size:9.5px;text-transform:uppercase;color:#8ea0c0;margin:0 0 6px}" +
      ".fo-wd-round h5.thd{margin-top:8px}" +
      ".fo-wd-tie{background:rgba(255,255,255,.04);border-radius:7px;padding:5px 8px;margin-bottom:5px;font-size:11px;line-height:1.35}" +
      ".fo-wd-tie b{color:#fff}.fo-wd-tie em{font-style:normal;color:#6b7280;margin:0 4px;font-size:9.5px}.fo-wd-tie span{color:#93a1b8}" +
      ".fo-wd-news h3,.fo-wd-lgh{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:2px;text-transform:uppercase;font-size:13px;color:#F3D37A;margin:0 0 10px}" +
      ".fo-wd-lgh{margin:6px 0 12px}" +
      ".fo-wd-wire{list-style:none;margin:0;padding:0;max-height:430px;overflow:auto}" +
      ".fo-wd-wire li{display:flex;gap:9px;align-items:baseline;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,.07);border-left:3px solid var(--wc);padding-left:9px}" +
      ".fo-wd-tag{font-family:Oswald,sans-serif;font-size:8.5px;font-weight:600;letter-spacing:1px;color:#8ea0c0;flex:0 0 42px}" +
      ".fo-wd-head{font-size:12.5px;color:#dce4f0;line-height:1.4}" +
      ".fo-wd-leagues{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}" +
      ".fo-wd-lg{background:rgba(12,22,40,.65);border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:10px 12px}" +
      ".fo-wd-lg h4{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:.6px;font-size:13px;color:#fff;margin:0 0 6px;text-transform:uppercase}" +
      ".fo-wd-lg table{width:100%;border-collapse:collapse;font-size:11.5px}" +
      ".fo-wd-lg th{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:#6b7a92;text-align:center;font-weight:600;padding:0 0 4px}" +
      ".fo-wd-lg th:nth-child(2){text-align:left}" +
      ".fo-wd-lg td{padding:2.5px 0;text-align:center;color:#b8c3d5;border-top:1px solid rgba(255,255,255,.05)}" +
      ".fo-wd-lg td.cl{text-align:left;color:#dce4f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}" +
      ".fo-wd-lg td.ps{color:#6b7a92;width:16px}.fo-wd-lg td.pt{color:#fff;font-weight:700}" +
      ".fo-wd-lg tr.win td{color:#F0B94E}.fo-wd-lg tr.win td.cl{color:#F0B94E;font-weight:600}" +
      ".fo-wd-lg tr.boss td.cl em{color:#B5304C;font-style:normal}";
    (document.head || document.documentElement).appendChild(s);
  })();

  // fire on load in case we boot straight onto #/wire, and add the nav link
  setTimeout(function () { addNav(); maybe(); }, 60);
})();

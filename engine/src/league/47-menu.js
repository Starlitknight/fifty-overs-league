/* ============================================================================
   THE MENU (every room, one door) — the navigation pass.

   The game grew room by room: the nets, the academy, the books, the
   invitationals, the international game, the record book, the gazette. Each
   arrived with a link from wherever it happened to be born - the academy off
   the world club page, the books off the academy, the gazette off the desk -
   and nothing anywhere listed the building. A manager who had not been shown
   a room could not find it.

   This is the building's index. One panel, opened from the masthead on every
   screen size, grouping every room the game has: what it is called, what it
   is for, and whether you are standing in it. It proxies the engine's own
   pills (Admin, Log out) at the foot, so nothing that used to be in the old
   drawer is lost.

   Pure overlay: it adds a panel and reads window.location. No page changes
   its markup for this.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foMenu) return; window.__foMenu = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // ONE HAND DREW ALL OF THESE. Thin-stroke line glyphs in the dock's own
  // idiom rather than a grid of colour emoji, because a painted cricket
  // almanack should not look like a phone's app drawer.
  var G = {
    house: "<path d='M3.6 10.4 12 3.6l8.4 6.8'/><path d='M5.6 9.2V20a.6.6 0 0 0 .6.6h11.6a.6.6 0 0 0 .6-.6V9.2'/><path d='M9.8 20.6V15h4.4v5.6'/>",
    people: "<circle cx='9.4' cy='8' r='3.2'/><path d='M3.8 20c0-3 2.5-5 5.6-5s5.6 2 5.6 5'/><path d='M15.6 5.2a3.2 3.2 0 0 1 0 5.6'/><path d='M17 15.4c2.2.5 3.7 2.2 3.7 4.6'/>",
    net: "<rect x='3.6' y='5.2' width='16.8' height='13.6' rx='1.6'/><path d='M9.2 5.4v13.2M14.8 5.4v13.2'/><path d='M3.8 9.6h16.4M3.8 14.4h16.4'/>",
    star: "<path d='m12 3.6 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6 6.8 19.5 8 13.7l-4.4-4 5.9-.7z'/>",
    sheet: "<path d='M6.4 3.6h7.2l4 4v12.8a.6.6 0 0 1-.6.6H6.4a.6.6 0 0 1-.6-.6V4.2a.6.6 0 0 1 .6-.6z'/><path d='M13.4 3.8v4h4'/><path d='M8.8 12.4h6.4M8.8 16h4.4'/>",
    cal: "<rect x='3.8' y='5.4' width='16.4' height='14.8' rx='2'/><path d='M3.8 10h16.4'/><path d='M8.4 3.6v3.6M15.6 3.6v3.6'/>",
    pitch: "<ellipse cx='12' cy='12' rx='8.8' ry='6.6'/><rect x='10.3' y='7.2' width='3.4' height='9.6' rx='1'/>",
    medal: "<circle cx='12' cy='14.8' r='5.2'/><path d='M8.4 10 6 3.8h12L15.6 10'/>",
    globe: "<circle cx='12' cy='12' r='8.4'/><path d='M3.7 12h16.6'/><path d='M12 3.6c2.2 2.4 3.3 5.3 3.3 8.4s-1.1 6-3.3 8.4c-2.2-2.4-3.3-5.3-3.3-8.4s1.1-6 3.3-8.4z'/>",
    table: "<rect x='3.6' y='4.6' width='16.8' height='14.8' rx='1.8'/><path d='M3.8 9.4h16.4M3.8 14.6h16.4'/><path d='M9 4.8v14.4'/>",
    plane: "<path d='M20.4 4.2 3.6 11.4l5.6 2.2 2.2 5.6z'/><path d='m9.2 13.6 5.4-5.4'/>",
    crown: "<path d='M3.8 7.2 7.4 12l4.6-6.2L16.6 12l3.6-4.8-1.5 11.2H5.3z'/><path d='M5.6 19.8h12.8'/>",
    chart: "<path d='M3.8 20.2h16.4'/><path d='M7 20V13M12 20V6.6M17 20v-9'/>",
    map: "<path d='m3.8 6.6 5.2-2.2 6 2.4 5.2-2.2v12.8l-5.2 2.2-6-2.4-5.2 2.2z'/><path d='M9 4.6v12.6M15 6.8v12.6'/>",
    book: "<path d='M4.2 4.6h6a3 3 0 0 1 3 3v11.8a2.4 2.4 0 0 0-2.4-2.4H4.2z'/><path d='M19.8 4.6h-6a3 3 0 0 0-3 3v11.8a2.4 2.4 0 0 1 2.4-2.4h6.6z'/>",
    shield: "<path d='M12 3.6 5 6.2v5.4c0 4.2 2.9 7.4 7 8.8 4.1-1.4 7-4.6 7-8.8V6.2z'/>",
    news: "<path d='M4.2 5.6h12.4v13.2a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4z'/><path d='M16.6 8.6h2.2a1.4 1.4 0 0 1 1.4 1.4v8.8a1.4 1.4 0 0 1-2.8 0'/><path d='M7 9h6.6M7 12.6h6.6M7 16h4'/>"
  };
  function glyph(k) {
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.55' stroke-linecap='round' stroke-linejoin='round'>" +
      (G[k] || G.house) + "</svg>";
  }

  // THE BUILDING, room by room. Order is the order a manager meets them.
  var MAP = [
    { k: "Your club", rooms: [
      ["home", "house", "Home ground", "The day, the weather and your next match"],
      ["squad", "people", "The squad", "Every man on the books, and the eleven you pick"],
      ["training", "net", "The nets", "What each man works on, week by week"],
      ["academy", "star", "The academy", "The colts coming through, and what a level buys"],
      ["fixtures", "cal", "The fixture list", "Every match of the summer, dated"],
      ["matchday", "pitch", "Matchday", "The pitch, the head-to-head and the probable XIs"],
      ["milestones", "medal", "The honours board", "The plaques won, and the ones still open"]
    ] },
    { k: "The world", rooms: [
      ["planet", "globe", "World cricket", "Every nation's round, live on the world clock"],
      ["league", "table", "My league", "The table, the results and who is chasing whom"],
      ["nations", "plane", "The international game", "The windows, the squads, the tours and the caps"],
      ["champions", "crown", "The Champions Cup", "The champion club of every nation, one knockout"],
      ["rankings", "chart", "The world rankings", "One ladder for every club on earth"],
      ["world", "map", "The world map", "The globe, nation by nation"],
      ["atlas", "book", "The atlas", "Every league, every club, every ground"],
      ["team", "shield", "Club dossiers", "A rival read properly, squad and all"]
    ] },
    { k: "The record", rooms: [
      ["almanack", "globe", "The world almanack", "The book of record for the whole planet"],
      ["paper", "news", "The gazette", "One front page a day, the same on every phone"],
      ["lore", "book", "The journal", "The book of the league, and the people in it"]
    ] }
  ];

  function curRoom() { return ((location.hash || "#/home").split("?")[0] || "").replace("#/", "") || "home"; }
  // rooms that are really the same door, so the lamp lights in one place
  var ALIAS = { club: "home", nation: "league", natteams: "nations", circuit: "world", tour: "world",
    player: "squad", matchlab: "squad", star: "squad", city: "atlas", side: "atlas", boss: "atlas",
    report: "lore", journal: "lore", scorecard: "lore" };

  function css() {
    if (document.getElementById("fo-menu-css")) return;
    var s = document.createElement("style"); s.id = "fo-menu-css";
    s.textContent = [
      // the masthead button is no longer a phone-only affordance
      "html body #fo-mnav-btn,html body.ftpskin #fo-mnav-btn{display:inline-flex !important}",
      "#fo-menu{position:fixed;inset:0;z-index:420;display:none}",
      "#fo-menu.open{display:block}",
      "#fo-menu .fo-mu-k{position:absolute;inset:0;background:rgba(6,16,32,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:fo-mu-fade .18s ease}",
      "@keyframes fo-mu-fade{from{opacity:0}to{opacity:1}}",
      "@keyframes fo-mu-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
      "#fo-menu .fo-mu-p{position:absolute;left:0;right:0;bottom:0;top:0;overflow-y:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(168deg,#0B1D3A,#07162E 62%);color:#FFFEFC;animation:fo-mu-rise .22s cubic-bezier(.2,.7,.3,1)}",
      "@media(min-width:821px){#fo-menu .fo-mu-p{top:50%;left:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);width:min(940px,92vw);max-height:86vh;border-radius:22px;box-shadow:0 40px 90px rgba(4,12,26,.5);border-bottom:3px solid #C95532}",
      "@keyframes fo-mu-rise{from{opacity:0;transform:translate(-50%,-46%)}to{opacity:1;transform:translate(-50%,-50%)}}}",
      "#fo-menu .fo-mu-in{padding:0 16px 26px;max-width:940px;margin:0 auto}",
      "#fo-menu .fo-mu-h{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;height:64px;margin:0 -16px 6px;padding:0 16px;background:linear-gradient(180deg,rgba(11,29,58,.98),rgba(11,29,58,.86));border-bottom:1px solid rgba(255,255,255,.1)}",
      "#fo-menu .fo-mu-h>div{display:flex;flex-direction:column;gap:5px;min-width:0}",
      "#fo-menu .fo-mu-h b{display:block;font:600 18px/1.05 'Fraunces',Georgia,serif;letter-spacing:-.015em}",
      "#fo-menu .fo-mu-h i{display:block;font:500 9px/1 Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A;font-style:normal}",
      "html body #fo-menu .fo-mu-x{margin-left:auto;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08) !important;border:0 !important;color:#FFFEFC !important;font:400 19px/1 inherit !important;border-radius:12px;cursor:pointer;padding:0 !important;box-shadow:none !important}",
      "html body #fo-menu .fo-mu-x:hover{background:rgba(255,255,255,.16) !important}",
      "#fo-menu .fo-mu-sec{margin:16px 0 8px;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A}",
      "#fo-menu .fo-mu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}",
      "html body #fo-menu a.fo-mu-r{display:flex;align-items:center;gap:12px;min-height:58px;padding:9px 13px;border-radius:14px;background:rgba(255,255,255,.045) !important;border:1px solid rgba(255,255,255,.075);color:#FFFEFC !important;text-decoration:none !important;transition:background .14s,border-color .14s,transform .14s}",
      "html body #fo-menu a.fo-mu-r:hover{background:rgba(255,255,255,.1) !important;border-color:rgba(232,185,106,.42);transform:translateY(-1px)}",
      "html body #fo-menu a.fo-mu-r.on{background:rgba(201,85,50,.2) !important;border-color:rgba(232,185,106,.6)}",
      "#fo-menu a.fo-mu-r em{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#E8B96A;font-style:normal}",
      "#fo-menu a.fo-mu-r em svg{width:19px;height:19px;display:block}",
      "html body #fo-menu a.fo-mu-r:hover em{background:rgba(232,185,106,.16);border-color:rgba(232,185,106,.4)}",
      "#fo-menu a.fo-mu-r.on em{background:rgba(232,185,106,.24);border-color:rgba(232,185,106,.55);color:#FFE7BE}",
      "#fo-menu a.fo-mu-r div{min-width:0}",
      "#fo-menu a.fo-mu-r b{display:block;font:600 14px/1.2 Inter,sans-serif;color:#FFFEFC}",
      "#fo-menu a.fo-mu-r i{display:block;margin-top:2px;font:400 11px/1.35 Inter,sans-serif;font-style:normal;color:rgba(255,254,252,.56);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
      "#fo-menu .fo-mu-foot{margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12);display:flex;flex-wrap:wrap;gap:8px}",
      "html body #fo-menu .fo-mu-foot a{font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,254,252,.72) !important;background:rgba(255,255,255,.06) !important;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:11px 16px;text-decoration:none !important;cursor:pointer}",
      "html body #fo-menu .fo-mu-foot a:hover{background:rgba(255,255,255,.13) !important;color:#FFFEFC !important}",
      "body.fo-mnav-lock{overflow:hidden !important}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function close() {
    try {
      var d = document.getElementById("fo-menu");
      if (d) d.classList.remove("open");
      document.body.classList.remove("fo-mnav-lock");
    } catch (e) {}
  }

  // The engine's own controls - Admin, Log out - keep working from here, so
  // the menu replaces the old drawer without losing anything it carried. Only
  // those two: every other pill is a room the index already lists properly,
  // and the status chips are not links at all.
  var KEEP = ["fo-league", "fo-logout"];
  function engineLinks(foot) {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      KEEP.forEach(function (cls) {
        var a = tb.querySelector("a." + cls);
        if (!a || (a.style && a.style.display === "none")) return;
        var label = (a.textContent || "").trim();
        if (!label) return;
        var row = document.createElement("a");
        row.href = a.getAttribute("href") || "#";
        row.textContent = label;
        row.addEventListener("click", function (ev) { ev.preventDefault(); close(); a.click(); });
        foot.appendChild(row);
      });
    } catch (e) {}
  }

  window.foSiteMenu = function () {
    css();
    var d = document.getElementById("fo-menu");
    if (d && d.classList.contains("open")) { close(); return; }
    if (!d) {
      d = document.createElement("div"); d.id = "fo-menu";
      document.body.appendChild(d);
      window.addEventListener("hashchange", close);
      window.addEventListener("keydown", function (ev) { if (ev.key === "Escape") close(); });
    }
    var here = curRoom(); here = ALIAS[here] || here;
    d.innerHTML = "<div class='fo-mu-k'></div><div class='fo-mu-p'><div class='fo-mu-in'>" +
      "<div class='fo-mu-h'><div><i>Fifty Overs</i><b>Every room in the club</b></div>" +
      "<button class='fo-mu-x' aria-label='Close menu'>&#10005;</button></div>" +
      MAP.map(function (g) {
        return "<div class='fo-mu-sec'>" + E(g.k) + "</div><div class='fo-mu-grid'>" +
          g.rooms.map(function (r) {
            return "<a class='fo-mu-r" + (r[0] === here ? " on" : "") + "' href='#/" + r[0] + "'>" +
              "<em>" + glyph(r[1]) + "</em><div><b>" + E(r[2]) + "</b><i>" + E(r[3]) + "</i></div></a>";
          }).join("") + "</div>";
      }).join("") +
      "<div class='fo-mu-foot'></div></div></div>";
    d.querySelector(".fo-mu-k").addEventListener("click", close);
    d.querySelector(".fo-mu-x").addEventListener("click", close);
    engineLinks(d.querySelector(".fo-mu-foot"));
    d.querySelectorAll("a.fo-mu-r").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        close();
        location.hash = a.getAttribute("href");
        try { if (typeof window.route === "function") window.route(); } catch (e) {}
      });
    });
    d.classList.add("open");
    document.body.classList.add("fo-mnav-lock");
  };

  // the masthead button exists before this module loads; make sure it opens
  // the index rather than the old pill proxy, however it was wired
  function adopt() {
    try {
      css();                                   // the button is ours at every width, from the first paint
      var b = document.getElementById("fo-mnav-btn");
      if (!b || b.__foMenu) return;
      b.__foMenu = 1;
      b.setAttribute("aria-label", "Every room");
      b.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        window.foSiteMenu();
      }, true);
    } catch (e) {}
  }
  try { setInterval(adopt, 1200); } catch (e) {}
  window.addEventListener("hashchange", function () { setTimeout(adopt, 60); });
  setTimeout(adopt, 400);
  setTimeout(adopt, 1500);
})();

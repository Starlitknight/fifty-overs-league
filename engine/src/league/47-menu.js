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
    news: "<path d='M4.2 5.6h12.4v13.2a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4z'/><path d='M16.6 8.6h2.2a1.4 1.4 0 0 1 1.4 1.4v8.8a1.4 1.4 0 0 1-2.8 0'/><path d='M7 9h6.6M7 12.6h6.6M7 16h4'/>",
    coin: "<circle cx='12' cy='12' r='8.4'/><path d='M14.6 9.2a3 3 0 0 0-2.6-1.2c-1.6 0-2.8.8-2.8 2 0 2.8 5.6 1.2 5.6 4 0 1.2-1.2 2-2.8 2a3 3 0 0 1-2.6-1.2'/><path d='M12 6.2v11.6'/>"
  };
  function glyph(k) {
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.55' stroke-linecap='round' stroke-linejoin='round'>" +
      (G[k] || G.house) + "</svg>";
  }

  // THE BUILDING, room by room. Order is the order a manager meets them.
  // A door is named, not described: "The nets" is the whole of what the
  // reader needs, and a line under it explaining that the nets are where men
  // train was a caption on a signpost.
  var MAP = [
    { k: "Your club", rooms: [
      ["home", "house", "Home ground"],
      ["squad", "people", "The squad"],
      ["squad-intelligence", "chart", "Squad intelligence"],
      ["training", "net", "The nets"],
      ["academy", "star", "Youth Academy"],
      ["market", "coin", "The transfer market"],
      ["finance", "coin", "The books"],
      ["fixtures", "cal", "The fixture list"],
      ["matchday", "pitch", "Matchday"],
      ["milestones", "medal", "The honours board"]
    ] },
    { k: "Tournaments", rooms: [
      ["colts", "star", "The Colts Cup"],
      ["facup", "shield", "The National Cup"],
      ["champions", "crown", "The Champions Cup"]
    ] },
    { k: "The world", rooms: [
      ["planet", "globe", "World cricket"],
      ["league", "table", "My league"],
      ["nations", "plane", "The international game"],
      ["rankings", "chart", "The world rankings"],
      ["world", "map", "The world map"],
      ["atlas", "book", "The atlas"],
      ["team", "shield", "Club dossiers"]
    ] },
    { k: "The record", rooms: [
      ["almanack", "globe", "The world almanack"],
      ["paper", "news", "The gazette"],
      ["lore", "book", "The journal"]
    ] }
  ];

  function curRoom() { return ((location.hash || "#/home").split("?")[0] || "").replace("#/", "") || "home"; }
  // WHICH MENU IS DOWN. A manager who opened Tournaments and navigated to the
  // Colts Cup should find Tournaments still down when he comes back, so the
  // choice is remembered for the session; failing that, the menu he is
  // standing in opens itself, and failing that the first one.
  var PICK = "fo_menu_group";
  function chosen() { try { var v = sessionStorage.getItem(PICK); return v == null ? null : +v; } catch (e) { return null; } }
  function choose(gi) { try { sessionStorage.setItem(PICK, String(gi)); } catch (e) {} }
  function openGroup(g, gi, here) {
    var pick = chosen();
    if (pick != null) return gi === pick;
    if (g.rooms.some(function (r) { return r[0] === here; })) return true;
    // nothing chosen and the room is in none of them: open the first
    return gi === 0 && !MAP.some(function (h) { return h.rooms.some(function (r) { return r[0] === here; }); });
  }
  // rooms that are really the same door, so the lamp lights in one place
  var ALIAS = { club: "home", nation: "league", natteams: "nations", circuit: "world", tour: "world",
    cup: "champions", wcmatch: "champions",
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
      // A HEADING IS A MENU. It is a button, it says how many rooms are behind
      // it, and the chevron turns when it drops.
      "html body #fo-menu button.fo-mu-sec{display:flex;align-items:center;gap:10px;width:100%;margin:10px 0 0;padding:13px 14px;border-radius:13px;background:rgba(255,255,255,.045) !important;border:1px solid rgba(255,255,255,.075) !important;color:#E8B96A !important;font:700 10px/1 Oswald,sans-serif !important;letter-spacing:.24em;text-transform:uppercase;cursor:pointer;text-align:left;box-shadow:none !important;transition:background .14s,border-color .14s}",
      "html body #fo-menu button.fo-mu-sec:hover{background:rgba(255,255,255,.1) !important;border-color:rgba(232,185,106,.42) !important}",
      "html body #fo-menu button.fo-mu-sec.open{background:rgba(201,85,50,.2) !important;border-color:rgba(232,185,106,.55) !important}",
      "#fo-menu button.fo-mu-sec span{flex:1 1 auto;min-width:0}",
      "#fo-menu button.fo-mu-sec i{flex:none;font-style:normal;font:600 10px/1 Inter,sans-serif;letter-spacing:0;color:rgba(255,254,252,.5);font-variant-numeric:tabular-nums}",
      "#fo-menu .fo-mu-chev{flex:none;width:15px;height:15px;transition:transform .18s ease}",
      "#fo-menu button.fo-mu-sec.open .fo-mu-chev{transform:rotate(180deg)}",
      "#fo-menu .fo-mu-grid{display:none;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;margin-top:8px}",
      "#fo-menu .fo-mu-grid.open{display:grid;animation:fo-mu-drop .16s ease}",
      "@keyframes fo-mu-drop{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}",
      "html body #fo-menu a.fo-mu-r{display:flex;align-items:center;gap:12px;min-height:50px;padding:8px 13px;border-radius:14px;background:rgba(255,255,255,.045) !important;border:1px solid rgba(255,255,255,.075);color:#FFFEFC !important;text-decoration:none !important;transition:background .14s,border-color .14s,transform .14s}",
      "html body #fo-menu a.fo-mu-r:hover{background:rgba(255,255,255,.1) !important;border-color:rgba(232,185,106,.42);transform:translateY(-1px)}",
      "html body #fo-menu a.fo-mu-r.on{background:rgba(201,85,50,.2) !important;border-color:rgba(232,185,106,.6)}",
      "#fo-menu a.fo-mu-r em{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#E8B96A;font-style:normal}",
      "#fo-menu a.fo-mu-r em svg{width:19px;height:19px;display:block}",
      "html body #fo-menu a.fo-mu-r:hover em{background:rgba(232,185,106,.16);border-color:rgba(232,185,106,.4)}",
      "#fo-menu a.fo-mu-r.on em{background:rgba(232,185,106,.24);border-color:rgba(232,185,106,.55);color:#FFE7BE}",
      "#fo-menu a.fo-mu-r div{min-width:0}",
      "#fo-menu a.fo-mu-r b{display:block;font:600 14px/1.2 Inter,sans-serif;color:#FFFEFC}",
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
      MAP.map(function (g, gi) {
        // ONE MENU AT A TIME, the way a menu bar behaves. Nineteen rooms laid
        // out flat is a scroll, not an index: you go looking for the door you
        // wanted rather than seeing it. Each heading is a menu; clicking it
        // drops its rooms down and folds the others away. The menu you are
        // standing in opens itself, so the panel always answers "where am I"
        // before you touch anything.
        var open = openGroup(g, gi, here);
        return "<button type='button' class='fo-mu-sec" + (open ? " open" : "") + "' data-fo-grp='" + gi + "'>" +
            "<span>" + E(g.k) + "</span><i>" + g.rooms.length + "</i>" +
            "<svg class='fo-mu-chev' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' " +
              "stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg></button>" +
          "<div class='fo-mu-grid" + (open ? " open" : "") + "' data-fo-grpof='" + gi + "'>" +
          g.rooms.map(function (r) {
            return "<a class='fo-mu-r" + (r[0] === here ? " on" : "") + "' href='#/" + r[0] + "'>" +
              "<em>" + glyph(r[1]) + "</em><div><b>" + E(r[2]) + "</b></div></a>";
          }).join("") + "</div>";
      }).join("") +
      "<div class='fo-mu-foot'></div></div></div>";
    d.querySelector(".fo-mu-k").addEventListener("click", close);
    d.querySelector(".fo-mu-x").addEventListener("click", close);
    engineLinks(d.querySelector(".fo-mu-foot"));
    d.querySelectorAll("button.fo-mu-sec").forEach(function (h) {
      h.addEventListener("click", function () {
        var gi = +h.getAttribute("data-fo-grp");
        var was = h.classList.contains("open");
        d.querySelectorAll("button.fo-mu-sec").forEach(function (o) { o.classList.remove("open"); });
        d.querySelectorAll(".fo-mu-grid").forEach(function (o) { o.classList.remove("open"); });
        if (!was) {
          h.classList.add("open");
          var grid = d.querySelector(".fo-mu-grid[data-fo-grpof='" + gi + "']");
          if (grid) grid.classList.add("open");
          choose(gi);
        } else { try { sessionStorage.removeItem(PICK); } catch (e) {} }
      });
    });
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

  /* ==========================================================================
     THE MENU BAR — the building's index as a bar you can read without opening
     anything (the panel above is still the whole index, one screen; this is
     the fast path). A row of menus under the masthead: click one and its
     rooms drop beneath it, the way a menu bar has always worked.

     Three things this has to survive that a naive dropdown does not:

       - THE BAR SCROLLS SIDEWAYS ON A PHONE. Four menus do not fit in 430px
         with any type size worth reading, so the bar is an overflow-x strip.
         A dropdown positioned INSIDE that strip would be clipped by it, so
         the panel is position:fixed and placed from the button's own
         bounding rect - it cannot be clipped by anything.
       - THE MASTHEAD IS STICKY AND ITS HEIGHT MOVES. The bar sticks
         underneath it, so it reads the masthead's height into a custom
         property rather than guessing at one.
       - THE MASTHEAD IS HIDDEN ON SOME SCREENS (the door, the theatre). The
         bar follows it exactly, by the same test the phone dock uses.
     ======================================================================== */
  var BAR = [
    { k: "Your club", short: "Club" },
    { k: "Tournaments", short: "Tournaments" },
    { k: "The world", short: "World" },
    { k: "The record", short: "Record" }
  ];
  function groupOf(room) {
    for (var i = 0; i < MAP.length; i++) {
      if (MAP[i].rooms.some(function (r) { return r[0] === room; })) return i;
    }
    return -1;
  }

  function barCSS() {
    if (document.getElementById("fo-mb-css")) return;
    var st = document.createElement("style"); st.id = "fo-mb-css";
    st.textContent = [
      "#fo-menubar{position:sticky;top:var(--fo-tbh,52px);z-index:310;background:rgba(9,25,50,.96);-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3);border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 6px 18px rgba(7,22,46,.18)}",
      "#fo-menubar.off{display:none}",
      "#fo-menubar .fo-mb-in{display:flex;align-items:stretch;gap:2px;max-width:1120px;margin:0 auto;padding:0 8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}",
      "#fo-menubar .fo-mb-in::-webkit-scrollbar{display:none}",
      "html body #fo-menubar button.fo-mb-t{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;background:transparent !important;border:0 !important;border-bottom:2px solid transparent !important;color:rgba(255,254,252,.78) !important;font:600 11px/1 Oswald,sans-serif !important;letter-spacing:.16em;text-transform:uppercase;padding:13px 13px 11px !important;margin:0;cursor:pointer;white-space:nowrap;box-shadow:none !important;border-radius:0 !important;transition:color .14s,border-color .14s,background .14s}",
      "html body #fo-menubar button.fo-mb-t:hover{color:#FFFEFC !important;background:rgba(255,255,255,.06) !important}",
      "html body #fo-menubar button.fo-mb-t.here{color:#E8B96A !important;border-bottom-color:#C95532 !important}",
      "html body #fo-menubar button.fo-mb-t.open{color:#FFFEFC !important;background:rgba(201,85,50,.24) !important;border-bottom-color:#E8B96A !important}",
      "#fo-menubar .fo-mb-cv{width:11px;height:11px;opacity:.65;transition:transform .16s ease}",
      // Log out sits off at the end where a menu bar puts it - but ONLY when
      // the bar has room. On a phone it leaves the bar entirely (the index
      // overlay's foot still carries it), because a strip that scrolls or
      // clips reads as breakage, not navigation.
      "html body #fo-menubar button.fo-mb-out{color:rgba(255,254,252,.5) !important}",
      "html body #fo-menubar button.fo-mb-out:hover{color:#FFFEFC !important}",
      "@media(min-width:721px){html body #fo-menubar button.fo-mb-out{margin-left:auto}}",
      // A PHONE BAR NEVER SCROLLS. Four menus, one row, evenly set - each
      // button takes a quarter of the width and the type is cut to fit, so
      // nothing is ever guillotined at the edge.
      "@media(max-width:720px){",
      "#fo-menubar .fo-mb-in{padding:0 6px;gap:0;overflow-x:hidden}",
      "html body #fo-menubar button.fo-mb-t{flex:1 1 0;justify-content:center;gap:4px;min-width:0;padding:13px 2px 11px !important;font:600 10px/1 Oswald,sans-serif !important;letter-spacing:.09em}",
      "#fo-menubar button.fo-mb-t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "#fo-menubar .fo-mb-cv{width:9px;height:9px;flex:none}",
      "html body #fo-menubar button.fo-mb-out{display:none !important}",
      "}",
      "@media(max-width:370px){html body #fo-menubar button.fo-mb-t{font:600 9.5px/1 Oswald,sans-serif !important;letter-spacing:.05em}}",
      // ONE HEADER, NOT TWO. On a desk wide enough that the masthead's empty
      // middle can hold the menus, the bar stops being its own row and rides
      // INSIDE the masthead - fixed, centred, the full height of the band -
      // and the page's art gains the row the bar used to occupy. The masthead
      // is sticky at top:0, so a fixed bar at top:0 tracks it exactly.
      "@media(min-width:900px){",
      // the masthead itself sits at z 320, so the merged bar must clear it
      "#fo-menubar{position:fixed;top:0;left:50%;transform:translateX(-50%);height:var(--fo-tbh,52px);background:transparent;border-bottom:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;z-index:321;display:flex;align-items:stretch}",
      "#fo-menubar .fo-mb-in{height:100%;align-items:stretch;padding:0;overflow:visible;max-width:none;margin:0}",
      "html body #fo-menubar button.fo-mb-t{padding:0 14px !important;border-bottom:2px solid transparent !important}",
      "html body #fo-menubar button.fo-mb-out{margin-left:8px}",
      "}",
      // TWO NAVIGATIONS IS ONE TOO MANY. The masthead's pill row listed the
      // same rooms the bar now lists, one row above it. The pills stay in the
      // DOM - the overlay's foot still proxies Admin and Log out off them, and
      // the engine still owns their handlers - but they are no longer drawn.
      "html body #topbar .fo-nav-scroll{display:none !important}",
      "#fo-menubar button.fo-mb-t.open .fo-mb-cv{transform:rotate(180deg);opacity:1}",
      // the panel: fixed, so the bar's own sideways scroll cannot clip it
      "#fo-mb-pop{position:fixed;z-index:430;display:none;min-width:230px;max-width:min(340px,calc(100vw - 16px));background:linear-gradient(168deg,#0B1D3A,#07162E 70%);border:1px solid rgba(255,255,255,.13);border-radius:14px;box-shadow:0 26px 60px rgba(4,12,26,.55);padding:7px;animation:fo-mb-drop .15s ease}",
      "#fo-mb-pop.on{display:block}",
      "@keyframes fo-mb-drop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}",
      "html body #fo-mb-pop a{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;color:#FFFEFC !important;text-decoration:none !important;font:600 13px/1.25 Inter,sans-serif}",
      "html body #fo-mb-pop a:hover,html body #fo-mb-pop a:focus{background:rgba(255,255,255,.1) !important;outline:none}",
      "html body #fo-mb-pop a.on{background:rgba(201,85,50,.26) !important}",
      "#fo-mb-pop a em{flex:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#E8B96A;font-style:normal}",
      "#fo-mb-pop a em svg{width:16px;height:16px;display:block}",
      "#fo-mb-pop a.on em{background:rgba(232,185,106,.24);border-color:rgba(232,185,106,.55);color:#FFE7BE}"
    ].join("\n");
    document.head.appendChild(st);
  }

  var popEl = null, openIx = -1;
  function pop() {
    if (!popEl) {
      popEl = document.createElement("div"); popEl.id = "fo-mb-pop";
      popEl.setAttribute("role", "menu");
      document.body.appendChild(popEl);
    }
    return popEl;
  }
  function closeBar() {
    if (popEl) popEl.classList.remove("on");
    openIx = -1;
    var bar = document.getElementById("fo-menubar");
    if (bar) [].slice.call(bar.querySelectorAll("button.fo-mb-t")).forEach(function (b) { b.classList.remove("open"); });
  }
  function openBar(ix, btn) {
    var g = MAP[ix]; if (!g) return;
    var here = curRoom(); here = ALIAS[here] || here;
    var p = pop();
    p.innerHTML = g.rooms.map(function (r) {
      return "<a role='menuitem' class='" + (r[0] === here ? "on" : "") + "' href='#/" + r[0] + "'>" +
        "<em>" + glyph(r[1]) + "</em><span>" + E(r[2]) + "</span></a>";
    }).join("");
    p.classList.add("on");
    // place it under the button, clamped inside the viewport on both sides
    var rc = btn.getBoundingClientRect();
    var w = p.offsetWidth;
    var left = Math.max(8, Math.min(rc.left, (window.innerWidth || 360) - w - 8));
    p.style.left = left + "px";
    p.style.top = (rc.bottom + 4) + "px";
    openIx = ix;
    [].slice.call(btn.parentNode.querySelectorAll("button.fo-mb-t")).forEach(function (b) { b.classList.remove("open"); });
    btn.classList.add("open");
    p.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        closeBar();
        location.hash = a.getAttribute("href");
        try { if (typeof window.route === "function") window.route(); } catch (e) {}
      });
    });
  }

  function buildBar() {
    try {
      barCSS();
      var tb = document.getElementById("topbar"); if (!tb) return;
      var bar = document.getElementById("fo-menubar");
      if (!bar) {
        bar = document.createElement("nav");
        bar.id = "fo-menubar";
        bar.setAttribute("aria-label", "Sections");
        bar.innerHTML = "<div class='fo-mb-in' role='menubar'></div>";
        tb.parentNode.insertBefore(bar, tb.nextSibling);
        var inner = bar.firstChild;
        BAR.forEach(function (b, i) {
          var ix = -1;
          for (var m = 0; m < MAP.length; m++) if (MAP[m].k === b.k) ix = m;
          if (ix < 0) return;
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "fo-mb-t";
          btn.setAttribute("data-mb", String(ix));
          btn.setAttribute("aria-haspopup", "true");
          btn.innerHTML = "<span>" + E(b.short) + "</span>" +
            "<svg class='fo-mb-cv' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4' " +
            "stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>";
          btn.addEventListener("click", function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            if (openIx === ix) closeBar(); else openBar(ix, btn);
          });
          // a mouse expects the menus to follow the pointer once one is down
          btn.addEventListener("mouseenter", function () {
            if (openIx >= 0 && openIx !== ix) openBar(ix, btn);
          });
          inner.appendChild(btn);
        });
        // ...and the way a menu bar ends: the engine's own Log out, proxied so
        // it keeps its handler and its state rather than being reimplemented.
        // It is only drawn once the engine has actually put one there.
        var out = document.createElement("button");
        out.type = "button";
        out.className = "fo-mb-t fo-mb-out";
        out.innerHTML = "<span>Log out</span>";
        out.addEventListener("click", function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          closeBar();
          var a2 = tb.querySelector("a.fo-logout");
          if (a2) a2.click();
        });
        inner.appendChild(out);
        // closing: anywhere else, Escape, a route change, or the page moving
        document.addEventListener("click", function (ev) {
          if (openIx < 0) return;
          if (popEl && popEl.contains(ev.target)) return;
          closeBar();
        });
        window.addEventListener("keydown", function (ev) {
          if (ev.key !== "Escape" || openIx < 0) return;
          var btn2 = bar.querySelector("button.fo-mb-t[data-mb='" + openIx + "']");
          closeBar();
          if (btn2) btn2.focus();
        });
        window.addEventListener("hashchange", closeBar);
        window.addEventListener("scroll", function () { if (openIx >= 0) closeBar(); }, true);
        window.addEventListener("resize", closeBar);
        // arrow keys walk the bar, as a menubar should
        inner.addEventListener("keydown", function (ev) {
          if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
          var all = [].slice.call(inner.querySelectorAll("button.fo-mb-t"));
          var at = all.indexOf(document.activeElement);
          if (at < 0) return;
          ev.preventDefault();
          var nxt = all[(at + (ev.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
          nxt.focus();
          if (openIx >= 0) nxt.click();
        });
      }
      // the bar lives and dies with the masthead, and sticks under it
      var gone = !tb.offsetParent;
      bar.classList.toggle("off", !!gone);
      if (!gone) {
        try { document.documentElement.style.setProperty("--fo-tbh", tb.offsetHeight + "px"); } catch (eV) {}
      } else if (openIx >= 0) closeBar();
      // and the menu you are standing in is lit
      var outBtn = bar.querySelector(".fo-mb-out");
      if (outBtn) outBtn.style.display = tb.querySelector("a.fo-logout") ? "" : "none";
      var here2 = curRoom(); here2 = ALIAS[here2] || here2;
      var lit = groupOf(here2);
      [].slice.call(bar.querySelectorAll("button.fo-mb-t")).forEach(function (b) {
        b.classList.toggle("here", +b.getAttribute("data-mb") === lit);
      });
    } catch (e) {}
  }
  try { setInterval(buildBar, 1200); } catch (e) {}
  window.addEventListener("hashchange", function () { setTimeout(buildBar, 60); });
  setTimeout(buildBar, 300);
  setTimeout(buildBar, 1200);

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

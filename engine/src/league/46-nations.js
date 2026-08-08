/* ============================================================================
   THE INTERNATIONAL GAME (#/nations) — the wave that gave the national teams
   a season instead of three days a year.

   Three rounds a year are WINDOW DAYS: rounds 5, 9 and 13. On one of them
   the selectors name a squad of fifteen for every nation on earth, out of
   every club in it - flagship, bot and human alike - on what a man is and
   how he is going. Those men are then NOT at their clubs that round; their
   clubs are paid for the week; and at 18:00 UTC the nations play each other
   on the real engine.

   This room reads it all back: the fifteen your country has named and which
   of them are yours, what the window paid each club, the tours as they were
   played, and the caps book - who has worn the shirt, and what he did in it.

   Everything is served, nothing is guessed. The umpire derived every line of
   it from the record, so the page is the same page on every phone.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foNat) return; window.__foNat = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function cx() { return window.__foCxAPI || null; }
  function flagOf(rid) {
    var base = (typeof FO_ART !== "undefined") ? FO_ART : "client/art/";
    try { return base + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; }
  }
  // The national side flies its flag, everywhere it appears.
  function natCrest(rid, cls) {
    return "<img class='" + cls + "' src='" + flagOf(rid) +
      "' alt='' onerror=\"this.style.display='none'\">";
  }
  // EVERY NATION HAS ONE HOME - and a gallery. The first painting in each
  // pool is the national side's main ground; the rest illustrate its story
  // cards. A nation with no paintings yet gets the generic summer-noon
  // ground and no named ground fact.
  // Keyed by the WORLD's region ids (sub, rsa, nzl, slk, win, bgd - the ids
  // FO_CX_REGIONS actually serves), so every one of the nineteen nations
  // resolves to its own painted grounds and nobody falls back to the generic.
  var NAT_ART = {
    eng: ["marylebone", "leeds", "london", "canterbury", "manchester", "nottingham"],
    aus: ["melbourne", "sydney", "adelaide", "brisbane", "perth"],
    sub: ["mumbai", "chennai", "kolkata", "nagpur", "dharamshala"],
    pak: ["lahore", "sharjah"],
    rsa: ["cape-town", "durban", "johannesburg"],
    nzl: ["auckland", "christchurch", "wellington"],
    slk: ["colombo", "galle", "kandy"],
    win: ["bridgetown", "kingston", "port-of-spain"],
    ire: ["dublin", "belfast", "cork"],
    ned: ["amsterdam", "rotterdam", "utrecht"],
    zim: ["harare", "bulawayo", "victoria-falls"],
    afg: ["kabul"], bgd: ["sylhet"], nep: ["kathmandu"],
    sco: ["edinburgh"], wal: ["cardiff"], ken: ["nairobi"],
    usa: ["grand-prairie"], can: ["king-city"]
  };
  function artBase() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function natArt(rid, i) {
    var pool = NAT_ART[rid];
    if (!pool) return artBase() + "home/arches-summer-noon.webp";
    return artBase() + "cities/" + pool[(i | 0) % pool.length] + "-ground.webp";
  }
  function natGround(rid) {
    var pool = NAT_ART[rid];
    if (!pool) return { art: artBase() + "home/arches-summer-noon.webp", name: "" };
    var nm = pool[0].split("-").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ") + " Ground";
    return { art: natArt(rid, 0), name: nm };
  }
  function money(v) {
    var n = Number(v) || 0;
    return "$" + (n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
      : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n)));
  }
  function sel(path) {
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (jwt() || SB_ANON), "content-type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function snapshot(key) {
    return sel("world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body")
      .then(function (rows) { return rows && rows[0] && rows[0].body; });
  }

  var ST = { nation: null, tab: "overview" };

  function css() {
    try { if (window.__foRoomCss) window.__foRoomCss(); } catch (e) {}
    if (document.getElementById("fo-nat-css")) return;
    var s = document.createElement("style"); s.id = "fo-nat-css";
    s.textContent = [
      "html body #page .fo-nat-flags{display:flex;gap:7px;overflow-x:auto;padding:2px 0 6px;-webkit-overflow-scrolling:touch}",
      "html body #page .fo-nat-fl{flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent !important;border:none !important;cursor:pointer;padding:4px 2px !important}",
      "html body #page .fo-nat-fl img{width:32px;height:22px;object-fit:cover;border-radius:4px;border:2px solid transparent}",
      "html body #page .fo-nat-fl.on img{border-color:#0B1D3A;box-shadow:0 0 0 3px rgba(11,29,58,.18)}",
      "html body #page .fo-nat-fl span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.05em;color:rgba(20,28,40,.55);text-transform:uppercase}",
      "html body #page .fo-nt-hero .shield img.natlogo{width:48px;height:58px;object-fit:contain;border-radius:0}",
      "html body #page .fo-nt-hero .shield.logo{background:none;clip-path:none;box-shadow:none;width:auto;height:auto}",
      "html body #page .fo-nt-hero .shield.logo img.natlogo{width:80px;height:92px;filter:drop-shadow(0 0 1.5px rgba(255,255,255,.9)) drop-shadow(0 0 14px rgba(255,255,255,.55)) drop-shadow(0 4px 10px rgba(0,0,0,.45))}",
      "html body #page .fo-nat-man{display:flex;align-items:baseline;gap:9px;padding:9px 2px;border-top:1px solid rgba(20,28,40,.07);font:500 13px/1.3 Inter,sans-serif}",
      "html body #page .fo-nat-flag{width:19px;height:13px;flex:0 0 auto;object-fit:cover;border-radius:2px;align-self:center;box-shadow:0 0 0 1px rgba(20,28,40,.12)}",
      "html body #page .fo-ac-card h3 .fo-nat-flag{width:22px;height:15px;margin-right:8px;vertical-align:-2px}",
      "html body #page .fo-ac-card h3 span .fo-nat-flag{width:17px;height:12px;margin-right:6px}",
      "html body #page .fo-nat-man:first-of-type{border-top:0}",
      "html body #page .fo-nat-man i{font-style:normal;font:700 10px/1 Oswald,sans-serif;color:rgba(20,28,40,.35);width:16px}",
      "html body #page .fo-nat-man b{font-weight:600;color:#141C28}",
      "html body #page .fo-nat-man span{flex:1;font-size:11px;color:rgba(20,28,40,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-nat-man u{text-decoration:none;font:600 10.5px/1 Inter,sans-serif;color:#1F6F4A;background:rgba(31,111,74,.1);padding:5px 9px;border-radius:999px;white-space:nowrap;align-self:center}",
      "html body #page .fo-nat-man.mine{background:rgba(232,185,106,.2);border-radius:9px;padding-left:8px;padding-right:8px}",
      // a row that opens a player page looks and behaves like one: it takes
      // the pointer, lifts on hover and carries a chevron. A row with no page
      // behind it stays flat, so the difference is visible before the click.
      "html body #page a.fo-nat-man{color:inherit;text-decoration:none;cursor:pointer;border-radius:9px;padding-left:8px;padding-right:8px;transition:background .12s ease}",
      "html body #page a.fo-nat-man:hover,html body #page a.fo-nat-man:focus-visible{background:rgba(20,28,40,.05)}",
      "html body #page a.fo-nat-man.mine:hover,html body #page a.fo-nat-man.mine:focus-visible{background:rgba(232,185,106,.34)}",
      "html body #page .fo-nat-go{font-style:normal;font-size:15px;line-height:1;color:rgba(20,28,40,.28);margin-left:2px}",
      "html body #page a.fo-nat-man:hover .fo-nat-go{color:rgba(20,28,40,.55)}",
      "html body #page .fo-nat-man.mine b{color:#6B520F}",
      "html body #page .fo-nat-tie{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 2px;border-top:1px solid rgba(20,28,40,.07);font:500 12px/1.4 Inter,sans-serif}",
      "html body #page .fo-nat-tie b{font-weight:600;color:#141C28}",
      "html body #page .fo-nat-tie b.w{color:#177A57}",
      "html body #page .fo-nat-tie u{text-decoration:none;color:rgba(20,28,40,.5);font-variant-numeric:tabular-nums}",
      "html body #page .fo-nat-tie em{font-style:normal;color:rgba(20,28,40,.3);font-size:10px}",
      "html body #page .fo-nat-tie i{flex:1 0 100%;font-style:normal;font-size:11px;color:rgba(20,28,40,.5)}",
      "html body #page .fo-nat-pay{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}",
      "html body #page .fo-nat-pay span{font:500 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.62);background:rgba(20,28,40,.06);border-radius:999px;padding:6px 10px}",
      "html body #page .fo-nat-pay span.mine{background:rgba(232,185,106,.32);color:#6B520F;font-weight:700}",
      "html body #page .fo-nat-when{margin:2px 0 8px;padding:11px 13px;background:rgba(11,29,58,.05);border:1px solid rgba(11,29,58,.18);border-left:3px solid #0B1D3A;border-radius:12px;font:500 12px/1.55 Inter,sans-serif;color:rgba(20,28,40,.75)}",
      "html body #page .fo-nat-when b{color:#0B1D3A}",
      // ---- THE HUB: the whole viewport is the page --------------------------
      "html body #page .fo-nt-bleed{width:100vw;margin-left:calc(50% - 50vw)}",
      "html body #page .fo-nt-in{max-width:1680px;margin:0 auto;padding:0 clamp(14px,3vw,44px)}",
      // ---- the hero: the nation's own ground, edge to edge ------------------
      "html body #page .fo-nt-hero{position:relative;background:linear-gradient(158deg,#152C4E,#0C1E36);overflow:hidden;min-height:250px}",
      "html body #page .fo-nt-hero .bgart{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 60%}",
      "html body #page .fo-nt-hero .veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,18,33,.92) 0%,rgba(9,18,33,.55) 44%,rgba(9,18,33,.12) 78%)}",
      "html body #page .fo-nt-hero .hin{position:relative;display:flex;align-items:center;padding-top:clamp(26px,4vw,56px);padding-bottom:clamp(26px,4vw,56px)}",
      "html body #page .fo-nt-hero .kick{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#E8B96A;margin-bottom:10px}",
      "html body #page .fo-nt-hero h2{font:700 clamp(34px,4.5vw,62px)/1 Oswald,sans-serif;text-transform:uppercase;color:#FFFEFC;margin:0;display:flex;align-items:center;gap:clamp(12px,1.4vw,20px);text-shadow:0 2px 10px rgba(0,0,0,.45)}",
      "html body #page .fo-nt-hero h2 .hfl{flex:none;width:clamp(58px,6.5vw,96px);height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.45),0 0 0 1.5px rgba(255,255,255,.4)}",
      "html body #page .fo-nt-hero .hf{display:flex;flex-wrap:wrap;gap:6px clamp(14px,2vw,26px);margin-top:16px}",
      "html body #page .fo-nt-hero .hf span{font:600 8.5px/1.5 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,239,228,.6)}",
      "html body #page .fo-nt-hero .hf b{display:block;font:600 15px/1.3 Inter,sans-serif;color:#FFFEFC;text-transform:none;letter-spacing:0;white-space:nowrap;text-shadow:0 1px 6px rgba(0,0,0,.5)}",
      // ---- the navy tab band ------------------------------------------------
      "html body #page .fo-nt-tabs{background:#0E1E36;border-top:1px solid rgba(232,185,106,.3);box-shadow:0 3px 10px rgba(11,20,35,.25)}",
      "html body #page .fo-nt-tabs .fo-nt-in{display:flex;gap:clamp(18px,2.4vw,34px);overflow-x:auto;-webkit-overflow-scrolling:touch}",
      "html body #page .fo-nt-tabs button{flex:none;font:600 12px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#EFE8D8 !important;opacity:.8;padding:16px 2px 13px !important;border:none !important;border-bottom:3px solid transparent !important;border-radius:0 !important;box-shadow:none !important;background:transparent !important;cursor:pointer}",
      "html body #page .fo-nt-tabs button.on{color:#E8B96A !important;opacity:1;border-bottom-color:#C9571F !important}",
      // ---- the front page ---------------------------------------------------
      "html body #page .fo-nt-wrap{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;margin-top:24px;align-items:start}",
      "@media(min-width:1020px){html body #page .fo-nt-wrap{grid-template-columns:minmax(0,1fr) 350px;gap:0 32px}}",
      "html body #page .fo-nt-main{min-width:0}",
      "html body #page .fo-nt-lead{display:grid;grid-template-columns:1fr;background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid rgba(20,28,40,.12);border-radius:14px;overflow:hidden;margin-bottom:22px}",
      "@media(min-width:760px){html body #page .fo-nt-lead{grid-template-columns:1.5fr 1fr}}",
      "html body #page .fo-nt-lead img{width:100%;height:100%;min-height:220px;object-fit:cover;display:block}",
      "html body #page .fo-nt-lead .tx{padding:clamp(18px,2.4vw,32px);display:flex;flex-direction:column;justify-content:center}",
      "html body #page .fo-nt-cat{font:600 10px/1 Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#B44A22;margin-bottom:12px}",
      "html body #page .fo-nt-lead h3{font:600 clamp(22px,2.2vw,32px)/1.18 Fraunces,Fraunces,Georgia,serif;margin:0 0 12px;letter-spacing:-.01em;color:#14243A}",
      "html body #page .fo-nt-dek{font:400 14px/1.65 Inter,sans-serif;color:rgba(20,28,40,.62);margin:0}",
      "html body #page .fo-nt-when{font:500 11px/1 Inter,sans-serif;color:rgba(20,28,40,.4);margin-top:16px}",
      "html body #page .fo-nt-g3{display:grid;grid-template-columns:1fr;gap:20px}",
      "@media(min-width:640px){html body #page .fo-nt-g3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}",
      "html body #page .fo-nt-story{background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid rgba(20,28,40,.12);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}",
      "html body #page .fo-nt-story img{width:100%;height:150px;object-fit:cover;display:block}",
      "html body #page .fo-nt-story .tx{padding:17px 19px 19px;display:flex;flex-direction:column;flex:1}",
      "html body #page .fo-nt-story h4{font:600 18px/1.32 Fraunces,Fraunces,Georgia,serif;margin:0 0 9px;color:#14243A}",
      "html body #page .fo-nt-story .fo-nt-dek{font-size:12.5px;flex:1}",
      // ---- the rail ----------------------------------------------------------
      "html body #page .fo-nt-rail{min-width:0}",
      "html body #page .fo-nt-tile{background:linear-gradient(0deg,#FBF6EA,#FDFAF2);border:1px solid rgba(20,28,40,.12);border-radius:12px;padding:17px 19px;margin-bottom:20px}",
      "html body #page .fo-nt-tile h3{font:600 11px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8a5219;margin:0 0 14px}",
      "html body #page .fo-nt-big{font:700 44px/1 Fraunces,Fraunces,Georgia,serif;color:#14243A}",
      "html body #page .fo-nt-big:after{content:'';display:block;width:40px;height:4px;background:#C9571F;margin-top:9px}",
      "html body #page .fo-nt-lab{font:600 9px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);margin-top:13px}",
      "html body #page .fo-nt-lab b{display:block;font:700 21px/1.2 Inter,sans-serif;color:#14243A;margin-top:5px;letter-spacing:0}",
      "html body #page a.fo-nt-mini,html body #page .fo-nt-mini{display:flex;gap:13px;padding:11px 0 !important;margin:0;border:none !important;border-top:1px solid rgba(20,28,40,.09) !important;border-radius:0 !important;box-shadow:none !important;text-decoration:none;align-items:center;cursor:pointer;background:transparent !important;width:100%;text-align:left}",
      "html body #page .fo-nt-mini:first-of-type{border-top:0 !important}",
      "html body #page .fo-nt-mini:first-of-type{border-top:0;padding-top:0}",
      "html body #page .fo-nt-mini img{width:62px;height:46px;object-fit:cover;border-radius:8px;flex:none}",
      "html body #page .fo-nt-mini b{font:600 13px/1.35 Inter,sans-serif;color:#14243A !important}",
      "html body #page .fo-nt-foot{display:flex;justify-content:space-between;margin:26px 0 8px}",
      "html body #page .fo-nt-form{display:flex;gap:7px;margin:2px 0 10px}",
      "html body #page .fo-nt-form i{width:28px;height:28px;border-radius:50%;font-style:normal;display:flex;align-items:center;justify-content:center;font:700 10.5px/1 Inter,sans-serif;color:#fff}",
      "html body #page .fo-nt-form i.w{background:#1F7A50}html body #page .fo-nt-form i.l{background:#C22823}html body #page .fo-nt-form i.t{background:#8a93a2}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function shell(body) {
    return "<div class='fo-ac' data-fo-owntable><div class='fo-ac-in'>" +
      "<div class='fo-ac-hero'><div class='fo-ac-k'>The international game</div>" +
      "<h1>Playing For Your Country</h1>" +
      "</div>" +
      body +
      "<div class='fo-ac-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/rankings'>The world rankings &rsaquo;</a></div>" +
      "</div></div>";
  }

  /* A PAGE ONLY EVER PAINTS ITS OWN ROOM.
   * This asked the selectors and then wrote whatever came back straight into
   * #page - with no check that the reader was still HERE. Tap Nations and then
   * the Almanack a second later and the selectors' answer landed on top of the
   * record book, which is how a sweep of the whole game found "The selectors
   * have not met yet" printed under the almanack's masthead. The hash is
   * checked on the way in and again on the way back from the world. */
  function onNationsPage() {
    return (location.hash || "").split("?")[0] === "#/nations";
  }
  window.foRenderNationsPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    if (!onNationsPage()) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Asking the selectors&hellip;</div>");
    Promise.all([
      snapshot("nations"),
      jwt() ? rpc("world_my_status") : Promise.resolve(null)
    ]).then(function (d) {
      if (!onNationsPage()) return;                 // the reader moved on
      render(page, d[0], d[1]);
    }).catch(function (e) {
      if (!onNationsPage()) return;
      page.innerHTML = shell("<div class='fo-ac-note'>The world could not be reached (" +
        E(String(e && e.message).slice(0, 90)) + "). Try again in a minute.</div>");
    });
  };

  function render(page, snap, st) {
    var mine = st && st.claim ? st.claim : null;
    if (!snap || !snap.nations) {
      page.innerHTML = shell(
        "<div class='fo-ac-card'><h3>The selectors have not met yet</h3>" +
        "<p class='fo-ac-p'>Squads are named at rounds 5, 9 and 13.</p></div>" +
        howItWorks());
      return;
    }
    var ids = Object.keys(snap.nations).sort();
    if (!ST.nation || ids.indexOf(ST.nation) < 0) ST.nation = (mine && mine.country) || (ids.indexOf("eng") >= 0 ? "eng" : ids[0]);
    var n = snap.nations[ST.nation] || {};
    var myClub = mine ? mine.club : null;

    var flags = "<div class='fo-nat-flags'>" + ids.map(function (rid) {
      return "<button type='button' class='fo-nat-fl" + (rid === ST.nation ? " on" : "") + "' data-nat='" + rid + "'>" +
        natCrest(rid, "") + "<span>" + E(rid) + "</span></button>";
    }).join("") + "</div>";

    // A NAME IS A DOOR WHERE THERE IS A ROOM BEHIND IT. The player page is
    // built by findPlayer, which searches the clubs THIS DEVICE holds - the
    // ten of its own league. So a manager's countrymen all open; a man browsed
    // from another nation's flag has no page here and is left as plain text
    // rather than as a link that lands on an empty screen.
    // EVERY MAN OPENS. A cricketer this device employs is found in its own
    // league; anybody else is derived from the seed the umpire built him with,
    // which needs to know WHICH club - so the link carries his nation and slot.
    // A row with neither (an old caps entry naming a man no longer on any
    // book) stays plain rather than leading to an empty page.
    var manRow = function (cls, inner, nm, slot) {
      var can = false;
      try {
        can = !!(window.foFindAnyPlayer
          ? window.foFindAnyPlayer(nm, ST.nation, slot == null ? null : (slot | 0))
          : (typeof findPlayer === "function" && findPlayer(nm)));
      } catch (e) {}
      if (!can) return "<div class='" + cls + "'>" + inner + "</div>";
      var href = "#/player?n=" + encodeURIComponent(nm) +
        (slot == null ? "" : "&r=" + encodeURIComponent(ST.nation) + "&s=" + (slot | 0));
      return "<a class='" + cls + " go' href='" + href + "'>" + inner +
        "<em class='fo-nat-go'>&#8250;</em></a>";
    };
    // THE FLAG A MAN PLAYS UNDER. A squad list of fifteen names and their
    // counties never said which country had picked them; the card's heading
    // knew and the men did not. Every international wears his flag now, here
    // and in the caps book.
    // THE RED STAR, ON THE PAGE THE SQUAD IS ON. A man wears it in every other
    // room in the game the moment his country names him, and the one list that
    // IS that naming had nothing. The mark reads the nation's own snapshot, so
    // the page has to have asked for it - and repaint when it lands.
    var natStar = function (nm2, slot2) {
      try { return window.foNatStar ? window.foNatStar(nm2, slot2 == null ? null : (slot2 | 0), { rid: ST.nation }) : ""; }
      catch (eS) { return ""; }
    };
    try {
      if (window.__foWorldLg && window.__foWorldLg.want) {
        window.__foWorldLg.want(ST.nation, function () {
          try { if ((location.hash || "").split("?")[0] === "#/nations") window.foRenderNationsPage(); } catch (eR) {}
        });
      }
    } catch (eW) {}
    var natFlag = natCrest(ST.nation, "fo-nat-flag");
    var squad = (n.squad || []).map(function (m, i) {
      var isMine = myClub && m.club === myClub;
      return manRow("fo-nat-man" + (isMine ? " mine" : ""),
        "<i>" + (i + 1) + "</i>" + natFlag +
        "<b>" + E(m.name) + natStar(m.name, m.slot) + "</b><span>" + E(m.club || "") +
        (m.age ? " &middot; " + m.age : "") + "</span>" +
        "<u>" + (m.caps ? m.caps + " cap" + (m.caps === 1 ? "" : "s") : "uncapped") + "</u>",
        m.name, m.slot);
    }).join("");

    var pay = (n.compensation || []).map(function (c) {
      return "<span class='" + (myClub && c.club === myClub ? "mine" : "") + "'>" +
        E(c.club || ("club " + c.slot)) + " &middot; " + money(c.paid) + "</span>";
    }).join("");

    var tours = (n.tours || []).map(tieRow).join("");
    var caps = (n.caps || []).map(function (c, i) {
      return manRow("fo-nat-man",
        "<i>" + (i + 1) + "</i>" + natFlag + "<b>" + E(c.name) + natStar(c.name) + "</b>" +
        "<span>" + c.caps + " cap" + (c.caps === 1 ? "" : "s") +
        (c.runs ? " &middot; " + c.runs + " runs" + (c.hs ? " (" + c.hs + " best)" : "") : "") +
        (c.wkts ? " &middot; " + c.wkts + " wickets" + (c.bb ? " (" + c.bb.w + "-" + c.bb.r + ")" : "") : "") +
        "</span>",
        c.name, (((n.squad || []).filter(function (m2) { return m2.name === c.name; })[0]) || {}).slot);
    }).join("");

    var myMen = mine ? (n.squad || []).filter(function (m) { return m.club === myClub; }) : [];

    // THE NATION'S BILLING: shield, name, and the window's facts - with its
    // world rank where the rankings snapshot has spoken.
    var natRank = null;
    try {
      var rk9 = JSON.parse(localStorage.getItem("fo_world_rk") || "null");
      var list9 = (rk9 && (rk9.countries || rk9.nations)) || [];
      var nr9 = list9.filter(function (x) { return x.id === ST.nation || x.country === ST.nation; })[0];
      if (nr9 && nr9.rank) natRank = nr9;
    } catch (eRk) {}
    // the tours read newest-last: the nation's own results become its form
    var formChips = (n.tours || []).map(function (t9) {
      var us = n.name;
      if (t9.a !== us && t9.b !== us) return "";
      var k9 = !t9.winner ? "t" : t9.winner === us ? "w" : "l";
      return "<i class='" + k9 + "'>" + k9.toUpperCase() + "</i>";
    }).join("");
    var ga = natGround(ST.nation);
    var windows9 = (snap.windows || [5, 9, 13]);
    var hour9 = (function(h9){try{return window.__foPlanet.hhTxt(h9);}catch(e9){return (h9<10?"0":"")+h9+":00";}})(snap.hourUtc == null ? 18 : snap.hourUtc);
    // THE SERIES THE CALENDAR DEALT - best of three, one game a window, over
    // three rest days. An older cached snapshot carried a single round; read
    // either so a stale localStorage copy still paints.
    var sLen9 = snap.seriesLen || 3;
    var tourRounds = n.tour ? (n.tour.rounds || (n.tour.round ? [n.tour.round] : [])) : [];
    var ser9 = (n.tour && n.tour.series) || null;
    var fmtR = function (v) { return Number(v || 0).toLocaleString("en-US"); };
    var hero = "<div class='fo-nt-bleed fo-nt-hero'>" +
      "<img class='bgart' src='" + ga.art + "' alt='' onerror=\"this.style.display='none'\"><span class='veil'></span>" +
      "<div class='fo-nt-in hin'>" +
      "<div><div class='kick'>The International Game</div>" +
      "<h2><img class='hfl' src='" + flagOf(ST.nation) + "' alt='' onerror=\"this.style.display='none'\"> " +
      E(n.name || ST.nation) + "</h2>" +
      "<div class='hf'>" +
      (natRank ? "<span>World rank<b>#" + natRank.rank + "</b></span>" : "") +
      (ga.name ? "<span>Home ground<b>" + E(ga.name) + "</b></span>" : "") +
      "<span>Squad<b>" + ((n.squad || []).length || "&mdash;") + " men</b></span>" +
      (n.worldCup ? "<span>This season<b>The World Cup</b></span>"
        : n.tour ? "<span>The series<b>Rounds " + tourRounds.join(", ") + " &middot; " +
            (n.tour.hosting ? "v " + E(n.tour.opp) + " at home" : "away to " + E(n.tour.opp)) + "</b></span>"
        : n.nextTour ? "<span>Next tour<b>Season " + n.nextTour.seasonNo + " &middot; " + E(n.nextTour.title || "") + "</b></span>"
        : "<span>Windows<b>Rounds " + windows9.join(", ") + "</b></span>") +
      "<span>Tours play<b>" + hour9 + "</b></span>" +
      "</div></div></div></div>";

    // ---- the tab band -------------------------------------------------------
    var TABS = [["overview", "Overview"], ["squad", "Squad"], ["tours", "Tours"],
      ["caps", "Caps Book"], ["window", "The Window"]];
    if (TABS.filter(function (t) { return t[0] === ST.tab; }).length === 0) ST.tab = "overview";
    var tabBar = "<div class='fo-nt-bleed fo-nt-tabs'><div class='fo-nt-in'>" +
      TABS.map(function (t) {
        return "<button type='button' class='" + (ST.tab === t[0] ? "on" : "") + "' data-nt-tab='" + t[0] + "'>" + t[1] + "</button>";
      }).join("") + "</div></div>";

    // ---- THE FRONT PAGE: stories the world actually wrote -------------------
    // Every headline traces to served state: a tour that was played, a squad
    // that was named, a rank the ladder holds, a cheque the window wrote.
    var stories = [];
    var lastTour = (n.tours || [])[ (n.tours || []).length - 1 ] || null;
    // THE SERIES AS IT STANDS - the server's own verdict on the banked games,
    // leading the page while a series is alive or just decided.
    if (ser9 && ser9.verdict) {
      var nextR9 = tourRounds[ser9.played];
      stories.push({ cat: "The Series &middot; " + E(n.tour.title), h: E(ser9.verdict),
        dek: "Game " + ser9.played + " of " + ser9.of + " has been bowled" +
          (ser9.done ? " and the rubber is settled &mdash; all three games are played, dead or alive."
            : nextR9 ? "; the next is played after the round-" + nextR9 + " window at " + hour9 + "." : ".") });
    } else if (lastTour) {
      stories.push({ cat: "The Tours", h: lastTour.text || (E(lastTour.a) + " v " + E(lastTour.b)),
        dek: E(lastTour.a) + " " + E(lastTour.as_ || "") + " v " + E(lastTour.b) + " " + E(lastTour.bs_ || "") +
          (n.tour && n.tour.title ? ". The tie the calendar dealt: " + E(n.tour.title) + "." : ".") });
    }
    // THE SERIES TO COME - the calendar's own fixture, printed before a ball
    // is bowled. Once games are banked the verdict story above replaces it.
    if (n.tour && !(ser9 && ser9.played) && !lastTour && !n.worldCup) {
      stories.push({ cat: "Fixtures &middot; Rounds " + tourRounds.join(", "), h: E(n.tour.title),
        dek: (n.tour.hosting ? E(n.name) + " host " + E(n.tour.opp) : E(n.name) + " travel to " + E(n.tour.opp)) +
          " for a best-of-three &mdash; one game after each of rounds " + tourRounds.join(", ") +
          ", the one series the calendar deals " + E(n.name) + " this season. The cricket is bowled at " + hour9 + "." });
    }
    // THE REST YEAR - half the world tours each season; the other half is
    // told, honestly, when its cricket comes back.
    if (!n.tour && !n.worldCup && n.nextTour) {
      stories.push({ cat: "The Calendar", h: E(n.name) + " rest this season",
        dek: "Half the world tours each season and " + E(n.name) + " are in the resting half. Their cricket returns in season " +
          n.nextTour.seasonNo + ": " + E(n.nextTour.title || "") + "." });
    }
    if (n.window && (n.squad || []).length) {
      var clubs9 = {}; (n.squad || []).forEach(function (m9) { if (m9.club) clubs9[m9.club] = 1; });
      var nClubs = Object.keys(clubs9).length;
      var capped = (n.squad || []).filter(function (m9) { return m9.caps > 0; }).length;
      stories.push({ cat: "Selection &middot; Round " + n.window,
        h: E(n.name) + " name " + (n.squad || []).length + " for the round-" + n.window + " window",
        dek: "The selectors have gone to " + (nClubs > 1 ? nClubs + " clubs" : "one club") + " for the squad" +
          (capped ? "; " + capped + " of the men have been capped before." : " &mdash; none of the men has yet been capped.") +
          " The tour is bowled at " + hour9 + "." });
    }
    if (mine && myMen.length) {
      stories.push({ cat: "The Window",
        h: E(myMen[0].name) + (myMen.length > 1 ? " and " + (myMen.length - 1) + " more" : "") +
          (myMen.length > 1 ? " pay " : "'s call-up pays ") + E(myClub) + " " + money(myMen.reduce(function (a, m) { return a + (m.fee || 0); }, 0)),
        dek: (myMen.length > 1 ? "Your men miss" : "Your man misses") + " the round on national duty &mdash; and the board writes the cheque the same morning." });
    }
    if (natRank) {
      stories.push({ cat: "The Ladder",
        h: E(n.name) + (natRank.natP ? " stand" : " start") + " #" + natRank.rank + " in the world",
        dek: natRank.natP
          ? "The national XI is rated " + fmtR(natRank.natRating) + "; the nation's club game " + fmtR(natRank.clubRating) + "."
          : "The XI is unproven \u2014 its rating begins to mean something the night the tours do." });
    }
    if ((n.caps || []).length) {
      var cl0 = n.caps[0];
      stories.push({ cat: "The Caps Book",
        h: E(cl0.name) + " leads the caps book on " + cl0.caps + " cap" + (cl0.caps === 1 ? "" : "s"),
        dek: (cl0.runs ? cl0.runs + " runs" + (cl0.hs ? " (best " + cl0.hs + ")" : "") : "") +
          (cl0.runs && cl0.wkts ? " and " : "") +
          (cl0.wkts ? cl0.wkts + " wickets" + (cl0.bb ? " (best " + cl0.bb.w + "-" + cl0.bb.r + ")" : "") : "") +
          (cl0.runs || cl0.wkts ? " in the country's colours." : "The first performances are still to be written.") });
    }
    if (pay) {
      var tot9 = (n.compensation || []).reduce(function (a, c9) { return a + (c9.paid || 0); }, 0);
      stories.push({ cat: "The Window",
        h: "The window pays the league " + money(tot9),
        dek: "$50,000 a senior, $20,000 a man under twenty-one &mdash; paid to the club each man was taken from." });
    }
    if (!stories.length) {
      stories.push({ cat: "Selection",
        h: n.worldCup ? "The World Cup owns the tour days this season"
          : "The selectors first meet at round " + windows9[0],
        dek: n.worldCup ? "No bilateral tours are played in a World Cup year - the bracket takes the six windows instead."
          : "Squads are named that morning; the tours are played at " + hour9 + " the same evening." });
    }
    var lead9 = stories.shift();
    var cardStories = stories.slice(0, 3);
    var leadHTML = "<div class='fo-nt-lead'>" +
      "<img src='" + natArt(ST.nation, 1) + "' alt='' onerror=\"this.style.display='none'\">" +
      "<div class='tx'><div class='fo-nt-cat'>" + lead9.cat + "</div><h3>" + lead9.h + "</h3>" +
      "<p class='fo-nt-dek'>" + lead9.dek + "</p>" +
      "<div class='fo-nt-when'>Season " + (n.seasonNo || 1) + "</div></div></div>";
    var cardsHTML = cardStories.length
      ? "<div class='fo-nt-g3'>" + cardStories.map(function (s9, i9) {
          return "<div class='fo-nt-story'><img src='" + natArt(ST.nation, i9 + 2) + "' alt='' onerror=\"this.style.display='none'\">" +
            "<div class='tx'><div class='fo-nt-cat'>" + s9.cat + "</div><h4>" + s9.h + "</h4>" +
            "<p class='fo-nt-dek'>" + s9.dek + "</p></div></div>";
        }).join("") + "</div>"
      : "";

    // ---- the rail -----------------------------------------------------------
    var rankTile = natRank
      ? "<div class='fo-nt-tile'><h3>World rankings</h3><div class='fo-nt-big'>#" + natRank.rank + "</div>" +
        (natRank.natRating ? "<div class='fo-nt-lab'>National XI<b>" + fmtR(natRank.natRating) + "</b></div>" : "") +
        (natRank.clubRating ? "<div class='fo-nt-lab'>Club game<b>" + fmtR(natRank.clubRating) + "</b></div>" : "") + "</div>"
      : "";
    var windowTile = "<div class='fo-nt-tile'><h3>" + (n.tour ? "The series" : "The window") + "</h3>" +
      (n.worldCup ? "<div class='fo-nt-lab' style='margin-top:0'>This season<b>The World Cup</b></div>"
        : n.tour ? "<div class='fo-nt-lab' style='margin-top:0'>This season<b>" + E(n.tour.title) + "</b></div>" +
          "<div class='fo-nt-lab'>Games after<b>Round" + (tourRounds.length === 1 ? " " : "s ") + tourRounds.join(", ") + "</b></div>" +
          "<div class='fo-nt-lab'>" + (n.tour.hosting ? "Hosting<b>" + E(n.tour.opp) + "</b>" : "Travelling to<b>" + E(n.tour.opp) + "</b>") + "</div>" +
          (ser9 && ser9.verdict ? "<div class='fo-nt-lab'>As it stands<b>" + E(ser9.verdict) + "</b></div>" : "")
        : n.nextTour ? "<div class='fo-nt-lab' style='margin-top:0'>Resting<b>until season " + n.nextTour.seasonNo + "</b></div>" +
          "<div class='fo-nt-lab'>Next<b>" + E(n.nextTour.title || "") + "</b></div>"
        : "") +
      (n.window ? "<div class='fo-nt-lab'" + (n.tour || n.worldCup || n.nextTour ? "" : " style='margin-top:0'") + ">Squad named for<b>Round " + n.window + "</b></div>" : "") +
      "<div class='fo-nt-lab'>Tours play<b>" + hour9 + "</b></div></div>";
    // the other nations' front pages, one honest line each
    var aroundRows = ids.filter(function (r2) { return r2 !== ST.nation; }).slice(0, 4).map(function (r2) {
      var n2 = snap.nations[r2] || {}, nm2 = n2.name || r2;
      var t2 = (n2.tours || [])[ (n2.tours || []).length - 1 ] || null;
      var s2 = (n2.tour && n2.tour.series) || null;
      var line = (s2 && s2.verdict) ? s2.verdict
        : t2 ? (t2.text || nm2 + "'s last tour")
        : (n2.tour && n2.tour.title) ? n2.tour.title + " · rounds " + (n2.tour.rounds || [n2.tour.round]).join(", ")
        : n2.nextTour ? nm2 + " rest until season " + n2.nextTour.seasonNo
        : (n2.window && (n2.squad || []).length) ? nm2 + " name " + n2.squad.length + " for round " + n2.window
        : nm2 + ": squads named at rounds " + windows9.join(", ");
      return "<button type='button' class='fo-nt-mini' data-nat='" + E(r2) + "'>" +
        "<img src='" + natArt(r2, 0) + "' alt='' onerror=\"this.style.display='none'\"><b>" + E(line) + "</b></button>";
    }).join("");
    var aroundTile = aroundRows ? "<div class='fo-nt-tile'><h3>Around the nations</h3>" + aroundRows + "</div>" : "";
    var rail = "<div class='fo-nt-rail'>" + rankTile + windowTile + (ST.tab === "overview" ? aroundTile : "") + "</div>";

    var squadCard = "<div class='fo-ac-card'><h3>" + natFlag + "The national squad" +
        "<span>" + (n.window ? "named for round " + n.window : "no squad yet") + "</span></h3>" +
        (squad || "<div class='fo-ac-note'>No squad has been named for this nation yet. Squads are named at rounds " +
          windows9.join(", ") + ".</div>") +
      "</div>";
    var capsCard = "<div class='fo-ac-card'><h3>The caps book<span>" + natFlag + E(n.name || "") + "</span></h3>" +
      (caps || "<div class='fo-ac-note'>No man has yet taken the field for " + E(n.name || "this nation") + ". The first cap is waiting to be won.</div>") + "</div>";
    var payCard = "<div class='fo-ac-card'><h3>What the window paid<span>season " + (n.seasonNo || 1) + "</span></h3>" +
        (pay ? "<div class='fo-nat-pay'>" + pay + "</div>" : "<div class='fo-ac-note'>No window has paid out yet.</div>") +
        "<div class='fo-ac-note'>$50,000 a senior, $20,000 a man under twenty-one &mdash; paid to the club he was taken from, every window.</div></div>";
    var toursCard = "<div class='fo-ac-card'><h3>The tours" + (formChips ? "<span>recent form</span>" : "") + "</h3>" +
        (formChips ? "<div class='fo-nt-form'>" + formChips + "</div>" : "") +
        (tours || "<div class='fo-ac-note'>" +
          (n.tour ? "No game of the series has been bowled yet &mdash; the first is played after the round-" +
              (tourRounds[0] || windows9[0]) + " window at " + hour9 + "."
            : n.nextTour ? E(n.name || "This nation") + " rest this season &mdash; their next series is season " +
              n.nextTour.seasonNo + ": " + E(n.nextTour.title || "") + "."
            : "No tour has been played yet &mdash; the first is bowled after the round-" +
              windows9[0] + " window at " + hour9 + ".") + "</div>") + "</div>";
    var mineCard = mine ? "<div class='fo-ac-card'><h3>Your men</h3>" +
        (myMen.length
          ? "<p class='fo-ac-p'>" + E(n.name) + " have taken <b>" + myMen.length + "</b> of " + E(myClub) + "'s cricketers for the latest window: " +
            E(myMen.map(function (m) { return m.name; }).join(", ")) + ". They miss the round, and the board pays you " +
            money(myMen.reduce(function (a, m) { return a + (m.fee || 0); }, 0)) + " for the week.</p>"
          : "<p class='fo-ac-p'>Nobody from " + E(myClub) + " is in the latest " + E(n.name) + " squad. Form is what the selectors read &mdash; win a few and they will look again.</p>") +
        "</div>" : "";
    var whenNote = "<div class='fo-nat-when'>" +
      (n.worldCup
        ? "The <b>World Cup</b> owns the tour days this season - no bilateral tours are played."
        : "The tour days fall on rounds <b>" + windows9.join(", ") + "</b>. <b>Half the world tours each season</b> - " +
          "a touring nation plays <b>one best-of-" + sLen9 + " series</b> over three of those days, the other half rests " +
          "and tours the following season, so a club never loses its internationals more than one series a year." +
          (n.tour ? " The calendar deals " + E(n.name || "") + " <b>rounds " + tourRounds.join(", ") + "</b>: " + E(n.tour.title) + "." :
           n.nextTour ? " " + E(n.name || "") + " rest this season; their next series is <b>season " + n.nextTour.seasonNo + "</b>: " + E(n.nextTour.title || "") + "." : "") +
          " Squads are named for the series' first game and stand for all three; the cricket is bowled at <b>" + hour9 + "</b>.") +
      "</div>";

    var mainCol =
      ST.tab === "squad" ? squadCard :
      ST.tab === "tours" ? toursCard :
      ST.tab === "caps" ? capsCard :
      ST.tab === "window" ? (payCard + mineCard + whenNote) :
      (leadHTML + cardsHTML);

    page.innerHTML = "<div class='fo-nt-bleed' data-fo-owntable><div class='fo-nt-in' style='padding-top:10px;padding-bottom:10px'>" +
      flags + "</div></div>" +
      hero + tabBar +
      "<div class='fo-nt-bleed'><div class='fo-nt-in'>" +
      "<div class='fo-nt-wrap'><div class='fo-nt-main'>" + mainCol + "</div>" + rail + "</div>" +
      "<div class='fo-nt-foot fo-ac-foot'><a href='#/planet'>&lsaquo; World cricket</a><a href='#/rankings'>The world rankings &rsaquo;</a></div>" +
      "</div></div>" +
      howItWorks();

    page.querySelectorAll("[data-nat]").forEach(function (b) {
      b.addEventListener("click", function () {
        ST.nation = b.getAttribute("data-nat");
        render(page, snap, st);
        try { page.scrollIntoView({ block: "start" }); } catch (e) {}
      });
    });
    page.querySelectorAll("[data-nt-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        ST.tab = b.getAttribute("data-nt-tab");
        render(page, snap, st);
      });
    });
  }

  function tieRow(t) {
    var win = function (side) { return t.winner === side ? " w" : ""; };
    return "<div class='fo-nat-tie'><b class='" + win(t.a) + "'>" + E(t.a) + "</b><u>" + E(t.as_ || "") + "</u>" +
      "<em>v</em><b class='" + win(t.b) + "'>" + E(t.b) + "</b><u>" + E(t.bs_ || "") + "</u>" +
      (t.text ? "<i>" + E(t.text) + "</i>" : "") + "</div>";
  }

  function howItWorks() { return ""; }
})();

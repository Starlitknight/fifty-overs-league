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

  var ST = { nation: null };

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
      "html body #page .fo-nat-man{display:flex;align-items:baseline;gap:9px;padding:9px 2px;border-top:1px solid rgba(20,28,40,.07);font:500 13px/1.3 Inter,sans-serif}",
      "html body #page .fo-nat-flag{width:19px;height:13px;flex:0 0 auto;object-fit:cover;border-radius:2px;align-self:center;box-shadow:0 0 0 1px rgba(20,28,40,.12)}",
      "html body #page .fo-ac-card h3 .fo-nat-flag{width:22px;height:15px;margin-right:8px;vertical-align:-2px}",
      "html body #page .fo-ac-card h3 span .fo-nat-flag{width:17px;height:12px;margin-right:6px}",
      "html body #page .fo-nat-man:first-of-type{border-top:0}",
      "html body #page .fo-nat-man i{font-style:normal;font:700 10px/1 Oswald,sans-serif;color:rgba(20,28,40,.35);width:16px}",
      "html body #page .fo-nat-man b{font-weight:600;color:#141C28}",
      "html body #page .fo-nat-man span{flex:1;font-size:11px;color:rgba(20,28,40,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-nat-man u{text-decoration:none;font:700 9px/1 Oswald,sans-serif;letter-spacing:.1em;color:rgba(20,28,40,.4);white-space:nowrap}",
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
      "html body #page .fo-nat-tie i{flex:1 0 100%;font-style:italic;font-size:11px;color:rgba(20,28,40,.5)}",
      "html body #page .fo-nat-pay{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}",
      "html body #page .fo-nat-pay span{font:500 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.62);background:rgba(20,28,40,.06);border-radius:999px;padding:6px 10px}",
      "html body #page .fo-nat-pay span.mine{background:rgba(232,185,106,.32);color:#6B520F;font-weight:700}",
      "html body #page .fo-nat-when{margin:2px 0 8px;padding:11px 13px;background:rgba(11,29,58,.05);border:1px solid rgba(11,29,58,.18);border-left:3px solid #0B1D3A;border-radius:12px;font:500 12px/1.55 Inter,sans-serif;color:rgba(20,28,40,.75)}",
      "html body #page .fo-nat-when b{color:#0B1D3A}"
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

  window.foRenderNationsPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Asking the selectors&hellip;</div>");
    Promise.all([
      snapshot("nations"),
      jwt() ? rpc("world_my_status") : Promise.resolve(null)
    ]).then(function (d) {
      render(page, d[0], d[1]);
    }).catch(function (e) {
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
        "<img src='" + flagOf(rid) + "' alt=''><span>" + E(rid) + "</span></button>";
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
    var natFlag = "<img class='fo-nat-flag' src='" + flagOf(ST.nation) + "' alt='" + E(n.name || ST.nation) +
      "' onerror=\"this.style.display='none'\">";
    var squad = (n.squad || []).map(function (m, i) {
      var isMine = myClub && m.club === myClub;
      return manRow("fo-nat-man" + (isMine ? " mine" : ""),
        "<i>" + (i + 1) + "</i>" + natFlag +
        "<b>" + E(m.name) + "</b><span>" + E(m.club || "") +
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
        "<i>" + (i + 1) + "</i>" + natFlag + "<b>" + E(c.name) + "</b>" +
        "<span>" + c.caps + " cap" + (c.caps === 1 ? "" : "s") +
        (c.runs ? " &middot; " + c.runs + " runs" + (c.hs ? " (" + c.hs + " best)" : "") : "") +
        (c.wkts ? " &middot; " + c.wkts + " wickets" + (c.bb ? " (" + c.bb.w + "-" + c.bb.r + ")" : "") : "") +
        "</span>",
        c.name, (((n.squad || []).filter(function (m2) { return m2.name === c.name; })[0]) || {}).slot);
    }).join("");

    var myMen = mine ? (n.squad || []).filter(function (m) { return m.club === myClub; }) : [];

    page.innerHTML = shell(
      (mine ? "<div class='fo-ac-card'><h3>Your men</h3>" +
        (myMen.length
          ? "<p class='fo-ac-p'>" + E(n.name) + " have taken <b>" + myMen.length + "</b> of " + E(myClub) + "'s cricketers for the latest window: " +
            E(myMen.map(function (m) { return m.name; }).join(", ")) + ". They miss the round, and the board pays you " +
            money(myMen.reduce(function (a, m) { return a + (m.fee || 0); }, 0)) + " for the week.</p>"
          : "<p class='fo-ac-p'>Nobody from " + E(myClub) + " is in the latest " + E(n.name) + " squad. Form is what the selectors read &mdash; win a few and they will look again.</p>") +
        "</div>" : "") +
      "<div class='fo-ac-card'><h3>The nations</h3>" + flags +
        "<div class='fo-nat-when'>Windows fall on rounds <b>" + (snap.windows || [5, 9, 13]).join(", ") +
        "</b>. Squads are named that morning; the tours are played at <b>" +
        (snap.hourUtc == null ? 18 : snap.hourUtc) + ":00 UTC</b> the same evening.</div>" +
      "</div>" +
      "<div class='fo-ac-card'><h3>" + natFlag + E(n.name || ST.nation) +
        "<span>" + (n.window ? "named for round " + n.window : "no squad yet") + "</span></h3>" +
        (squad || "<div class='fo-ac-note'>No squad has been named for this nation yet.</div>") +
      "</div>" +
      (pay ? "<div class='fo-ac-card'><h3>What the window paid<span>season " + (n.seasonNo || 1) + "</span></h3>" +
        "<div class='fo-nat-pay'>" + pay + "</div>" +
        "<div class='fo-ac-note'>$50,000 a senior, $20,000 a man under twenty-one &mdash; paid to the club he was taken from, every window.</div></div>" : "") +
      (tours ? "<div class='fo-ac-card'><h3>The tours</h3>" + tours + "</div>" : "") +
      (caps ? "<div class='fo-ac-card'><h3>The caps book<span>" + natFlag + E(n.name || "") + "</span></h3>" + caps + "</div>" : "") +
      howItWorks());

    page.querySelectorAll("[data-nat]").forEach(function (b) {
      b.addEventListener("click", function () {
        ST.nation = b.getAttribute("data-nat");
        render(page, snap, st);
        try { page.scrollIntoView({ block: "start" }); } catch (e) {}
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

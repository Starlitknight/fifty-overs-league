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


  function A() { return window.AL || null; }
  function onNat() { var h = (location.hash || "").split("?")[0]; return h === "#/nations" || h === "#/natteams"; }
  function mast(al) {
    return al.head("The international game", "Playing For Your Country",
      "Three rounds a season the selectors take the best men in the land, wherever they play. Your club loses " +
      "them for the day and is paid for the week — and that evening the nations play each other.");
  }

  window.foRenderNationsPage = function () {
    if (!onNat()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e0) {}
    page.innerHTML = al.page({ body: mast(al) + al.empty("Asking the selectors", "Reading the squads.") });
    Promise.all([
      snapshot("nations"),
      jwt() ? rpc("world_my_status") : Promise.resolve(null)
    ]).then(function (d) { if (onNat()) render(page, d[0], d[1]); })
      .catch(function (e) {
        if (!onNat()) return;
        page.innerHTML = al.page({ body: mast(al) + al.empty("The world could not be reached",
          String((e && e.message) || e).slice(0, 120) + ". Try again in a minute.") });
      });
  };

  // PHASE 4 OF THE ALMANACK. Nineteen flags in a scroller, a fifteen, what the
  // window paid, the tours and the caps book - all of it read-only, all of it
  // a list, so all of it is ruled type now. The flags stay: a page about
  // nations without them reads as a spreadsheet.
  function render(page, snap, st) {
    var al = A(); if (!al || !onNat()) return;
    var mine = st && st.claim ? st.claim : null;
    var body = mast(al) + al.subnav("nations");

    if (!snap || !snap.nations) {
      page.innerHTML = al.page({ body: body + al.empty("The selectors have not met yet",
        "Squads are named on the morning of the first international window — round 5 of the season — and " +
        "again at rounds 9 and 13.") + howItWorks(al) });
      return;
    }

    var ids = Object.keys(snap.nations).sort();
    if (!ST.nation || ids.indexOf(ST.nation) < 0) ST.nation = (mine && mine.country) || (ids.indexOf("eng") >= 0 ? "eng" : ids[0]);
    var n = snap.nations[ST.nation] || {};
    var myClub = mine ? mine.club : null;
    var myMen = mine ? (n.squad || []).filter(function (m) { return m.club === myClub; }) : [];

    // what this page means to YOUR club, before what it means to the world
    if (mine) {
      body += al.decide({
        kind: myMen.length ? "act" : "done",
        title: myMen.length
          ? (n.name || ST.nation) + " have taken " + myMen.length + " of your men"
          : "Nobody from " + myClub + " is in the latest squad",
        note: myMen.length
          ? myMen.map(function (m) { return m.name; }).join(", ") + " miss the round; the board pays you " +
            money(myMen.reduce(function (a, m) { return a + (m.fee || 0); }, 0)) + " for the week."
          : "Form is what the selectors read — win a few and they will look again.",
      });
    }

    body += '<div class="al-flags">' + ids.map(function (rid) {
      return '<button type="button" class="al-flag' + (rid === ST.nation ? " al-flag--on" : "") +
        '" data-nat="' + rid + '"><img src="' + flagOf(rid) + '" alt=""><span>' + E(rid) + "</span></button>";
    }).join("") + "</div>";

    body += al.sec("When they play", al.ledger([
      ["Windows", "rounds " + (snap.windows || [5, 9, 13]).join(", ")],
      ["Squads named", "the morning of the window"],
      ["The tours", (snap.hourUtc == null ? 18 : snap.hourUtc) + ":00 UTC that evening"],
    ]));

    body += al.sec((n.name || ST.nation) + " · " + (n.window ? "named for round " + n.window : "no squad yet"),
      (n.squad || []).length
        ? '<div class="al-players">' + (n.squad || []).map(function (m, i) {
            var isMine = myClub && m.club === myClub;
            return '<div class="al-prow al-prow--static' + (isMine ? " al-prow--picked" : "") + '">' +
              '<span class="al-prow__no">' + (i + 1) + "</span>" +
              '<span class="al-prow__who"><b>' + E(m.name) + "</b><i>" + E(m.club || "") +
                (m.age ? " · " + m.age : "") + "</i></span>" +
              '<span class="al-prow__rate">' + (m.caps ? m.caps + (m.caps === 1 ? " cap" : " caps") : "uncapped") +
              "</span></div>";
          }).join("") + "</div>"
        : al.empty("No squad named", "This nation's selectors have not sat yet."));

    if ((n.compensation || []).length) {
      body += al.sec("What the window paid · season " + (n.seasonNo || 1),
        al.ledger((n.compensation || []).map(function (c) {
          return [c.club || ("club " + c.slot), money(c.paid), myClub && c.club === myClub ? "pos" : ""];
        })) +
        '<p class="al-read">$50,000 a senior, $20,000 a man under twenty-one — paid to the club he was taken ' +
        "from, every window.</p>");
    }

    if ((n.tours || []).length) {
      body += al.sec("The tours", al.ledger((n.tours || []).map(function (t) {
        return [(t.home || "") + " v " + (t.away || ""), String(t.text || t.result || "—")];
      })));
    }

    if ((n.caps || []).length) {
      body += al.sec("The caps book · " + (n.name || ""), al.ledger((n.caps || []).map(function (c) {
        return [c.name, c.caps + (c.caps === 1 ? " cap" : " caps") +
          (c.runs ? " · " + c.runs + " runs" : "") + (c.wkts ? " · " + c.wkts + " wkts" : "")];
      })));
    }

    body += howItWorks(al);
    page.innerHTML = al.page({ body: body });

    page.querySelectorAll("[data-nat]").forEach(function (b) {
      b.addEventListener("click", function () {
        ST.nation = b.getAttribute("data-nat");
        render(page, snap, st);
      });
    });
  }

  function howItWorks(al) {
    return al.sec("How the window works",
      "<p>The selectors name <b>fifteen</b>: the gloves first, then six bowlers, then the best of the rest — and " +
      "never more than <b>three men from any one club</b>, so a squad always leaves a side twelve to pick from. " +
      "What they read is a cricketer's card and the nick he is in, which is the whole reason league form matters.</p>" +
      "<p>A man who goes is <b>not available to his club</b> that round, and he does not work in its nets that " +
      "week either. He comes back with a cap, tired legs, and whatever the tour did to his form. If a teamsheet " +
      "you filed a fortnight ago still names him, nothing is torn up: the umpire sends out the best man left in " +
      "his place, batting where he batted and bowling his overs.</p>" +
      "<p>Nineteen nations make <b>nine ties and one week off</b>. The draw is settled by the world day itself, " +
      "so a country with no fixture calls nobody up at all, and its clubs keep their men.</p>" +
      "<p>Nothing here needs anybody awake. The squad is named by the umpire, the tour is played by the umpire, " +
      "and the cheque is in the books the next time you look at them.</p>");
  }
})();

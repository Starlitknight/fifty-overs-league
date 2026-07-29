/* ============================================================================
   THE INVITATIONALS (#/comps) — competitions managers make themselves.

   Found one, name it, choose a cup or a round robin at four clubs or eight,
   and other managers join. Three days later enrolment closes and the umpire
   takes it over: it fills any empty seats with bot clubs so a half-subscribed
   competition still gets played, and settles a round a day on the real engine
   from the squads as they stand. There is nothing to submit and nothing to
   miss - which is the only way a competition works in a world where half the
   managers are asleep.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foInv) return; window.__foInv = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var EPOCH = Date.UTC(2026, 6, 28), DAY = 86400000;
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function today() { return Math.floor((Date.now() - EPOCH) / DAY); }
  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (jwt() || SB_ANON), "content-type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw new Error((d && (d.message || d.hint)) || t || ("HTTP " + r.status));
      return d;
    }); });
  }
  function sel(path) {
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  var ST = { format: "cup", size: 4, busy: false };

  function A() { return window.AL || null; }
  function onComps() { return (location.hash || "").split("?")[0] === "#/comps"; }
  function mast(al) {
    return al.mast("The invitationals", "Competitions of Your Own",
      "Found one, name it, and see who turns up. Three days later the umpire fills whatever seats are empty and " +
      "plays it out, a round a day, whether anybody is watching or not.");
  }

  window.foRenderCompsPage = function () {
    if (!onComps()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e0) {}
    page.innerHTML = al.page({ body: mast(al) + al.empty("Reading the fixture board", "Asking who is playing what.") });
    Promise.all([
      sel("world_comps?select=*&order=id.desc&limit=40"),
      sel("world_comp_clubs?select=*&order=comp_id,seat"),
      sel("world_snapshots?key=eq.comps&select=body"),
      jwt() ? rpc("world_my_status").catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (d) {
      if (onComps()) render(page, d[0] || [], d[1] || [], (d[2] && d[2][0] && d[2][0].body) || { comps: [] }, d[3]);
    }).catch(function (e) {
      if (!onComps()) return;
      page.innerHTML = al.page({ body: mast(al) + al.empty("The world could not be reached",
        String((e && e.message) || e).slice(0, 120) + ". Try again in a minute.") });
    });
  };

  // PHASE 4 OF THE ALMANACK. Founding a competition is the one thing on this
  // page a manager DOES, so it leads; the boards below it are lists, and lists
  // are ruled type. Every RPC and every rule is untouched.
  function render(page, comps, clubs, snap, st) {
    var al = A(); if (!al || !onComps()) return;
    var mine = st && st.claim ? st.claim : null;
    var myKey = mine ? mine.country + ":" + mine.slot : null;
    var bySide = {};
    clubs.forEach(function (c) { (bySide[c.comp_id] = bySide[c.comp_id] || []).push(c); });
    var cards = {};
    (snap.comps || []).forEach(function (c) { cards[c.id] = c; });

    var open = comps.filter(function (c) { return c.status === "open"; });
    var live = comps.filter(function (c) { return c.status === "running"; });
    var done = comps.filter(function (c) { return c.status === "done"; });
    var inAny = open.concat(live).filter(function (c) {
      return (bySide[c.id] || []).some(function (s2) { return s2.country_id + ":" + s2.slot === myKey; });
    }).length;

    var body = mast(al) + al.subnav("comps");

    body += al.decide({
      kind: mine ? (inAny ? "done" : "act") : "act",
      title: !mine ? "You need a club in the served world"
        : inAny ? "You are in " + inAny + " competition" + (inAny === 1 ? "" : "s")
        : open.length ? open.length + " open for entries" : "Nothing taking entries",
      note: !mine ? "Claim one and you can found competitions and enter them."
        : "You can run two at a time, and pull out of one that has not started.",
      action: mine ? null : { href: "#/worldclub", label: "Claim a club" },
      primary: !mine,
    });

    // ---- found one: the page's only decision -----------------------------
    if (mine) {
      var seg = function (k, v, label) {
        return '<button type="button" class="al-btn ' + (ST[k] == v ? "al-btn--primary" : "") +
          '" data-fo-seg="' + k + '" data-v="' + v + '">' + label + "</button>";
      };
      body += al.sec("Found one",
        '<input class="al-field al-field--block" id="fo-inv-nm" maxlength="40" placeholder="Name it — The Potato Bowl">' +
        '<div class="al-lot__act">' + seg("format", "cup", "Cup") + seg("format", "league", "Round robin") + "</div>" +
        '<div class="al-lot__act">' + seg("size", 4, "Four clubs") + seg("size", 8, "Eight clubs") + "</div>" +
        '<div class="al-lot__act"><button type="button" class="al-btn al-btn--primary" id="fo-inv-found">Put it on</button></div>' +
        '<p class="al-read">Entries stay open for three days. Whoever is in when they shut is in; the umpire ' +
        "finds the rest.</p>");
    }

    // ---- open for entries --------------------------------------------------
    body += al.sec("Open for entries · " + open.length, open.length
      ? '<div class="al-lots">' + open.map(function (c) {
          var side = bySide[c.id] || [];
          var left = Math.max(0, (c.open_until_day | 0) - today());
          var inIt = side.some(function (s2) { return s2.country_id + ":" + s2.slot === myKey; });
          var full = (+c.entered || 0) >= (+c.size || 0);
          var btn = !myKey ? ""
            : inIt ? '<button type="button" class="al-btn" data-fo-leave="' + c.id + '">Pull out</button>'
            : full ? al.tag("Full")
            : '<button type="button" class="al-btn al-btn--primary" data-fo-join="' + c.id + '">Join</button>';
          return '<div class="al-lot' + (inIt ? " al-lot--mine" : "") + '">' +
            '<div class="al-lot__h"><b>' + E(c.name) + "</b>" +
            '<span class="al-lot__clock' + (left <= 1 ? " al-lot__clock--soon" : "") + '">' +
              (left > 0 ? "closes in " + left + " day" + (left === 1 ? "" : "s") : "closes today") + "</span></div>" +
            '<p class="al-lot__line">' + (c.format === "cup" ? "Knockout cup" : "Round robin") + " · " +
              c.entered + " of " + c.size + " seats taken" +
              (side.length ? "<br>" + side.map(function (s2) { return E(s2.name); }).join(" · ") : "") + "</p>" +
            (btn ? '<div class="al-lot__act">' + btn + "</div>" : "") + "</div>";
        }).join("") + "</div>"
      : al.empty("Nothing taking entries", "Found one and the world will see it."));

    // ---- being played, and finished -----------------------------------------
    [["Being played", live], ["Finished", done.slice(0, 6)]].forEach(function (pair) {
      if (!pair[1].length) return;
      body += al.sec(pair[0] + " · " + pair[1].length, pair[1].map(function (c) {
        return comp(al, cards[c.id] || c, bySide[c.id] || []);
      }).join(""));
    });

    body += al.sec("How it works",
      "<p>A competition takes entries for <b>three world days</b>. When that window shuts the umpire fills any " +
      "empty seats with clubs nobody manages — so a competition that only you and one friend joined still gets " +
      "played, properly, against real sides.</p>" +
      "<p>From then on it settles <b>a round a day</b> on the same engine as the leagues, picking each side from " +
      "the squad as it stands. There is no teamsheet to file and no deadline to miss. A cup pairs top seat " +
      "against bottom and halves until somebody is holding it; a round robin plays everyone once and the table " +
      "decides.</p>");

    page.innerHTML = al.page({ body: body });
    wire(page);
  }

  // a competition being played, or one that has been won
  function comp(al, c, side) {
    var head = '<p class="al-lot__line"><b>' + E(c.name) + "</b> · " +
      (c.format === "cup" ? "Knockout cup" : "Round robin") + " · " + (c.size || (c.clubs || []).length) + " clubs" +
      (c.rounds ? " · round " + Math.min(c.roundsPlayed || 0, c.rounds) + " of " + c.rounds : "") + "</p>";
    if (!c.results) {
      return head + (side.length ? '<p class="al-read">' + side.map(function (s2) { return E(s2.name); }).join(" · ") + "</p>" : "");
    }
    var body;
    if (c.format === "league") {
      body = "<div class='al-tblwrap'><table class='al-tbl'><thead><tr><th></th><th class='l'>Club</th>" +
        "<th>P</th><th>W</th><th class='al-s'>L</th><th>Pts</th></tr></thead><tbody>" +
        (c.table || []).map(function (t, i) {
          return "<tr><td class='al-pos'>" + (i + 1) + "</td><td class='l al-club'>" + E(t.name) +
            (t.managed ? "" : " ·") + "</td><td>" + t.p + "</td><td>" + t.w + "</td>" +
            "<td class='al-s'>" + t.l + "</td><td class='al-pts'>" + t.pts + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    } else {
      var by = {};
      c.results.forEach(function (r) { (by[r.round] = by[r.round] || []).push(r); });
      body = Object.keys(by).sort(function (a, b) { return a - b; }).map(function (rd) {
        var nm = +rd === (c.rounds || 0) ? "The final" : (c.rounds - rd === 1 ? "Semi-finals" : "Round " + rd);
        var sc = function (x) { return x ? x.r + "/" + x.w : "—"; };
        return '<p class="al-read">' + nm + "</p>" + al.ledger(by[rd].map(function (r) {
          return [r.a + " v " + r.b, sc(r.as) + " · " + sc(r.bs), r.winner ? "pos" : ""];
        }));
      }).join("");
    }
    return head + body + (c.champion ? '<p class="al-read">' + E(c.champion) + " hold it.</p>" : "");
  }

  function wire(page) {
    page.querySelectorAll("[data-fo-seg]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-fo-seg");
        ST[k] = k === "size" ? +b.getAttribute("data-v") : b.getAttribute("data-v");
        var nm = ""; try { nm = document.getElementById("fo-inv-nm").value; } catch (e) {}
        window.foRenderCompsPage();
        setTimeout(function () { try { document.getElementById("fo-inv-nm").value = nm; } catch (e) {} }, 0);
      });
    });
    var found = page.querySelector("#fo-inv-found");
    if (found) found.addEventListener("click", function () {
      var nm = ""; try { nm = document.getElementById("fo-inv-nm").value.trim(); } catch (e) {}
      if (nm.length < 3) { alert("Give it a name of three letters or more."); return; }
      found.disabled = true; found.textContent = "Putting it on…";
      rpc("world_comp_found", { p_name: nm, p_format: ST.format, p_size: ST.size })
        .then(function () { window.foRenderCompsPage(); })
        .catch(function (e) { found.disabled = false; found.textContent = "Put it on"; alert(String(e.message).slice(0, 160)); });
    });
    var act = function (attr, fn, label) {
      page.querySelectorAll("[" + attr + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled) return; b.disabled = true; b.textContent = "…";
          rpc(fn, { p_id: +b.getAttribute(attr) })
            .then(function () { window.foRenderCompsPage(); })
            .catch(function (e) { b.disabled = false; b.textContent = label; alert(String(e.message).slice(0, 160)); });
        });
      });
    };
    act("data-fo-join", "world_comp_join", "Join");
    act("data-fo-leave", "world_comp_leave", "Pull out");
  }
})();

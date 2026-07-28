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
  function css() {
    try { if (window.__foRoomCss) window.__foRoomCss(); } catch (e) {}
    if (document.getElementById("fo-inv-css")) return;
    var s = document.createElement("style"); s.id = "fo-inv-css";
    s.textContent = [
      "html body #page .fo-inv-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 0;border-top:1px solid rgba(20,28,40,.08)}",
      "html body #page .fo-inv-row:first-of-type{border-top:0}",
      "html body #page .fo-inv-row>div{flex:1 1 160px;min-width:0}",
      "html body #page .fo-inv-row b{display:block;font:600 14px/1.25 Inter,sans-serif;color:#141C28}",
      "html body #page .fo-inv-row i{display:block;font-style:normal;font:500 11px/1.45 Inter,sans-serif;color:rgba(20,28,40,.55);margin-top:2px}",
      "html body #page .fo-inv-pill{flex:none;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#FFFEFC;background:#8A6A1F;border-radius:999px;padding:5px 9px}",
      "html body #page .fo-inv-pill.run{background:#177A57}",
      "html body #page .fo-inv-pill.done{background:#141C28}",
      "html body #page .fo-inv-seg{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}",
      "html body #page .fo-inv-seg button{font:700 10px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.6) !important;background:transparent !important;border:1px solid rgba(20,28,40,.2) !important;border-radius:999px !important;padding:9px 14px !important;cursor:pointer}",
      "html body #page .fo-inv-seg button.on{color:#FFFEFC !important;background:#141C28 !important;border-color:#141C28 !important}",
      "html body #page .fo-inv-name{width:100%;font:500 13px/1.2 Inter,sans-serif;border:1px solid rgba(20,28,40,.18);border-radius:10px;padding:11px 12px;background:#fff;color:#141C28;margin-bottom:2px}",
      "html body #page .fo-inv-field{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}",
      "html body #page .fo-inv-field span{font:500 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.6);background:rgba(20,28,40,.06);border-radius:999px;padding:6px 9px}",
      "html body #page .fo-inv-field span.me{background:rgba(232,185,106,.3);color:#6B520F;font-weight:700}",
      "html body #page .fo-inv-field span.bot{opacity:.6;font-style:italic}",
      "html body #page .fo-inv-tie{display:flex;align-items:center;gap:7px;padding:6px 0;border-top:1px solid rgba(20,28,40,.06);font:500 11.5px/1.35 Inter,sans-serif;flex-wrap:wrap}",
      "html body #page .fo-inv-tie u{text-decoration:none;color:rgba(20,28,40,.5);font-variant-numeric:tabular-nums}",
      "html body #page .fo-inv-tie b{color:#141C28;font-weight:600}",
      "html body #page .fo-inv-tie b.w{color:#177A57}",
      "html body #page .fo-inv-tie em{font-style:normal;color:rgba(20,28,40,.35);font-size:10px}",
      "html body #page .fo-inv-champ{margin-top:9px;padding:10px 12px;background:rgba(232,185,106,.18);border:1px solid rgba(138,106,31,.35);border-radius:12px;font:600 13px/1.4 Inter,sans-serif;color:#6B520F}",
      "html body #page .fo-ac-tbl th{white-space:nowrap}",
      "html body #page .fo-ac-tbl th.pt{padding-left:10px}",
      "html body #page .fo-inv-rd{margin:12px 0 4px;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.4)}"
    ].join("\n");
    document.head.appendChild(s);
  }

  var ST = { format: "cup", size: 4, busy: false };

  window.foRenderCompsPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Reading the fixture board&hellip;</div>");
    Promise.all([
      sel("world_comps?select=*&order=id.desc&limit=40"),
      sel("world_comp_clubs?select=*&order=comp_id,seat"),
      sel("world_snapshots?key=eq.comps&select=body"),
      jwt() ? rpc("world_my_status").catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (d) {
      render(page, d[0] || [], d[1] || [], (d[2] && d[2][0] && d[2][0].body) || { comps: [] }, d[3]);
    }).catch(function (e) {
      page.innerHTML = shell("<div class='fo-ac-note'>The world could not be reached (" +
        E(String(e.message).slice(0, 90)) + "). Try again in a minute.</div>");
    });
  };

  function shell(body) {
    return "<div class='fo-ac' data-fo-owntable><div class='fo-ac-in'>" +
      "<div class='fo-ac-hero'><div class='fo-ac-k'>The invitationals</div>" +
      "<h1>Competitions of Your Own</h1>" +
      "<p>Found one, name it, and see who turns up. Three days later the umpire fills whatever seats are empty and plays it out, a round a day, whether anybody is watching or not.</p></div>" +
      body +
      "<div class='fo-ac-foot'><a href='#/worldclub'>&lsaquo; Your world club</a><a href='#/planet'>World cricket &rsaquo;</a></div>" +
      "</div></div>";
  }

  function render(page, comps, clubs, snap, st) {
    var mine = st && st.claim ? st.claim : null;
    var myKey = mine ? mine.country + ":" + mine.slot : null;
    var bySide = {};
    clubs.forEach(function (c) { (bySide[c.comp_id] = bySide[c.comp_id] || []).push(c); });
    var cards = {};
    (snap.comps || []).forEach(function (c) { cards[c.id] = c; });

    var open = comps.filter(function (c) { return c.status === "open"; });
    var live = comps.filter(function (c) { return c.status === "running"; });
    var done = comps.filter(function (c) { return c.status === "done"; });

    page.innerHTML = shell(
      (mine ? foundCard() : "<div class='fo-ac-card'><h3>Found one</h3>" +
        "<p class='fo-ac-p'>You need a club in the served world before you can put a competition on.</p>" +
        "<a class='fo-ac-btn' href='#/worldclub'>Claim a club &rsaquo;</a></div>") +
      "<div class='fo-ac-card'><h3>Open for entries<span>" + open.length + "</span></h3>" +
        (open.length ? open.map(function (c) { return openRow(c, bySide[c.id] || [], myKey); }).join("")
          : "<div class='fo-ac-note'>Nothing taking entries. Found one and the world will see it.</div>") +
      "</div>" +
      (live.length ? "<div class='fo-ac-card'><h3>Being played<span>" + live.length + "</span></h3>" +
        live.map(function (c) { return compCard(cards[c.id] || c, myKey, bySide[c.id] || []); }).join("") + "</div>" : "") +
      (done.length ? "<div class='fo-ac-card'><h3>Finished<span>" + done.length + "</span></h3>" +
        done.slice(0, 6).map(function (c) { return compCard(cards[c.id] || c, myKey, bySide[c.id] || []); }).join("") + "</div>" : "") +
      "<div class='fo-ac-card'><h3>How it works</h3>" +
        "<p class='fo-ac-p'>A competition takes entries for <b>three world days</b>. When that window shuts the umpire fills any empty seats with clubs nobody manages &mdash; so a competition that only you and one friend joined still gets played, properly, against real sides.</p>" +
        "<p class='fo-ac-p'>From then on it settles <b>a round a day</b> on the same engine as the leagues, picking each side from the squad as it stands. There is no teamsheet to file and no deadline to miss. A cup pairs top seat against bottom and halves until somebody is holding it; a round robin plays everyone once and the table decides.</p>" +
        "<p class='fo-ac-p'>You can run two at a time, and you can pull out of one that hasn't started. Once it has, you play it out.</p>" +
      "</div>");

    wire(page);
  }

  function foundCard() {
    var seg = function (k, v, label) {
      return "<button type='button' data-fo-seg='" + k + "' data-v='" + v + "' class='" + (ST[k] == v ? "on" : "") + "'>" + label + "</button>";
    };
    return "<div class='fo-ac-card'><h3>Found one</h3>" +
      "<input class='fo-inv-name' id='fo-inv-nm' maxlength='40' placeholder='Name it &mdash; The Potato Bowl'>" +
      "<div class='fo-inv-seg'>" + seg("format", "cup", "Cup") + seg("format", "league", "Round robin") + "</div>" +
      "<div class='fo-inv-seg'>" + seg("size", 4, "Four clubs") + seg("size", 8, "Eight clubs") + "</div>" +
      "<button type='button' class='fo-ac-btn' id='fo-inv-found'>Put it on</button>" +
      "<div class='fo-ac-note'>Entries stay open for three days. Whoever is in when they shut is in; the umpire finds the rest.</div>" +
      "</div>";
  }

  function openRow(c, side, myKey) {
    var left = Math.max(0, (c.open_until_day | 0) - today());
    var inIt = side.some(function (s) { return s.country_id + ":" + s.slot === myKey; });
    var full = (+c.entered || 0) >= (+c.size || 0);
    var btn = !myKey ? ""
      : inIt ? "<button type='button' class='fo-ac-btn off' data-fo-leave='" + c.id + "'>Pull out</button>"
      : full ? "<span class='fo-inv-pill'>Full</span>"
      : "<button type='button' class='fo-ac-btn' data-fo-join='" + c.id + "'>Join</button>";
    return "<div class='fo-inv-row'><div><b>" + E(c.name) + "</b><i>" +
      (c.format === "cup" ? "Knockout cup" : "Round robin") + " &middot; " + c.entered + " of " + c.size +
      " &middot; " + (left > 0 ? "entries close in " + left + " day" + (left === 1 ? "" : "s") : "entries close today") +
      "</i>" + fieldChips(side, myKey) + "</div>" + btn + "</div>";
  }
  function fieldChips(side, myKey) {
    if (!side.length) return "";
    return "<div class='fo-inv-field'>" + side.map(function (s) {
      var me = s.country_id + ":" + s.slot === myKey;
      return "<span class='" + (me ? "me" : s.managed ? "" : "bot") + "'>" + E(s.name) + "</span>";
    }).join("") + "</div>";
  }

  function compCard(c, myKey, side) {
    var head = "<div class='fo-inv-row'><div><b>" + E(c.name) + "</b><i>" +
      (c.format === "cup" ? "Knockout cup" : "Round robin") + " &middot; " + (c.size || (c.clubs || []).length) + " clubs" +
      (c.rounds ? " &middot; round " + Math.min(c.roundsPlayed || 0, c.rounds) + " of " + c.rounds : "") +
      "</i></div><span class='fo-inv-pill " + (c.status === "done" ? "done" : "run") + "'>" +
      (c.status === "done" ? "Finished" : "Playing") + "</span></div>";
    if (!c.results) return head + fieldChips(side, myKey);
    var body;
    if (c.format === "league") {
      body = "<div class='fo-ac-tw'><table class='fo-ac-tbl'><thead><tr><th></th><th class='nm'>Club</th><th>P</th><th>W</th><th>L</th><th class='pt'>Pts</th></tr></thead><tbody>" +
        c.table.map(function (t, i) {
          return "<tr><td>" + (i + 1) + "</td><td class='nm'>" + E(t.name) +
            (t.managed ? "" : " <em style='font-style:normal;opacity:.45'>&middot; bot</em>") + "</td><td>" + t.p + "</td><td>" + t.w + "</td><td>" + t.l + "</td><td class='pt'>" + t.pts + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    } else {
      var by = {};
      c.results.forEach(function (r) { (by[r.round] = by[r.round] || []).push(r); });
      body = Object.keys(by).sort(function (a, b) { return a - b; }).map(function (rd) {
        var nm = +rd === (c.rounds || 0) ? "The final" : (c.rounds - rd === 1 ? "Semi-finals" : "Round " + rd);
        return "<div class='fo-inv-rd'>" + nm + "</div>" + by[rd].map(tieRow).join("");
      }).join("");
    }
    return head + body +
      (c.champion ? "<div class='fo-inv-champ'>&#127942; " + E(c.champion) + " hold it.</div>" : "");
  }
  function tieRow(r) {
    var sc = function (s) { return s ? s.r + "/" + s.w : "&mdash;"; };
    return "<div class='fo-inv-tie'><b class='" + (r.winner === r.a ? "w" : "") + "'>" + E(r.a) + "</b><u>" + sc(r.as) + "</u>" +
      "<em>v</em><b class='" + (r.winner === r.b ? "w" : "") + "'>" + E(r.b) + "</b><u>" + sc(r.bs) + "</u></div>";
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
